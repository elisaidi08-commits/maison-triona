'use server'

import { parseSetCookieHeader, toCookieOptions } from 'better-auth/cookies'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { effacementDuCoffre, exportDuCoffre, gelDuCoffre, scelleDuCoffre } from '@/lib/auth/acces'
import { appelerAuth } from '@/lib/auth/appel'
import type { ReponseAuth } from '@/lib/auth/appel'
import { estSvgQrValide, qrCodeSvg } from '@/lib/auth/qr-code'
import { getAuth, lireAccesRequete } from '@/lib/auth/serveur'
import { getCoffrePool } from '@/lib/db/pool'
import { isRequestId } from '@/lib/vault/repository'

// Formulaires du coffre (story 3.2, parties C et D), utilisables sans JavaScript (POST natif vers la
// Server Action). Connexion : chaque action appelle la route Better Auth correspondante par
// `auth.handler` (limitation de débit, contrôle d'origine, liste fermée de routes, journal d'accès),
// puis recopie ses cookies vers le navigateur. Rien n'est journalisé ici : ni adresse, ni mot de
// passe, ni code. Demandes (partie D) : gel, effacement et export revérifient l'accès (session et
// TOTP) à chaque appel, ne reçoivent qu'un identifiant et passent par les fonctions journalisées de
// src/lib/auth/acces.ts. Aucune ne reçoit ni ne renvoie un contenu déchiffré.

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
      // QR code de l'URI, en SVG produit ici, sur le serveur (D68) ; null s'il n'a pas pu l'être :
      // le secret en texte suffit alors.
      qr: string | null
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
    const qr = await qrCodeSvg(totpURI).catch(() => null)
    return { etape: 'code', uri: totpURI, qr, codesSecours: backupCodes, erreur: null }
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

// État précédent de l'enrôlement, renvoyé par le navigateur avec le formulaire (useActionState) :
// rien n'en est repris sans contrôle. Le QR code n'est gardé que s'il passe la validation stricte
// du SVG (il est inséré tel quel dans la page) ; l'URI et les codes de secours, rendus comme texte,
// ne sont gardés que s'ils ont leur forme attendue.
function etatCodeSur(avant: EtatEnrolement): Extract<EtatEnrolement, { etape: 'code' }> {
  if (typeof avant !== 'object' || avant === null || avant.etape !== 'code') {
    return { etape: 'code', uri: null, qr: null, codesSecours: [], erreur: null }
  }
  const uri =
    typeof avant.uri === 'string' &&
    avant.uri.length <= 512 &&
    avant.uri.startsWith('otpauth://totp/')
      ? avant.uri
      : null
  const codesSecours = Array.isArray(avant.codesSecours)
    ? avant.codesSecours
        .filter((code) => typeof code === 'string' && /^[A-Za-z0-9-]{1,32}$/.test(code))
        .slice(0, 20)
    : []
  return {
    etape: 'code',
    uri,
    qr: uri && estSvgQrValide(avant.qr) ? avant.qr : null,
    codesSecours,
    erreur: null,
  }
}

async function confirmerEnrolement(
  avant: EtatEnrolement,
  donnees: FormData,
): Promise<EtatEnrolement> {
  const suite = etatCodeSur(avant)
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

// Accès autorisé, ou redirection (connexion, enrôlement) : une action sur une demande n'aboutit
// jamais sans session ouverte par le second facteur.
async function accesAutorise() {
  const acces = await lireAccesRequete()
  if (acces.etat === 'anonyme') redirect('/coffre/connexion')
  if (acces.etat === 'enrolement') redirect('/coffre/enrolement')
  return acces
}

export async function basculerGel(donnees: FormData): Promise<void> {
  const id = champ(donnees, 'id')
  const gel = champ(donnees, 'gel') === 'oui'
  const acces = await accesAutorise()
  if (!isRequestId(id) || !(await gelDuCoffre(getCoffrePool(), acces, id, gel))) redirect('/coffre')
  redirect(`/coffre/demandes/${id}`)
}

// Effacement définitif, après la case de confirmation (exigée aussi par le navigateur, `required`).
export async function effacerDemande(donnees: FormData): Promise<void> {
  const id = champ(donnees, 'id')
  const acces = await accesAutorise()
  if (!isRequestId(id)) redirect('/coffre')
  if (champ(donnees, 'confirmation') !== 'oui') redirect(`/coffre/demandes/${id}`)
  const efface = await effacementDuCoffre(getCoffrePool(), acces, id)
  redirect(efface ? '/coffre?effacee=1' : '/coffre')
}

// Lecture : appelée par le navigateur au déverrouillage, une fois par page ; elle ne reçoit que
// l'identifiant, inscrit `read` au journal et rend les octets scellés (base64), rien de lisible.
export async function lireScelle(id: unknown): Promise<{ scelle: string } | null> {
  if (!isRequestId(id)) return null
  const acces = await lireAccesRequete()
  if (acces.etat !== 'autorise') return null
  try {
    const octets = await scelleDuCoffre(getCoffrePool(), acces, id)
    return octets ? { scelle: Buffer.from(octets).toString('base64') } : null
  } catch {
    return null
  }
}

// Export : appelée par le navigateur avant de composer le fichier ; elle ne reçoit que
// l'identifiant et n'inscrit que `export`. Pas d'export sans trace : `ok: false` arrête l'export.
export async function journaliserExport(id: unknown): Promise<{ ok: boolean }> {
  if (!isRequestId(id)) return { ok: false }
  const acces = await lireAccesRequete()
  if (acces.etat !== 'autorise') return { ok: false }
  try {
    return { ok: await exportDuCoffre(getCoffrePool(), acces, id) }
  } catch {
    return { ok: false }
  }
}
