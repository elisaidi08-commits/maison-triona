import type { ReactNode } from 'react'

// Pages des liens personnels de réservation d'appel (story 3.10 ; docs/reservation-appel.md §4.4) :
// hors du groupe (site), dont la garde `ensureStatic` refuse tout rendu à la requête. Celles-ci lisent
// la base à chaque affichage (le lien vaut-il encore, quels créneaux sont libres) : chaque page appelle
// `connection()` avant toute lecture (layout et page se rendent en parallèle), et `instant = false`
// les dispense de la validation de coquille statique de Cache Components (guide « instant »), comme
// /coffre. La coquille (en-tête, pied de page) reste celle du layout par langue.
// Une page affichée par GET n'engage rien : seules les Server Actions écrivent. En-têtes (noindex,
// no-store, référent réduit à l'origine : le jeton est dans l'adresse) posés par next.config.ts ;
// hors du sitemap.

export const instant = false

export default function LienLayout({ children }: { children: ReactNode }) {
  return children
}
