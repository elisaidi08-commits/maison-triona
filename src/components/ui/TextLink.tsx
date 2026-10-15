import type { ReactNode } from 'react'

// Lien à filet sur ivoire : texte sapin (10,56:1), filet or 1 px permanent (le lien ne repose pas
// sur la seule couleur, WCAG 1.4.1). Survol : le texte passe au cyprès (Figma 80:43).
// Cible d'au moins 48 px de haut.

type TextLinkProps = {
  href: string
  children: ReactNode
}

export function TextLink({ href, children }: TextLinkProps) {
  return (
    <a
      href={href}
      className="inline-flex min-h-touch items-center text-sapin underline decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:text-cypres"
    >
      {children}
    </a>
  )
}
