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

// Demande échue : échéance atteinte et pas gelée. Une demande gelée (limitation, RGPD art. 18)
// n'est jamais effacée par la conservation automatique, même échue. Même règle que la requête de
// `purgeExpired` (repository.ts : `retention_until <= now AND NOT frozen`), que les tests
// d'intégration comparent à celle-ci ; la page de lecture du coffre l'affiche.
export function isExpired(request: { retentionUntil: Date; frozen: boolean }, now: Date): boolean {
  if (Number.isNaN(now.getTime())) throw new RangeError('Date invalide')
  return !request.frozen && request.retentionUntil.getTime() <= now.getTime()
}

// Au-delà de 48 heures sans passage de la conservation planifiée (quotidienne), l'accueil du coffre
// le signale : secret absent, tâche coupée, base injoignable… Les demandes échues ne sont alors plus
// effacées. Deux jours laissent passer un passage manqué (Vercel ne réessaie pas).
export const RETENTION_RUN_ALERT_HOURS = 48

export function retentionRunStatus(last: Date | null, now: Date): 'never' | 'recent' | 'late' {
  if (Number.isNaN(now.getTime())) throw new RangeError('Date invalide')
  if (last === null) return 'never'
  return now.getTime() - last.getTime() > RETENTION_RUN_ALERT_HOURS * 3600 * 1000
    ? 'late'
    : 'recent'
}
