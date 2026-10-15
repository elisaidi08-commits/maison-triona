'use client'

import { useEffect, useState } from 'react'
import type { PauseLabel } from './LoopVideo'
import { videoAllowed } from './videoConditions'
import { setVideosPaused, useVideosPaused } from './videoPause'

// Bouton de pause d'un groupe de vidéos (les trois services) : un seul contrôle, label 13 px en
// encre sur l'ivoire, cible de 48 px. N'existe que si les vidéos peuvent jouer (desktop, sans
// mouvement réduit, sans économie de données).

export function PauseVideosButton({ pause, play }: { pause: PauseLabel; play: PauseLabel }) {
  const paused = useVideosPaused()
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(videoAllowed())
  }, [])

  if (!shown) return null

  return (
    <button
      type="button"
      onClick={() => setVideosPaused(!paused)}
      aria-label={paused ? play.full : pause.full}
      className="inline-flex min-h-touch cursor-pointer items-center text-label text-encre uppercase transition-colors duration-micro ease-standard hover:text-cypres"
    >
      {paused ? play.visible : pause.visible}
    </button>
  )
}
