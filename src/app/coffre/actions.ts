'use server'

import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { appelerAuth } from '@/lib/auth/appel'
import type { ReponseAuth } from '@/lib/auth/appel'
import { getAuth } from '@/lib/auth/serveur'
import { getCoffrePool } from '@/lib/db/pool'

// Formulaires du coffre (story 3.2, partie C), utilisables sans JavaScript (POST natif vers la
// Server Action). Chaque action appelle la route Better Auth correspondante par `auth.handler`
// (limitation de débit, contrôle d'origine, liste fermée de routes, journal d'accès), puis recopie
// ses cookies vers le navigateur. Rien n'est journalisé ici : ni adresse, ni mot de passe, ni code.

export type ErreurConnexion = 'saisie' | 'identifiants' | 'trop-de-tentatives' | 'indisponible'
export type EtatConnexion = { erreur: ErreurConnexion | null; email: string }

export type ErreurCode =
  'saisie' | 'code' | 'expire' | 'verrouille' | 'trop-de-tentatives' | 'indisponible'
export type EtatCode = { erreur: ErreurCode | null; mode: 'totp' | 'secours' }

export type EtatEnrolement =
  | {
      etape: 'mot-de-passe'
      erreur: 'saisie' | 'mot-de-passe' | 'delai' | 'trop-de-tentatives' | 'indisponible' | null
    }
  | {
      etape: 'code'
      // URI otpauth (elle contient le secret) et codes de secours : affichés une fois, au retour
      // de l'activation ; sans JavaScript, ils ne survivent pas à une erreur de saisie du code.
      uri: string | null
      codesSecours: string[]
      erreur: 'saisie' | 'code' | 'trop-de-tentatives' | 'indisponible' | null
    }

const LONGUEUR_MAX = 256

function champ(donnees: FormData, nom: string): string {
  const valeur = donnees.get(nom)
  return typeof valeur === 'string' ? valeur.slice(0, LONGUEUR_MAX) : ''
}

async function appeler(chemin: string, corps: Record<string, unknown>): Promise<ReponseAuth> {
  const reponse = await appelerAuth(getAuth(), getCoffrePool(), chemin, corps, await headers())
  const magasin = await cookies()
  for (const ligne of reponse.cookies) {
    for (const [nom, attributs] of parseSetCookieHeader(ligne)) {
      magasin.set(nom, attributs.value, toCookieOptions(attributs))
    }
  }
  return reponse
}

export async function seConnecter(
  _avant: EtatConnexion,
  donnees: FormData,
): Promise<EtatConnexion> {
  const email = champ(donnees, 'email').trim()
  const motDePasse = champ(donnees, 'mot-de-passe')
  if (!email || !motDePasse) return { erreur: 'saisie', email }

  const reponse = await appeler('/sign-in/email', { email, password: motDePasse, rememberMe: true })
  if (reponse.statut === 200) {
    const defi = (reponse.donnees as { twoFactorRedirect?: unknown } | null)?.twoFactorRedirect
    redirect(defi === true ? '/coffre/verification' : '/coffre/enrolement')
  }
  // 400 (adresse mal formée) comme 401 : on ne dit jamais ce qui était faux.
  const erreur: ErreurConnexion =
    reponse.statut === 401 || reponse.statut === 400
      ? 'identifiants'
      : reponse.statut === 429
        ? 'trop-de-tentatives'
        : 'indisponible'
  return { erreur, email }
}

function erreurDeCode(reponse: ReponseAuth): ErreurCode {
  switch (reponse.code) {
    case 'INVALID_CODE':
    case 'INVALID_BACKUP_CODE':
      return 'code'
    case 'INVALID_TWO_FACTOR_COOKIE':
    case 'TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE':
      return 'expire'
    case 'ACCOUNT_TEMPORARILY_LOCKED':
      return 'verrouille'
  }
  return reponse.statut === 429 ? 'trop-de-tentatives' : 'indisponible'
}

export async function verifierCode(_avant: EtatCode, donnees: FormData): Promise<EtatCode> {
  const mode = champ(donnees, 'mode') === 'secours' ? 'secours' : 'totp'
  const code = champ(donnees, 'code').replace(/\s+/g, '')
  if (!code) return { erreur: 'saisie', mode }

  const chemin = mode === 'secours' ? '/two-factor/verify-backup-code' : '/two-factor/verify-totp'
  const reponse = await appeler(chemin, { code })
  if (reponse.statut === 200) redirect('/coffre')
  return { erreur: erreurDeCode(reponse), mode }
}

// Enrôlement du TOTP, en deux temps dans le même formulaire : mot de passe (activation, qui rend
// le secret et les codes de secours), puis premier code (confirmation, qui ouvre la session).
export async function enrolerTotp(
  avant: EtatEnrolement,
  donnees: FormData,
): Promise<EtatEnrolement> {
  const etape = champ(donnees, 'etape')
  if (etape === 'code') return confirmerEnrolement(avant, donnees)
  if (etape === 'recommencer') return { etape: 'mot-de-passe', erreur: null }

  const motDePasse = champ(donnees, 'mot-de-passe')
  if (!motDePasse) return { etape: 'mot-de-passe', erreur: 'saisie' }
  const reponse = await appeler('/two-factor/enable', { password: motDePasse })
  if (reponse.statut === 200) {
    const { totpURI, backupCodes } = reponse.donnees as { totpURI: string; backupCodes: string[] }
    return { etape: 'code', uri: totpURI, codesSecours: backupCodes, erreur: null }
  }
  if (reponse.code === 'TOTP_ALREADY_ENABLED') redirect('/coffre')
  if (reponse.statut === 401) redirect('/coffre/connexion')
  return {
    etape: 'mot-de-passe',
    erreur:
      reponse.code === 'INVALID_PASSWORD'
        ? 'mot-de-passe'
        : reponse.code === 'ENROLMENT_WINDOW_CLOSED'
          ? 'delai'
          : reponse.statut === 429
            ? 'trop-de-tentatives'
            : 'indisponible',
  }
}

async function confirmerEnrolement(
  avant: EtatEnrolement,
  donnees: FormData,
): Promise<EtatEnrolement> {
  const suite =
    avant.etape === 'code' ? avant : { etape: 'code' as const, uri: null, codesSecours: [] }
  const code = champ(donnees, 'code').replace(/\s+/g, '')
  if (!code) return { ...suite, erreur: 'saisie' }

  const reponse = await appeler('/two-factor/verify-totp', { code })
  if (reponse.statut === 200) redirect('/coffre')
  // Session expirée pendant l'enrôlement : retour à la connexion.
  if (reponse.code === 'INVALID_TWO_FACTOR_COOKIE') redirect('/coffre/connexion')
  return {
    ...suite,
    erreur:
      reponse.code === 'INVALID_CODE'
        ? 'code'
        : reponse.statut === 429
          ? 'trop-de-tentatives'
          : 'indisponible',
  }
}

export async function seDeconnecter(): Promise<void> {
  await appeler('/sign-out', {})
  redirect('/coffre/connexion')
}
