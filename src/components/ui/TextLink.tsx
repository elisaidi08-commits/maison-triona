import Link from 'next/link'
import type { ReactNode } from 'react'

// Lien à filet sur ivoire : texte sapin (10,6:1), filet or 1 px permanent (le lien ne repose pas
// sur la seule couleur, WCAG 1.4.1). Survol : le filet or passe au sapin, le texte ne bouge pas
// (couleurs du kit, D64 ; le cyprès de Figma 80:43 est retiré). Cible d'au moins 48 px de haut.
// Navigation interne de Next.js (`Link`) : la page suivante est préchargée, le changement se fait
// sans rechargement (D37). `transitionTypes` marque une navigation pour `<ViewTransition>` (passage
// de pièce, prototype MT-03). `besoin` : pose `data-besoin` sur un lien vers le contact, lu par
// l'écouteur de présélection du formulaire (D26, story 3.4).

type TextLinkProps = {
  href: string
  children: ReactNode
  transitionTypes?: string[]
  besoin?: string
}

export function TextLink({ href, children, transitionTypes, besoin }: TextLinkProps) {
  return (
    <Link
      href={href}
      transitionTypes={transitionTypes}
      data-besoin={besoin}
      className="inline-flex min-h-touch items-center text-sapin underline decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:decoration-sapin"
    >
      {children}
    </Link>
  )
}
