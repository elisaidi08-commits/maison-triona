'use client'

import type { ComponentProps, ReactNode } from 'react'
import { Link, usePathname } from '@/i18n/navigation'

// Lien de navigation : la page courante porte aria-current et un filet or (docs/art-direction.md §7.1).

type NavLinkProps = {
  href: ComponentProps<typeof Link>['href']
  children: ReactNode
  large?: boolean
}

export function NavLink({ href, children, large = false }: NavLinkProps) {
  const pathname = usePathname()
  const current = typeof href === 'string' && pathname === href
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      className={`inline-flex min-h-touch items-center decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:text-cypres ${
        current ? 'underline' : ''
      } ${large ? 'font-display text-title-h2 font-normal text-sapin' : 'text-nav text-encre'}`}
    >
      {children}
    </Link>
  )
}
