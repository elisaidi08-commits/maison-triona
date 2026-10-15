'use client'

import { useEffect, useRef, useState } from 'react'
import { afterLoad, videoAllowed } from './videoConditions'

// Vidéo en boucle posée sur son poster (docs/motion-spec.md M10, M14). Décorative (aria-hidden),
// muette, chargée après `load` puis seulement près de l'écran ; elle ne joue que visible (une seule
// vidéo à la fois en pratique). Bouton pause obligatoire (WCAG 2.2.2), choix mémorisé pour la session.

const PAUSED_KEY = 'mt-videos-en-pause'

type LoopVideoProps = {
  mp4: string
  webm: string
  pauseLabel: string
  playLabel: string
}

export function LoopVideo({ mp4, webm, pauseLabel, playLabel }: LoopVideoProps) {
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
          ready ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
      </video>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={paused}
        className="absolute top-24 right-24 z-0 inline-flex min-h-touch cursor-pointer items-center bg-sapin px-16 text-body-s text-ivoire"
      >
        {paused ? playLabel : pauseLabel}
      </button>
    </>
  )
}
