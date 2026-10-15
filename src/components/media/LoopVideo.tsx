'use client'

import { useEffect, useRef, useState } from 'react'
import { afterLoad, videoAllowed } from './videoConditions'

// Vidéo en boucle posée sur son poster (docs/motion-spec.md M10, M14). Décorative (aria-hidden),
// muette, chargée après `load` puis seulement près de l'écran ; elle ne joue que visible (une seule
// vidéo à la fois en pratique). Bouton pause obligatoire (WCAG 2.2.2), choix mémorisé pour la session :
// discret (label 13 px en bas à droite, sur la marge), mais cible de 48 px : sur un aplat sapin dans
// le hero, sous l'image, en encre sur l'ivoire, ailleurs (`controls="below"`). Le nom accessible complet
// contient le mot visible (WCAG 2.5.3) ; il change avec l'état, sans aria-pressed (un seul signal).

const PAUSED_KEY = 'mt-videos-en-pause'

type Label = { visible: string; full: string }

type LoopVideoProps = {
  mp4: string
  webm: string
  pause: Label
  play: Label
  // Même recadrage que le poster, pour que le fondu de l'un à l'autre ne se voie pas.
  anchor?: 'center' | 'seuil'
  // Bouton posé sur l'image (hero) ou sous l'image, sur l'ivoire (le conteneur ne coupe pas ce qui dépasse).
  controls?: 'overlay' | 'below'
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
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!videoAllowed()) return
    let pausedBefore = false
    try {
      pausedBefore = sessionStorage.getItem(PAUSED_KEY) === '1'
    } catch {
      pausedBefore = false
    }
    return afterLoad(() => {
      setPaused(pausedBefore)
      setEnabled(true)
    })
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

  const toggle = () => {
    const next = !paused
    setPaused(next)
    try {
      sessionStorage.setItem(PAUSED_KEY, next ? '1' : '0')
    } catch {
      // Stockage indisponible : le choix vaut pour cette page.
    }
    if (next) video.current?.pause()
    else void video.current?.play().catch(() => {})
  }

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
      <button
        type="button"
        onClick={toggle}
        aria-label={paused ? play.full : pause.full}
        className={`absolute right-margin z-0 inline-flex min-h-touch cursor-pointer items-center text-label uppercase ${
          controls === 'below'
            ? 'top-full text-encre transition-colors duration-micro ease-standard hover:text-cypres'
            : 'focus-sur-image bottom-24 bg-sapin px-16 text-ivoire'
        }`}
      >
        {paused ? play.visible : pause.visible}
      </button>
    </>
  )
}
