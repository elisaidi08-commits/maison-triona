import { notFound } from 'next/navigation'

// Toute adresse inconnue sous /fr ou /en affiche la 404 localisée.
// Hors du groupe (site) : elle n'est pas soumise à la garde « tout statique ».

export default function CatchAll() {
  notFound()
}
