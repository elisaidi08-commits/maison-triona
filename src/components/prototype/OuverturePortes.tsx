'use client'

import { useEffect, useRef, useState } from 'react'
import { afterLoad, videoAllowed } from '@/components/media/videoConditions'

// Accueil calme du prototype : les portes de P10 s'ouvrent une seule fois après le chargement (V10,
// 5 s, muette, décorative), puis la dernière image reste. Cinq secondes au plus, sans boucle :
// aucun bouton pause n'est exigé (WCAG 2.2.2). Desktop seulement, sans mouvement réduit ni économie
// de données ; sinon l'image fixe suffit. Même recadrage que P10, dont le premier cadre est la copie
// (écart moyen 1,8 niveau) : le passage de l'image à la vidéo ne se voit pas.

export function OuverturePortes({ src }: { src: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!videoAllowed()) return
    return afterLoad(() => setEnabled(true))
  }, [])

  useEffect(() => {
    if (enabled) void video.current?.play().catch(() => {})
  }, [enabled])

  if (!enabled) return null

  return (
    <video
      ref={video}
      aria-hidden="true"
      muted
      playsInline
      preload="auto"
      onPlaying={() => setPlaying(true)}
      className={`absolute inset-0 size-full object-cover object-portes transition-opacity duration-reveal ease-maison ${
        playing ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <source src={src} type="video/mp4" />
    </video>
  )
}
