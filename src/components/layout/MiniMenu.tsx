'use client'

import { useEffect, useState } from 'react'

// Mini-menu de l'accueil (docs/art-direction.md §7.9, spec d'entrée §2.3) : desktop seulement,
// après le hero, collant en haut de l'écran pendant les scènes. Fond ivoire plein, filet sapin
// à 20 % en bas, aucun flou, aucune ombre. Vrais liens (ancres et page Contact) : sans JavaScript,
// il fonctionne, seul le repère de la scène en cours manque. La scène qui croise le milieu de
// l'écran est soulignée d'un filet or. La page réserve sa hauteur (scroll-padding-top, tokens.css).

type Item = { href: string; label: string; anchor?: string }

type MiniMenuProps = {
  label: string
  items: Item[]
}

export function MiniMenu({ label, items }: MiniMenuProps) {
  const [active, setActive] = useState<string | null>(null)
  const anchors = items.flatMap((item) => (item.anchor ? [item.anchor] : [])).join(' ')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id
          if (entry.isIntersecting) setActive(id)
          else setActive((current) => (current === id ? null : current))
        }
      },
      { rootMargin: '-50% 0px -50% 0px' },
    )
    for (const id of anchors.split(' ')) {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    }
    return () => observer.disconnect()
  }, [anchors])

  return (
    <nav
      aria-label={label}
      data-mini-menu
      className="sticky top-0 z-10 hidden h-touch border-b border-sapin-20 bg-ivoire px-margin lg:block"
    >
      <ul className="flex h-full items-center gap-32">
        {items.map((item) => {
          const current = item.anchor !== undefined && item.anchor === active
          return (
            <li key={item.href}>
              <a
                href={item.href}
                aria-current={current ? 'true' : undefined}
                className={`inline-flex min-h-touch items-center text-nav text-encre decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:text-cypres ${
                  current ? 'underline' : ''
                }`}
              >
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
