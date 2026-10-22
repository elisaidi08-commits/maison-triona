'use client'

import Image, { type StaticImageData } from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { videoAllowed } from '@/components/media/videoConditions'

// Prototype V5, section 1 (choix de Sady, 22/10/2026, d'après un composant de parallaxe par
// calques) : un voilage de lin au premier plan, sur les deux bords du cadre, plus proche que les
// portes. En défilant, les deux pans s'écartent et sortent du cadre pendant que les portes
// s'ouvrent : on passe à travers. Le pan gauche reste étroit pour ne jamais passer sous le titre
// (le voile du titre est mesuré sans lui). Défilement natif, transform seulement, aucune
// bibliothèque. Décoratif (aria-hidden). Desktop et mouvement autorisé ; sinon rien.

type ParallaxForegroundProps = {
  trackId: string
  curtain: StaticImageData
  // Part de la piste (0 à 1) au bout de laquelle les pans sont sortis du cadre.
  until?: number
}

export function ParallaxForeground({ trackId, curtain, until = 0.45 }: ParallaxForegroundProps) {
  const left = useRef<HTMLDivElement>(null)
  const right = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShown(videoAllowed())
  }, [])

  useEffect(() => {
    const track = document.getElementById(trackId)
    if (!shown || !track || !left.current || !right.current) return
    const panes = [left.current, right.current]
    let frame = 0
    const update = () => {
      frame = 0
      const box = track.getBoundingClientRect()
      const span = box.height - window.innerHeight
      const progress = span > 0 ? Math.min(1, Math.max(0, -box.top / span)) : 0
      const out = Math.min(1, progress / until)
      panes[0]!.style.transform = `translateX(${-out * 105}%)`
      panes[1]!.style.transform = `translateX(${out * 105}%)`
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
  }, [shown, trackId, until])

  if (!shown) return null

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div ref={left} className="absolute inset-y-0 left-0 w-voilage-etroit">
        <Image src={curtain} alt="" fill sizes="10vw" className="object-cover object-right" />
      </div>
      <div ref={right} className="absolute inset-y-0 right-0 w-voilage">
        <Image
          src={curtain}
          alt=""
          fill
          sizes="20vw"
          className="-scale-x-100 object-cover object-right"
        />
      </div>
    </div>
  )
}
