// Options de la réservation d'appel (story 3.10), lues dans l'environnement.
// Case « Me prévenir aussi par SMS » : masquée tant que le fournisseur SMS n'est pas choisi (story
// 3.12). Elle n'apparaît, et l'action ne retient le choix, que si `BOOKING_SMS_OPT_IN` vaut « true » ;
// absente ou autre valeur : masquée, aucun choix SMS enregistré.
// Imports relatifs seulement : testé par node --test.

export function smsPropose(env: Record<string, string | undefined> = process.env): boolean {
  return env.BOOKING_SMS_OPT_IN?.trim() === 'true'
}
