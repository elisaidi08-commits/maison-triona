'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { videoAllowed } from '@/components/media/videoConditions'

// Prototype V5 : raccord sans couture entre l'ouverture et la pièce de la conciergerie. La pièce
// chevauche le dernier écran de l'ouverture (`raccord-film`, tokens.css) ; son image reste masquée
// tant que la pièce n'est pas arrivée en haut de l'écran : sa légende monte seule par-dessus la fin
// du plan de liaison. Quand l'image apparaît, l'ouverture est sur sa dernière image, identique à la
// première du geste : le changement ne se voit pas. Desktop, conditions vidéo ; sinon l'image reste
// toujours visible (la pièce glisse comme les autres).

export function RaccordFilm({
  sectionId,
  className,
  children,
}: {
  sectionId: string
  className: string
  children: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const section = document.getElementById(sectionId)
    if (!section || !videoAllowed()) return
    let frame = 0
    const update = () => {
      frame = 0
      setHidden(section.getBoundingClientRect().top > 0.5)
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
  }, [sectionId])

  return (
    <div ref={box} className={`${className} ${hidden ? 'opacity-0' : ''}`}>
      {children}
    </div>
  )
}
