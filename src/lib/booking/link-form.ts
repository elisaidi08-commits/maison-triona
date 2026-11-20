/**
 * Formulaire de demande de lien (story 3.9 ; docs/reservation-appel.md §2, étape 1) : un seul champ,
 * l'adresse e-mail ; la langue vient de la page (champ caché). Codes d'erreur et état renvoyé par la
 * Server Action. Aucune dépendance : lu par le composant client, la validation Zod et l'action.
 * Imports relatifs seulement : testé par node --test.
 */

// Codes d'erreur : clés de messages/*.json (BookingLink.request.errors.codes).
export const CODES_ERREUR_LIEN = ['emailRequis', 'emailFormat'] as const
export type CodeErreurLien = (typeof CODES_ERREUR_LIEN)[number]

// Saisie relue (chaînes nettoyées, champ vide absent). `locale` et `jeton` (horodatage signé) sont
// cachés.
export type ValeursLien = Partial<Record<'email' | 'locale' | 'jeton', string>>

// Réponse de l'action. Une demande aboutie ne renvoie pas d'état : l'action redirige vers la page
// « Un lien vient de vous être envoyé », la même pour toute adresse, qu'un lien parte ou non (adresse
// déjà limitée, robot). `erreurs` : adresse absente ou mal formée. `trop-tot` : horodatage absent
// (premier envoi sans JavaScript), falsifié, périmé ou rejoué, ou envoi en moins de 3 secondes ; un
// horodatage neuf revient avec la saisie. `echec` : base ou limitation de débit injoignable, rien
// d'enregistré. `ferme` : la demande de lien n'est pas encore ouverte (base, secrets ou e-mails non
// configurés) ; rien n'est enregistré ni envoyé.
export type StatutLien = 'initial' | 'erreurs' | 'trop-tot' | 'echec' | 'ferme'

export type EtatLien = {
  statut: StatutLien
  valeurs?: { email?: string }
  erreurs?: { email?: CodeErreurLien }
  jeton?: string
}

export const ETAT_LIEN_INITIAL: EtatLien = { statut: 'initial' }
