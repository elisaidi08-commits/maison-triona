'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { videoAllowed } from '@/components/media/videoConditions'

// Prototype V5, le franchissement : juste après l'invitation, en desktop, les plans 01 et 02
// enchaînés (les portes s'ouvrent, on passe le seuil, on sort au jardin) suivent le défilement sur
// deux écrans, l'image collée sur un. Même mécanique que le passage de l'accueil (SeuilPassage,
// M15) ; purement visuel (aria-hidden). Sans JavaScript, en mobile ou en mouvement réduit, il n'existe
// pas : aucune hauteur vide, la page passe de l'invitation à l'attention. La vidéo (ScrubVideo) suit
// l'élément `franchissement`.

export function ThresholdScrub({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // Révélé seulement si la vidéo peut jouer ; inséré sous le premier écran (aucun décalage visible).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(videoAllowed())
  }, [])

  if (!shown) return null

  return (
    <div id="franchissement" aria-hidden="true" className="relative h-franchissement">
      <div className="sticky top-0 h-svh overflow-hidden bg-sapin">{children}</div>
    </div>
  )
}
