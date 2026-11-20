// Libellés et messages de /coffre/appels (story 3.13) : outil interne, en français seulement. Heures de
// Bruxelles. Rien de personnel ici : des heures, des statuts, les colonnes en clair des demandes ; le
// nom et le numéro ne s'affichent que dans le navigateur, déchiffrés (PersonneAppel).
// Imports relatifs seulement : testé par node --test.

import { AUCUNE_DEMANDE, type AgendaStatus, type AgendaView } from '../booking/agenda.ts'
import { zonedParts } from '../booking/zoned-time.ts'
import type { VaultRequestSummary } from '../vault/repository.ts'
import { heureEnLettres } from './disponibilites.ts'
import { dateHeure, libelle, PAYS, SERVICES, TYPES } from './libelles.ts'

export const FUSEAU_AGENDA = 'Europe/Brussels'

export const STATUTS_APPEL: Record<AgendaStatus, string> = {
  confirmed: 'Confirmé',
  to_qualify: 'À qualifier',
  done: 'Fait',
  no_answer: 'Pas de réponse',
  cancelled_by_guest: 'Annulé par la personne',
  cancelled_by_house: 'Annulé par la maison',
}

export const VUES: Record<AgendaView, string> = { jour: 'Aujourd’hui', semaine: 'Cette semaine' }

/** Paramètre `?vue=` : « semaine », sinon la vue du jour. Une valeur inconnue est ignorée. */
export function lireVue(valeur: unknown): AgendaView {
  return valeur === 'semaine' ? 'semaine' : 'jour'
}

export function adresseVue(vue: AgendaView): string {
  return vue === 'semaine' ? '/coffre/appels?vue=semaine' : '/coffre/appels'
}

/** « 10 h 30 à 11 h », heure de Bruxelles. */
export function heuresAppel(debut: Date, fin: Date): string {
  const de = zonedParts(debut, FUSEAU_AGENDA).time
  const a = zonedParts(fin, FUSEAU_AGENDA).time
  return `${heureEnLettres(de)} à ${heureEnLettres(a)}`
}

/** Date locale d'un appel, à Bruxelles (regroupement par jour). */
export function jourAppel(debut: Date): string {
  return zonedParts(debut, FUSEAU_AGENDA).date
}

/** « 18/11/2026 14:02 · Demande · Conciergerie · Belgique » : colonnes en clair seulement. */
export function libelleDemande(
  demande: Pick<VaultRequestSummary, 'createdAt' | 'kind' | 'service' | 'country'>,
): string {
  return [
    dateHeure.format(demande.createdAt),
    libelle(TYPES, demande.kind),
    libelle(SERVICES, demande.service),
    libelle(PAYS, demande.country),
  ].join(' · ')
}

export interface OptionDemande {
  value: string
  label: string
}

/**
 * Liste du rattachement : « Aucune demande », puis les demandes récentes (colonnes en clair) ; la
 * demande déjà rattachée y figure toujours, même plus ancienne.
 */
export function optionsDemandes(
  recentes: Pick<VaultRequestSummary, 'id' | 'createdAt' | 'kind' | 'service' | 'country'>[],
  rattachee: { id: string; createdAt: Date } | null,
): OptionDemande[] {
  const options = recentes.map((demande) => ({ value: demande.id, label: libelleDemande(demande) }))
  if (rattachee && !options.some((option) => option.value === rattachee.id)) {
    options.push({
      value: rattachee.id,
      label: `${dateHeure.format(rattachee.createdAt)} · Demande rattachée`,
    })
  }
  return [{ value: AUCUNE_DEMANDE, label: 'Aucune demande' }, ...options]
}

/** Réponse d'une action de l'agenda (statut, rattachement), rendue au formulaire. */
export type ResultatAppel =
  | 'statut'
  | 'rattache'
  | 'detache'
  | 'refuse'
  | 'introuvable'
  | 'demande-inconnue'
  | 'saisie'
  | 'indisponible'

export const MESSAGES_APPEL: Record<ResultatAppel, string> = {
  statut: 'Statut enregistré.',
  rattache: 'Rattachement enregistré.',
  detache: 'Rattachement retiré.',
  refuse:
    'Erreur : ce statut ne peut pas être choisi pour cet appel (pas encore commencé, ou annulé).',
  introuvable: 'Erreur : cet appel n’existe plus.',
  'demande-inconnue': 'Erreur : cette demande n’existe plus. Rechargez la page.',
  saisie: 'Erreur : le choix envoyé n’a pas été reconnu. Rechargez la page.',
  indisponible: 'Erreur : l’enregistrement n’a pas abouti. Réessayez dans un instant.',
}

export function estErreurAppel(resultat: ResultatAppel): boolean {
  return !['statut', 'rattache', 'detache'].includes(resultat)
}
