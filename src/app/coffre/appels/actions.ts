'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  annulationAppelDuCoffre,
  deplacementAppelDuCoffre,
  effacementAppelDuCoffre,
  rattachementAppelDuCoffre,
  scellesAppelsDuCoffre,
  statutAppelDuCoffre,
} from '@/lib/auth/acces'
import { lireAccesRequete } from '@/lib/auth/serveur'
import { adresseAppel, type ResultatAppel } from '@/lib/coffre/appels'
import { getCoffrePool } from '@/lib/db/pool'
import {
  lireIdentifiantAppel,
  validerDeplacementCoffre,
  validerGesteConfirme,
  validerIdentifiantsAppels,
  validerQualification,
  validerRattachement,
} from '@/lib/validation/agenda'

// Actions de /coffre/appels (story 3.13 ; docs/reservation-appel.md §3.2). Chacune revérifie l'accès
// (session ouverte par le TOTP), valide ce qu'envoie le navigateur (Zod, src/lib/validation/agenda.ts)
// et passe par les fonctions journalisées de src/lib/auth/acces.ts : aucune ne reçoit ni ne renvoie
// un nom, un numéro ou un contenu déchiffré, et rien n'est journalisé ici.
// - `qualifierAppel`, `rattacherAppel` : formulaires (useActionState) ; elles rendent un code de liste
//   fermée, jamais une valeur reçue, puis rafraîchissent la page (`refresh`) : le contenu déchiffré
//   dans le navigateur reste affiché, la page relit statuts et rattachements.
// - `lireScellesAppels` : appelée par le navigateur au déverrouillage ; elle ne reçoit que des
//   identifiants d'appels et rend leurs octets scellés (base64), rien de lisible.
// - Story 3.11, page d'un appel (/coffre/appels/<id>) : `deplacerAppelCoffre`, `annulerAppelCoffre`,
//   `effacerAppelCoffre`, formulaires natifs (sans JavaScript) ; le résultat revient dans l'adresse
//   (`?resultat=`, liste fermée). Aucun message ne part vers la personne (boîte d'envoi : 3.12).
// `redirect()` lève une exception : toujours hors des try.

export type EtatAppel = { resultat: ResultatAppel | null }

async function accesAutorise() {
  const acces = await lireAccesRequete()
  if (acces.etat === 'anonyme') redirect('/coffre/connexion')
  if (acces.etat === 'enrolement') redirect('/coffre/enrolement')
  return acces
}

// Écriture en base : une panne (base injoignable, contrainte) devient « indisponible », sans détail.
async function ecrire<T>(operation: () => Promise<T>): Promise<{ valeur: T } | null> {
  try {
    return { valeur: await operation() }
  } catch {
    return null
  }
}

export async function qualifierAppel(_avant: EtatAppel, donnees: FormData): Promise<EtatAppel> {
  const acces = await accesAutorise()
  const lu = validerQualification(donnees)
  if (!lu.ok) return { resultat: 'saisie' }
  const fait = await ecrire(() =>
    statutAppelDuCoffre(getCoffrePool(), acces, lu.valeur.id, lu.valeur.statut),
  )
  if (!fait || fait.valeur === null) return { resultat: 'indisponible' }
  switch (fait.valeur) {
    case 'changed':
    case 'unchanged':
      refresh()
      return { resultat: 'statut' }
    case 'not-found':
      refresh()
      return { resultat: 'introuvable' }
    case 'refused':
      refresh()
      return { resultat: 'refuse' }
  }
}

