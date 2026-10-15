'use client'

import { useEffect } from 'react'

// M12 (docs/motion-spec.md) : après un choix d'entrée (#conciergerie…), le focus va sur le titre
// de la scène (tabIndex -1), sans second défilement. Sans JavaScript, l'ancre fonctionne seule.

export function AnchorFocus() {
  useEffect(() => {
    const focusTarget = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      if (!id) return
      document.getElementById(`${id}-titre`)?.focus({ preventScroll: true })
    }
    window.addEventListener('hashchange', focusTarget)
    return () => window.removeEventListener('hashchange', focusTarget)
  }, [])
  return null
}
