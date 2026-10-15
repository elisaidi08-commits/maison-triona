'use client'

import { useEffect } from 'react'

// Comportement du résumé d'erreurs : focus sur le résumé quand il apparaît, puis, à chaque lien
// suivi, focus sur le champ visé. Le champ est amené au milieu de l'écran, pour que son label (ou
// la question du groupe) reste visible au-dessus, sous l'en-tête. Sans JavaScript, l'ancre suffit.

type ErrorSummaryFocusProps = {
  summaryId: string
  focusOnMount: boolean
}

export function ErrorSummaryFocus({ summaryId, focusOnMount }: ErrorSummaryFocusProps) {
  useEffect(() => {
    const summary = document.getElementById(summaryId)
    if (!summary) return
    if (focusOnMount) summary.focus()

    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest('a[href^="#"]')
      if (!link) return
      const field = document.getElementById(decodeURIComponent(link.getAttribute('href')!.slice(1)))
      if (!(field instanceof HTMLElement)) return
      event.preventDefault()
      const block = field.closest('fieldset') ?? field.parentElement ?? field
      block.scrollIntoView({ block: 'center' })
      field.focus({ preventScroll: true })
    }

    summary.addEventListener('click', onClick)
    return () => summary.removeEventListener('click', onClick)
  }, [summaryId, focusOnMount])

  return null
}
