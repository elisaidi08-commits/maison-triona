'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { switchLocalePath, type Locale } from '@/i18n/pathnames'

// Suggestion de langue (docs/art-direction.md §7.11) : proposer sans imposer. Jamais de redirection,
// jamais de modale ; refermable, mémorisée pour la session. Posée en bas d'écran (position fixe)
// pour ne provoquer aucun décalage de mise en page à son apparition (CLS 0), sous le menu mobile.

const STORAGE_KEY = 'mt-lang-suggestion-closed'

type LanguageSuggestionProps = {
  current: Locale
  target: Locale
  text: string
  switchLabel: string
  closeLabel: string
}

export function LanguageSuggestion({
  current,
  target,
  text,
  switchLabel,
  closeLabel,
}: LanguageSuggestionProps) {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const bar = useRef<HTMLElement>(null)

  useEffect(() => {
    let closed = false
    try {
      closed = sessionStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      closed = false
    }
    const preferred = (navigator.languages ?? [navigator.language])
      .map((language) => language.slice(0, 2).toLowerCase())
      .find((language) => language === 'fr' || language === 'en')
    // Lecture d'une préférence du navigateur après le montage : état local, aucune donnée envoyée.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(!closed && preferred === target && preferred !== current)
  }, [current, target])

  // La page réserve la hauteur du bandeau : rien n'est masqué en bas, ni le focus (WCAG 2.4.11).
  useEffect(() => {
    const root = document.documentElement
    const height = visible ? (bar.current?.offsetHeight ?? 0) : 0
    document.body.style.paddingBottom = height ? `${height}px` : ''
    root.style.scrollPaddingBottom = height ? `${height}px` : ''
    return () => {
      document.body.style.paddingBottom = ''
      root.style.scrollPaddingBottom = ''
    }
  }, [visible])

  if (!visible) return null

  const close = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Stockage indisponible (navigation privée) : la suggestion se ferme pour cette page.
    }
    setVisible(false)
  }

  return (
    <aside
      ref={bar}
      lang={target}
      aria-label={text}
      className="fixed inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-x-24 gap-y-8 border-t border-sapin-20 bg-pierre px-margin py-12 text-body-s text-encre"
    >
      <p>{text}</p>
      <Link
        href={switchLocalePath(pathname, target)}
        hrefLang={target}
        className="inline-flex min-h-touch items-center underline decoration-or decoration-1 underline-offset-8"
      >
        {switchLabel}
      </Link>
      <button
        type="button"
        onClick={close}
        className="inline-flex min-h-touch cursor-pointer items-center underline decoration-sapin-20 decoration-1 underline-offset-8"
      >
        {closeLabel}
      </button>
    </aside>
  )
}
