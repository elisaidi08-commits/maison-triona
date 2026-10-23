'use client'

import { useEffect, useRef, useState } from 'react'
import { afterLoad, videoAllowed } from './videoConditions'

// Vidéo pilotée par le défilement (docs/motion-spec.md M13 et M15) : sa position suit la
// progression de l'élément `trackId` dans l'écran. Défilement natif, jamais bloqué ; décorative
// (aria-hidden) ; desktop seulement, sinon le poster reste seul. Encodée toutes images clés.

type ScrubVideoProps = {
  src: string
  trackId: string
}

export function ScrubVideo({ src, trackId }: ScrubVideoProps) {
  const video = useRef<HTMLVideoElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!videoAllowed()) return
    const track = document.getElementById(trackId)
    if (!track) return
    // Après `load` seulement, puis à l'approche de l'élément suivi.
    let observer: IntersectionObserver | undefined
    const stop = afterLoad(() => {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            setEnabled(true)
            observer?.disconnect()
          }
        },
        { rootMargin: '50% 0px' },
      )
      observer.observe(track)
    })
    return () => {
      stop()
      observer?.disconnect()
    }
  }, [trackId])

  useEffect(() => {
    const element = video.current
    const track = document.getElementById(trackId)
    if (!enabled || !ready || !element || !track) return
    let frame = 0
    const update = () => {
      frame = 0
      const box = track.getBoundingClientRect()
      const span = box.height - window.innerHeight
      const progress =
        span > 0
          ? -box.top / span
          : (window.innerHeight - box.top) / (box.height + window.innerHeight)
      const clamped = Math.min(1, Math.max(0, progress))
      if (Number.isFinite(element.duration))
        element.currentTime = clamped * (element.duration - 0.05)
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
  }, [enabled, ready, trackId])

  if (!enabled) return null

  return (
    <video
      ref={video}
      aria-hidden="true"
      muted
      playsInline
      preload="auto"
      src={src}
      onLoadedData={() => setReady(true)}
      className={`absolute inset-0 size-full object-cover transition-opacity duration-hero ease-maison ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
    />
  )
}
