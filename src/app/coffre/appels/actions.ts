'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import {
  rattachementAppelDuCoffre,
  scellesAppelsDuCoffre,
  statutAppelDuCoffre,
} from '@/lib/auth/acces'
import { lireAccesRequete } from '@/lib/auth/serveur'
import type { ResultatAppel } from '@/lib/coffre/appels'
import { getCoffrePool } from '@/lib/db/pool'
import {
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