export async function rattacherAppel(_avant: EtatAppel, donnees: FormData): Promise<EtatAppel> {
  const acces = await accesAutorise()
  const lu = validerRattachement(donnees)
  if (!lu.ok) return { resultat: 'saisie' }
  const fait = await ecrire(() =>
    rattachementAppelDuCoffre(getCoffrePool(), acces, lu.valeur.id, lu.valeur.demande),
  )
  if (!fait || fait.valeur === null) return { resultat: 'indisponible' }
  refresh()
  switch (fait.valeur) {
    case 'attached':
      return { resultat: 'rattache' }
    case 'detached':
      return { resultat: 'detache' }
    case 'unchanged':
      return { resultat: lu.valeur.demande === null ? 'detache' : 'rattache' }
    case 'not-found':
      return { resultat: 'introuvable' }
    case 'unknown-request':
      return { resultat: 'demande-inconnue' }
  }
}

// Lecture des appels affichés : appelée par le navigateur au déverrouillage, une fois par
// déverrouillage ; `booking_read` au journal pour chaque appel rendu. Sans accès autorisé, ou
// identifiants refusés : null.
export async function lireScellesAppels(
  ids: unknown,
): Promise<{ appels: { id: string; scelle: string }[] } | null> {
  const valides = validerIdentifiantsAppels(ids)
  if (!valides) return null
  const acces = await lireAccesRequete()
  if (acces.etat !== 'autorise') return null
  try {
    const lus = await scellesAppelsDuCoffre(getCoffrePool(), acces, valides)
    if (!lus) return null
    return {
      appels: lus.map((lu) => ({ id: lu.id, scelle: Buffer.from(lu.sealed).toString('base64') })),
    }
  } catch {
    return null
  }
}

function idEnvoye(donnees: FormData): string | null {
  return lireIdentifiantAppel(donnees.get('id'))
}

export async function deplacerAppelCoffre(donnees: FormData): Promise<void> {
  const acces = await accesAutorise()
  const lu = validerDeplacementCoffre(donnees)
  const id = idEnvoye(donnees)
  if (!id) redirect('/coffre/appels')
  if (!lu.ok) redirect(adresseAppel(id, 'saisie'))
  const fait = await ecrire(() =>
    deplacementAppelDuCoffre(getCoffrePool(), acces, id, lu.valeur.debut, new Date()),
  )
  if (!fait || fait.valeur === null) redirect(adresseAppel(id, 'indisponible'))
  const issue = fait.valeur
  const resultat: ResultatAppel =
    issue.status === 'moved'
      ? 'deplace'
      : issue.status === 'unchanged'
        ? 'inchange'
        : issue.status === 'taken'
          ? 'pris'
          : issue.status === 'not-found'
            ? 'introuvable'
            : 'refuse'
  redirect(adresseAppel(id, resultat))
}

export async function annulerAppelCoffre(donnees: FormData): Promise<void> {
  const acces = await accesAutorise()
  const id = idEnvoye(donnees)
  if (!id) redirect('/coffre/appels')
  const lu = validerGesteConfirme(donnees)
  if (!lu.ok) redirect(adresseAppel(id, 'confirmation'))
  const fait = await ecrire(() => annulationAppelDuCoffre(getCoffrePool(), acces, id, new Date()))
  if (!fait || fait.valeur === null) redirect(adresseAppel(id, 'indisponible'))
  const resultat: Record<typeof fait.valeur, ResultatAppel> = {
    cancelled: 'annule',
    'already-cancelled': 'deja-annule',
    'not-cancellable': 'refuse',
    'not-found': 'introuvable',
  }
  redirect(adresseAppel(id, resultat[fait.valeur]))
}

// Effacement définitif (procédure RGPD), après la case de confirmation.
export async function effacerAppelCoffre(donnees: FormData): Promise<void> {
  const acces = await accesAutorise()
  const id = idEnvoye(donnees)
  if (!id) redirect('/coffre/appels')
  const lu = validerGesteConfirme(donnees)
  if (!lu.ok) redirect(adresseAppel(id, 'confirmation'))
  const fait = await ecrire(() => effacementAppelDuCoffre(getCoffrePool(), acces, id))
  if (!fait) redirect(adresseAppel(id, 'indisponible'))
  redirect(fait.valeur ? '/coffre/appels?resultat=efface' : adresseAppel(id, 'introuvable'))
}
