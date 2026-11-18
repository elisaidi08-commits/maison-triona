import type { VaultRequestSummary } from '../vault/repository.ts'
import type { SealedFields } from '../vault/seal.ts'

// Libellés du coffre (story 3.2, parties C et D) : outil interne, en français seulement. Les codes
// des listes fermées du formulaire (src/lib/demande/champs.ts) deviennent des mots ; une valeur
// inconnue s'affiche telle quelle, toujours comme texte. Partagés par la liste, la page de lecture
// et l'export (le fichier composé dans le navigateur).
// Imports relatifs seulement : testé par node --test.

export const VIDE = '–'

export const TYPES: Record<string, string> = { request: 'Demande', urgent: 'Urgente' }
export const STATUTS: Record<string, string> = {
  new: 'Nouvelle',
  in_progress: 'En cours',
  closed: 'Close',
}
export const SERVICES: Record<string, string> = {
  conciergerie: 'Conciergerie',
  'grand-age': 'Grand âge',
  enfants: 'Enfants',
  indecis: 'À préciser',
}
export const PAYS: Record<string, string> = {
  BE: 'Belgique',
  FR: 'France',
  LU: 'Luxembourg',
  MC: 'Monaco',
  CH: 'Suisse',
  ailleurs: 'Ailleurs',
  'non-dit': 'Non précisé',
}
export const LANGUES: Record<string, string> = { fr: 'Français', en: 'Anglais' }
export const URGENCES: Record<string, string> = {
  aucune: 'Aucune',
  semaines: 'Semaines à venir',
  urgent: 'Urgent',
}
export const ORIGINES: Record<string, string> = {
  carte: 'Carte de visite',
  prospectus: 'Prospectus',
  'boite-aux-lettres': 'Boîte aux lettres',
  recommandation: 'Recommandation d’un professionnel',
  'bouche-a-oreille': 'Bouche-à-oreille',
  salon: 'Salon',
}
const POUR_QUI: Record<string, string> = {
  moi: 'Pour la personne qui écrit',
  proche: 'Pour un proche',
  'non-dit': 'Non précisé',
}
const CRENEAUX: Record<string, string> = {
  matin: 'Le matin',
  'apres-midi': 'L’après-midi',
  soir: 'Le soir',
}

export function libelle(valeurs: Record<string, string>, valeur: string | null): string {
  if (valeur === null || valeur === '') return VIDE
  return Object.hasOwn(valeurs, valeur) ? (valeurs[valeur] ?? valeur) : valeur
}

const FUSEAU = 'Europe/Brussels'
export const dateHeure = new Intl.DateTimeFormat('fr-BE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: FUSEAU,
})
export const date = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'short', timeZone: FUSEAU })

export interface Colonne {
  libelle: string
  valeur: string
}

/** Colonnes en clair d'une demande, mises en mots (page de lecture et export). */
export function colonnesEnClair(demande: VaultRequestSummary): Colonne[] {
  return [
    { libelle: 'Reçue le', valeur: dateHeure.format(demande.createdAt) },
    { libelle: 'Type', valeur: libelle(TYPES, demande.kind) },
    { libelle: 'Besoin', valeur: libelle(SERVICES, demande.service) },
    { libelle: 'Pays', valeur: libelle(PAYS, demande.country) },
    { libelle: 'Langue de réponse', valeur: libelle(LANGUES, demande.locale) },
    { libelle: 'Urgence', valeur: libelle(URGENCES, demande.urgency) },
    { libelle: 'Origine', valeur: libelle(ORIGINES, demande.source) },
    { libelle: 'Statut', valeur: libelle(STATUTS, demande.status) },
    {
      libelle: 'Conservée jusqu’au',
      valeur: `${date.format(demande.retentionUntil)}${demande.frozen ? ' (gelée)' : ''}`,
    },
  ]
}

// Champs scellés, dans l'ordre du formulaire. Rien de ce qui suit n'atteint le serveur en clair.
export const CHAMPS_SCELLES: readonly { cle: keyof SealedFields; libelle: string }[] = [
  { cle: 'nom', libelle: 'Nom' },
  { cle: 'email', libelle: 'E-mail' },
  { cle: 'telephone', libelle: 'Téléphone' },
  { cle: 'pourQui', libelle: 'Pour qui' },
  { cle: 'creneau', libelle: 'Moment pour être joint' },
  { cle: 'message', libelle: 'Mot libre' },
]

export function valeurScellee(cle: keyof SealedFields, valeur: string | null): string {
  if (cle === 'pourQui') return libelle(POUR_QUI, valeur)
  if (cle === 'creneau') return libelle(CRENEAUX, valeur)
  return valeur === null || valeur === '' ? VIDE : valeur
}
