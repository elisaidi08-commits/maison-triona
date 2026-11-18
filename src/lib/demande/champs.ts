/**
 * Champs d'une demande (formulaire en étapes, docs/architecture.md §6.2, D26, D41, D57) : listes
 * fermées, étapes, limites, types et état renvoyé par la Server Action. Aucune dépendance : lu par
 * le formulaire, par l'écouteur global de présélection et par le schéma Zod (lib/validation).
 * Imports relatifs seulement : testé par node --test.
 */

export const BESOINS = ['conciergerie', 'grand-age', 'enfants', 'indecis'] as const
export const POUR_QUI = ['moi', 'proche', 'non-dit'] as const
// D41 : les cinq pays, puis « Ailleurs » et « Je préfère ne pas le dire ».
export const PAYS = ['BE', 'FR', 'LU', 'MC', 'CH', 'ailleurs', 'non-dit'] as const
export const URGENCES = ['aucune', 'semaines', 'urgent'] as const
// D57 : préférence pour être joint, pas un rendez-vous (la réservation d'appel viendra en 3.8).
export const CRENEAUX = ['matin', 'apres-midi', 'soir'] as const
export const LANGUES = ['fr', 'en'] as const
// D41 : « Comment avez-vous connu la maison ? », liste fermée, sans texte libre ; la
// recommandation ne nomme aucune clinique (le nom laisserait deviner une situation de santé).
export const ORIGINES = [
  'carte',
  'prospectus',
  'boite-aux-lettres',
  'recommandation',
  'bouche-a-oreille',
  'salon',
] as const

export const LIMITES = {
  nomMin: 2,
  nomMax: 120,
  emailMax: 254,
  telephoneMax: 30,
  messageMax: 2000,
} as const

// Les quatre étapes et leurs champs (attribut `name`), dans l'ordre de l'écran.
export const ETAPES = [
  ['besoin'],
  ['pourQui', 'pays', 'urgence'],
  ['nom', 'email', 'telephone', 'creneau', 'langue'],
  ['message', 'origine', 'consentement'],
] as const

export type Champ = (typeof ETAPES)[number][number]
export const CHAMPS: readonly Champ[] = ETAPES.flat()

// Valeurs lues dans le formulaire (chaînes nettoyées, champ vide absent) ; `locale` est caché.
export type Valeurs = Partial<Record<Champ | 'locale', string>>

// Codes d'erreur : clés de messages/*.json (Contact.form.errors).
export const CODES_ERREUR = [
  'besoin',
  'pourQui',
  'pays',
  'urgence',
  'nomRequis',
  'nomCourt',
  'nomLong',
  'emailFormat',
  'telephoneFormat',
  'contactRequis',
  'creneau',
  'langue',
  'messageLong',
  'origine',
  'consentement',
] as const
export type CodeErreur = (typeof CODES_ERREUR)[number]
export type Erreurs = Partial<Record<Champ, CodeErreur>>

// Réponse de la Server Action. `ferme` : tout est valide, mais l'envoi n'est pas ouvert (coffre
// non configuré) ; rien n'est enregistré ni envoyé. `trop-tot`, `limite`, `echec` : rien n'est
// parti, la saisie reste dans le formulaire. Un envoi abouti ne renvoie pas d'état : la Server
// Action redirige vers /contact/merci.
export type StatutDemande = 'initial' | 'erreurs' | 'trop-tot' | 'limite' | 'echec' | 'ferme'

export type EtatDemande = {
  statut: StatutDemande
  erreurs?: Erreurs
  // Saisie renvoyée telle quelle : la page se réaffiche sans rien perdre (WCAG 3.3.7).
  valeurs?: Valeurs
  // Horodatage signé à renvoyer avec l'envoi suivant : neuf si l'envoi n'en portait pas (sans
  // JavaScript) ou s'il était périmé, sinon celui reçu.
  jeton?: string
}

export const ETAT_INITIAL: EtatDemande = { statut: 'initial' }

export function etapeDuChamp(champ: Champ): number {
  return ETAPES.findIndex((champs) => (champs as readonly Champ[]).includes(champ))
}

/** Première étape (0 à 3) qui porte une erreur, ou `null`. */
export function premiereEtapeEnErreur(erreurs: Erreurs): number | null {
  const index = ETAPES.findIndex((champs) => champs.some((champ) => erreurs[champ]))
  return index === -1 ? null : index
}

export function estChamp(nom: string): nom is Champ {
  return (CHAMPS as readonly string[]).includes(nom)
}
