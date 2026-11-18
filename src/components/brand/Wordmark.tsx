// Lien d'accueil de l'en-tête (docs/art-direction.md §7.1) : le sceau L1-D seul (D53), 48 px. Le
// nom accessible est porté par le lien. Navigation interne de Next.js (`Link`) : l'accueil revient
// sans rechargement (D37).

import Link from 'next/link'
import { Seal } from './Seal'

type WordmarkProps = {
  href: string
  label: string
}

export function Wordmark({ href, label }: WordmarkProps) {
  return (
    <Link href={href} aria-label={label} className="inline-flex min-h-touch items-center">
      <Seal />
    </Link>
  )
}
