'use client'

import { useEffect, useRef, useState } from 'react'
import { afterLoad, videoAllowed } from './videoConditions'
import { setVideosPaused, useVideosPaused } from './videoPause'

// Vidéo en boucle posée sur son poster (docs/motion-spec.md M10, M14). Décorative (aria-hidden),
// muette, chargée après `load` puis seulement près de l'écran ; elle ne joue que visible.
// Pause obligatoire (WCAG 2.2.2), partagée par toutes les vidéos et mémorisée pour la session
// (videoPause.ts). Bouton discret (label 13 px, cible de 48 px) : sur un aplat sapin posé sur l'image
// (`overlay`), sous l'image en encre sur l'ivoire (`below`), ou absent quand un bouton de groupe le
// remplace (`none`, PauseVideosButton). Le nom accessible complet contient le mot visible (WCAG
// 2.5.3) ; il change avec l'état, sans aria-pressed (un seul signal).

export type PauseLabel = { visible: string; full: string }

type LoopVideoProps = {
  mp4: string
  webm: string
  pause: PauseLabel
  play: PauseLabel
  // Même recadrage que le poster, pour que le fondu de l'un à l'autre ne se voie pas.
  anchor?: 'center' | 'seuil'
  controls?: 'overlay' | 'below' | 'none'
}

export function LoopVideo({
  mp4,
  webm,
  pause,
  play,
  anchor = 'center',
  controls = 'overlay',
}: LoopVideoProps) {
  const video = useRef<HTMLVideoElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)
  const paused = useVideosPaused()

  useEffect(() => {
    if (!videoAllowed()) return
    return afterLoad(() => setEnabled(true))
  }, [])

  useEffect(() => {
    const element = video.current
    if (!enabled || !element) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !paused) {
          if (element.preload !== 'auto') element.preload = 'auto'
          void element.play().catch(() => {})
        } else {
          element.pause()
        }
      },
      { rootMargin: '25% 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled, paused])

  if (!enabled) return null

  return (
    <>
      <video
        ref={video}
        aria-hidden="true"
        muted
        loop
        playsInline
        preload="none"
        onCanPlay={() => setReady(true)}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-hero ease-maison ${
          anchor === 'seuil' ? 'object-seuil' : 'object-center'
        } ${ready ? 'opacity-100' : 'opacity-0'}`}
      >
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
      </video>
      {controls === 'none' ? null : (
        <button
          type="button"
          onClick={() => setVideosPaused(!paused)}
          aria-label={paused ? play.full : pause.full}
          className={`absolute right-margin z-10 inline-flex min-h-touch cursor-pointer items-center text-label uppercase ${
            controls === 'below'
              ? 'top-full text-encre transition-colors duration-micro ease-standard hover:text-cypres'
              : 'focus-sur-image bottom-24 bg-sapin px-16 text-ivoire'
          }`}
        >
          {paused ? play.visible : pause.visible}
        </button>
      )}
    </>
  )
}
