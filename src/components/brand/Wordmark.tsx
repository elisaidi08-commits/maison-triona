// Lien d'accueil de l'en-tête (docs/art-direction.md §7.1) : le sceau L1-D seul (D53), 48 px. Le
// nom accessible est porté par le lien.

import { Seal } from './Seal'

type WordmarkProps = {
  href: string
  label: string
}

export function Wordmark({ href, label }: WordmarkProps) {
  return (
    <a href={href} aria-label={label} className="inline-flex min-h-touch items-center">
      <Seal />
    </a>
  )
}
