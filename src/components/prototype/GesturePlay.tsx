'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { PauseLabel } from '@/components/media/LoopVideo'
import { afterLoad, videoAllowed } from '@/components/media/videoConditions'

// Prototype V5, l'attention : le geste d'accueil (plan 03, une main pose un bouquet), lu une seule
// fois quand il entre dans l'écran, puis arrêté sur sa dernière image. Desktop seulement ; sinon
// (mobile, mouvement réduit, économie de données, sans JavaScript), la dernière image seule, rendue
// par le serveur (`children`) : la version fixe est complète. Décorative (aria-hidden) ; le bouton
// (WCAG 2.2.2) met en pause, relance, puis propose « Revoir » ; posé sous l'image, dans l'espace
// réservé par la section (aucun décalage), ou sur un aplat sapin dans l'image quand elle remplit
// son conteneur (`fill`, chapitre du film d'entrée). La pause vaut pour cette page seulement, rien
// n'est mémorisé. Hors de l'écran, la lecture s'interrompt et reprend au retour.

type GesturePlayProps = {
  src: string
  // Première image du clip, affichée avant la lecture (même fichier que la vidéo, aucun saut).
  poster: string
  pause: PauseLabel
  play: PauseLabel
  replay: PauseLabel
  // Remplit son conteneur (image plein écran) au lieu d'un cadre 16:9 ; bouton posé sur l'image.
  fill?: boolean
  children: ReactNode
}

export function GesturePlay({
  src,
  poster,
  pause,
  play,
  replay,
  fill = false,
  children,
}: GesturePlayProps) {
  const video = useRef<HTMLVideoElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [ended, setEnded] = useState(false)
  const userPausedRef = useRef(false)

  useEffect(() => {
    if (!videoAllowed()) return
    return afterLoad(() => setEnabled(true))
  }, [])

  useEffect(() => {
    const element = video.current
    if (!enabled || !element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          if (!userPausedRef.current && !element.ended) void element.play().catch(() => {})
        } else if (!element.paused) {
          element.pause()
        }
      },
      { threshold: 0.6 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled])

  const toggle = () => {
    const element = video.current
    if (!element) return
    if (ended) {
      element.currentTime = 0
      setEnded(false)
      userPausedRef.current = false
      setUserPaused(false)
      void element.play().catch(() => {})
    } else if (userPaused) {
      userPausedRef.current = false
      setUserPaused(false)
      void element.play().catch(() => {})
    } else {
      userPausedRef.current = true
      setUserPaused(true)
      element.pause()
    }
  }

  const label = ended ? replay : userPaused ? play : pause

  return (
    <div className={fill ? 'absolute inset-0 bg-sapin' : 'relative aspect-hero bg-sapin'}>
      {children}
      {enabled ? (
        <>
          <video
            ref={video}
            aria-hidden="true"
            muted
            playsInline
            preload="auto"
            poster={poster}
            src={src}
            onLoadedData={() => setReady(true)}
            onEnded={() => setEnded(true)}
            className={`absolute inset-0 size-full object-cover transition-opacity duration-hero ease-maison ${
              ready ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <button
            type="button"
            onClick={toggle}
            aria-label={label.full}
            className={
              fill
                ? 'focus-sur-image absolute right-margin bottom-24 z-10 inline-flex min-h-touch cursor-pointer items-center bg-sapin px-16 text-label text-ivoire uppercase'
                : 'absolute top-full right-0 inline-flex min-h-touch cursor-pointer items-center text-label text-encre uppercase transition-colors duration-micro ease-standard hover:text-cypres'
            }
          >
            {label.visible}
          </button>
        </>
      ) : null}
    </div>
  )
}
