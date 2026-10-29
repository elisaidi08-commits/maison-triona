// Lien d'accueil de l'en-tête (docs/art-direction.md §7.1) : le logo horizontal « le sillage »
// (D49), 32 px de haut en mobile, 44 px en desktop. Le nom accessible est porté par le lien.

import { Logo } from './Logo'

type WordmarkProps = {
  href: string
  label: string
}

export function Wordmark({ href, label }: WordmarkProps) {
  return (
    <a href={href} aria-label={label} className="inline-flex min-h-touch items-center">
      <Logo />
    </a>
  )
}
