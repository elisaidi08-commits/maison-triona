'use client'

import { useEffect, useRef, useState } from 'react'
import { videoAllowed } from '@/components/media/videoConditions'

// Prototype V5 : filet or de 1 px, collé en haut de l'écran pendant le film d'entrée, qui suit sa
// progression (de l'ouverture à la demande particulière). Décoratif (aria-hidden), transform
// seulement. Mêmes conditions que les vidéos du film : desktop, mouvement autorisé, sans économie de
// données ; sinon rien ne s'affiche. Le conteneur garde 1 px, compensé par sa marge : aucun décalage.

export function FilmProgress({ trackId }: { trackId: string }) {
  const bar = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(videoAllowed())
  }, [])

  useEffect(() => {
    const element = bar.current
    const track = document.getElementById(trackId)
    if (!shown || !element || !track) return
    let frame = 0
    const update = () => {
      frame = 0
      const box = track.getBoundingClientRect()
      const span = box.height - window.innerHeight
      const progress = span > 0 ? Math.min(1, Math.max(0, -box.top / span)) : 0
      element.style.transform = `scaleX(${progress})`
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [shown, trackId])

  return (
    <div aria-hidden="true" className="sticky top-0 z-20 -mb-px h-px">
      {shown ? (
        <span
          ref={bar}
          className="block h-px origin-left bg-or"
          style={{ transform: 'scaleX(0)' }}
        />
      ) : null}
    </div>
  )
}
