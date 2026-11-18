'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

// Lien de navigation (docs/art-direction.md §7.1) : la page courante porte aria-current et un filet
// or. Sur une page de service, « Services » est marqué comme rubrique courante (`aria-current="true"`,
// même filet) : on est dans les services, pas sur leur page d'ensemble. Survol : le filet or
// apparaît, le texte passe en sapin (couleurs du kit, D64). `href` est le chemin public déjà
// localisé (calculé côté serveur).

type NavLinkProps = {
  href: string
  children: ReactNode
  large?: boolean
}

export function NavLink({ href, children, large = false }: NavLinkProps) {
  const pathname = usePathname()
  const page = pathname === href
  const rubrique = !page && pathname.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      aria-current={page ? 'page' : rubrique ? 'true' : undefined}
      className={`inline-flex min-h-touch items-center decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:text-sapin hover:underline ${
        page || rubrique ? 'underline' : ''
      } ${large ? 'font-display text-title-h2 font-normal text-sapin' : 'text-nav text-encre'}`}
    >
      {children}
    </Link>
  )
}
