// Plafond de conservation des demandes sans suite, appliqué automatiquement par le coffre.
// Proposition de D05 (12 mois), [À VALIDER] par Cat et le juriste. Constante interne : elle n'est
// citée dans aucun texte publié tant qu'elle n'est pas validée (D61).
export const RETENTION_MONTHS = 12

// Échéance de conservation : même jour et même heure UTC, `months` mois plus tard, ramenée au
// dernier jour du mois quand ce jour n'existe pas (31 janvier + 1 mois → 28 ou 29 février).
export function retentionDeadline(createdAt: Date, months: number): Date {
  if (!Number.isInteger(months) || months < 0) {
    throw new RangeError('Durée de conservation invalide : nombre entier de mois, positif ou nul')
  }
  if (Number.isNaN(createdAt.getTime())) {
    throw new RangeError('Date de création invalide')
  }

  const year = createdAt.getUTCFullYear()
  const month = createdAt.getUTCMonth() + months
  // Jour 0 du mois suivant = dernier jour du mois visé (Date.UTC reporte les mois en trop).
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(createdAt.getUTCDate(), lastDay),
      createdAt.getUTCHours(),
      createdAt.getUTCMinutes(),
      createdAt.getUTCSeconds(),
      createdAt.getUTCMilliseconds(),
    ),
  )
}
