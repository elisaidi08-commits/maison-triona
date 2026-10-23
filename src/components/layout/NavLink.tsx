'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// Lien de navigation : la page courante porte aria-current et un filet or (docs/art-direction.md §7.1).
// `href` est le chemin public déjà localisé (calculé côté serveur). `large` : menu mobile ; `menu` :
// menu plein écran du prototype (MenuPanneau), en display.

type NavLinkProps = {
  href: string
  children: ReactNode
  large?: boolean
  menu?: boolean
}

export function NavLink({ href, children, large = false, menu = false }: NavLinkProps) {
  const current = usePathname() === href
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`inline-flex min-h-touch items-center decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:text-cypres ${
        current ? 'underline' : ''
      } ${
        menu
          ? 'font-display text-display-l text-sapin'
          : large
            ? 'font-display text-title-h2 font-normal text-sapin'
            : 'text-nav text-encre'
      }`}
    >
      {children}
    </Link>
  )
}
