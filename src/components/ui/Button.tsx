import type { ReactNode } from 'react'

// Bouton sur fond sapin (docs/art-direction.md §7.5) : texte ivoire, bordure or 1 px, rayon 0,
// hauteur 52 px, libellé en corps 18 px comme le lien. Survol : bordure champagne et filet sous
// le texte qui se dessine (M4). Sur ivoire : TextLink.

const CLASSES =
  'group inline-flex min-h-button items-center justify-center border border-or px-32 text-body text-ivoire transition-colors duration-micro ease-standard hover:border-champagne'

type ButtonProps =
  | { children: ReactNode; href: string; type?: never }
  | { children: ReactNode; href?: never; type?: 'button' | 'submit' }

export function Button({ children, href, type = 'button' }: ButtonProps) {
  if (href) {
    return (
      <a href={href} className={CLASSES}>
        <span className="filet-survol">{children}</span>
      </a>
    )
  }
  return (
    <button type={type} className={`${CLASSES} cursor-pointer bg-sapin`}>
      <span className="filet-survol">{children}</span>
    </button>
  )
}
