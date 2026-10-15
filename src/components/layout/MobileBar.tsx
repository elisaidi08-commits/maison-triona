'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Barre mobile « Écrire en toute discrétion » (docs/art-direction.md §7.10) : fixée en bas sous
// 1024 px, 56 px, aplat sapin, filet or en haut. Absente de la page Contact ; masquée pendant la
// saisie au clavier (un champ a le focus). La page réserve sa hauteur (tokens.css :
// --barre-mobile-height), le focus n'est donc jamais masqué (WCAG 2.4.11). Sous le menu mobile ouvert.

const FIELDS = 'input, textarea, select, [contenteditable="true"]'

export function MobileBar({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const [typing, setTyping] = useState(false)

  useEffect(() => {
    const isField = (target: EventTarget | null) =>
      target instanceof HTMLElement && target.matches(FIELDS)
    const onFocusIn = (event: FocusEvent) => {
      if (isField(event.target)) setTyping(true)
    }
    const onFocusOut = (event: FocusEvent) => {
      if (isField(event.target)) setTyping(false)
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
    }
  }, [])

  if (pathname === href) return null

  return (
    <div
      data-barre-mobile
      data-surface="sapin"
      className={`fixed inset-x-0 bottom-0 h-touch-lg border-t border-or lg:hidden ${typing ? 'hidden' : ''}`}
    >
      <Link
        href={href}
        className="focus-interieur flex h-full items-center justify-center px-margin text-nav"
      >
        {label}
      </Link>
    </div>
  )
}
