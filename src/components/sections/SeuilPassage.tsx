'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { videoAllowed } from '@/components/media/videoConditions'

// Passage « on entre » (D19, M15) : juste après le seuil, en desktop, la vidéo V01-s (avancée vers
// la fenêtre) suit le défilement sur environ 1,5 écran, collante. Purement visuel (aria-hidden).
// Sans JavaScript, en mobile ou en mouvement réduit, le passage n'existe pas : aucune hauteur vide.

export function SeuilPassage({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // Révélé seulement si la vidéo peut jouer ; inséré sous le premier écran (aucun décalage visible).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(videoAllowed())
  }, [])

  if (!shown) return null

  return (
    <div id="seuil-passage" aria-hidden="true" className="relative h-passage">
      <div className="sticky top-0 h-svh overflow-hidden bg-sapin">{children}</div>
    </div>
  )
}
