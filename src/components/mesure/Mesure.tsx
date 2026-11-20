'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { cheminMesurable, referentExterne } from '@/lib/mesure/evenements'

// Mesure d'audience (story 5.2) : une page vue à chaque changement de page, et les événements de la
// liste fermée portés par `data-mesure` (choix d'entrée, langue, partage), relevés par un seul
// écouteur délégué : aucun composant serveur ne devient client. Envoi à notre domaine seulement
// (`/api/m`, sendBeacon, texte JSON), jamais à un tiers ; le serveur filtre et transmet.
// Filtré ici avec les mêmes fonctions pures que le serveur, qui filtre de nouveau : un chemin exclu
// (lien personnel de réservation, avec son jeton) ne quitte jamais le navigateur, et le référent
// n'est envoyé qu'à l'arrivée sur le site, réduit à l'origine d'un site externe.
// Rendu seulement si la mesure est configurée (PLAUSIBLE_DOMAIN) ; sans JavaScript, rien n'est
// compté.

function envoyer(corps: { e: string; p: string; r?: string }): void {
  if (cheminMesurable(corps.p) === null) return
  try {
    const donnees = new Blob([JSON.stringify(corps)], { type: 'text/plain' })
    if (navigator.sendBeacon?.('/api/m', donnees)) return
    void fetch('/api/m', { method: 'POST', body: donnees, keepalive: true, credentials: 'omit' })
  } catch {
    // Mesure perdue : rien d'autre à faire.
  }
}

export function Mesure() {
  const pathname = usePathname()
  const arrivee = useRef(true)

  useEffect(() => {
    if (!pathname) return
    const referent = arrivee.current
      ? referentExterne(document.referrer, window.location.origin)
      : null
    arrivee.current = false
    envoyer(referent ? { e: 'pageview', p: pathname, r: referent } : { e: 'pageview', p: pathname })
  }, [pathname])

  useEffect(() => {
    const surClic = (event: MouseEvent) => {
      const cible = event.target instanceof Element ? event.target.closest('[data-mesure]') : null
      const code = cible?.getAttribute('data-mesure')
      if (code) envoyer({ e: code, p: window.location.pathname })
    }
    document.addEventListener('click', surClic, { capture: true })
    return () => document.removeEventListener('click', surClic, { capture: true })
  }, [])

  return null
}
