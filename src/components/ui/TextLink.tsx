import type { ReactNode } from 'react'

// Lien à filet sur ivoire : texte sapin (10,56:1), filet or 1 px permanent (le lien ne repose pas
// sur la seule couleur, WCAG 1.4.1). Survol : le texte passe au cyprès (Figma 80:43).
// Cible d'au moins 48 px de haut. Sur sapin (`onDark`) : texte champagne (6,47:1), filet champagne,
// survol ivoire. Sur pierre (`onStone`) : texte et filet sapin (7,49:1), jamais d'or sur pierre ;
// survol cyprès (4,67:1).

type TextLinkProps = {
  href: string
  children: ReactNode
  onDark?: boolean
  onStone?: boolean
}

export function TextLink({ href, children, onDark = false, onStone = false }: TextLinkProps) {
  return (
    <a
      href={href}
      className={`inline-flex min-h-touch items-center underline decoration-1 underline-offset-8 transition-colors duration-micro ease-standard ${
        onDark
          ? 'text-champagne decoration-champagne hover:text-ivoire'
          : onStone
            ? 'text-sapin decoration-sapin hover:text-cypres'
            : 'text-sapin decoration-or hover:text-cypres'
      }`}
    >
      {children}
    </a>
  )
}
