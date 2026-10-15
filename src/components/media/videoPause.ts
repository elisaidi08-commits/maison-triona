'use client'

import { useEffect, useState } from 'react'

// Pause partagée par toutes les vidéos de la page (WCAG 2.2.2, docs/motion-spec.md M14) : un seul
// choix, mémorisé pour la session et diffusé aux autres vidéos. Un bouton peut ainsi arrêter un
// groupe de vidéos (les trois services) et la pause du hero vaut aussi pour la suite de la page.

const PAUSED_KEY = 'mt-videos-en-pause'
const EVENT = 'mt-videos-pause'

function readPaused(): boolean {
  try {
    return sessionStorage.getItem(PAUSED_KEY) === '1'
  } catch {
    return false
  }
}

export function setVideosPaused(paused: boolean) {
  try {
    sessionStorage.setItem(PAUSED_KEY, paused ? '1' : '0')
  } catch {
    // Stockage indisponible : le choix vaut pour cette page.
  }
  window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: paused }))
}

export function useVideosPaused(): boolean {
  const [paused, setPaused] = useState(false)
  useEffect(() => {
    // Préférence de la session lue après le montage (état local, aucune donnée envoyée).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaused(readPaused())
    const onChange = (event: Event) => setPaused((event as CustomEvent<boolean>).detail)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])
  return paused
}
