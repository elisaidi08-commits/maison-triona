'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// Menu mobile plein écran (docs/art-direction.md §7.1). Construit sur <details> : il s'ouvre
// et se ferme sans JavaScript. Avec JavaScript : Échap le ferme et rend le focus au bouton,
// et le reste de la page devient inerte tant qu'il est ouvert (focus jamais caché, WCAG 2.4.11).

type MobileMenuProps = {
  openLabel: string
  closeLabel: string
  children: ReactNode
}

export function MobileMenu({ openLabel, closeLabel, children }: MobileMenuProps) {
  const details = useRef<HTMLDetailsElement>(null)
  const summary = useRef<HTMLElement>(null)

  useEffect(() => {
    const element = details.current
    if (!element) return
    const others = () =>
      ['contenu', 'pied-de-page']
        .map((id) => document.getElementById(id))
        .filter((node): node is HTMLElement => node !== null)
    const onToggle = () => others().forEach((node) => (node.inert = element.open))
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && element.open) {
        element.open = false
        summary.current?.focus()
      }
    }
    element.addEventListener('toggle', onToggle)
    document.addEventListener('keydown', onKey)
    return () => {
      element.removeEventListener('toggle', onToggle)
      document.removeEventListener('keydown', onKey)
      others().forEach((node) => (node.inert = false))
    }
  }, [])

  return (
    <details ref={details} className="group lg:hidden">
      <summary
        ref={summary}
        className="relative z-20 inline-flex min-h-touch cursor-pointer list-none items-center text-nav text-encre"
      >
        <span className="group-open:hidden">{openLabel}</span>
        <span className="hidden group-open:inline">{closeLabel}</span>
      </summary>
      <div className="fixed inset-0 z-10 flex flex-col justify-between overflow-y-auto bg-ivoire px-margin pt-128 pb-48">
        {children}
      </div>
    </details>
  )
}
