'use client'

import { useEffect } from 'react'

// FAQ (story 2.8) : la question visée par l'ancre (`/fr/faq#delai`) s'ouvre à l'arrivée et quand
// l'ancre change. Sans JavaScript, l'ancre mène à la question, qui s'ouvre d'un clic.

export function FaqAnchorOpener() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      const target = id ? document.getElementById(id) : null
      if (target instanceof HTMLDetailsElement) target.open = true
    }
    open()
    window.addEventListener('hashchange', open)
    return () => window.removeEventListener('hashchange', open)
  }, [])
  return null
}
