'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BUTTON_CLASSES } from '@/components/ui/Button'
import { videoAllowed } from '@/components/media/videoConditions'

// Ouverture de l'accueil (D25) : film d'environ 20 s posé sur toute la page, une fois par visite.
// Desktop, dans les conditions vidéo : un seul fichier monté, les légendes suivent son minutage.
// Mobile, mouvement réduit, économie de données ou vidéo en erreur : les mêmes plans en photos
// (le fondu disparaît en mouvement réduit, règle globale). Fenêtre modale : le reste de la page
// est inerte et le défilement bloqué ; « Passer », Échap ou « Entrer » la referment, le focus va
// alors au titre de l'accueil. Pause obligatoire (WCAG 2.2.2). Texte toujours en grand corps sur
// un voile sapin à 60 % (contraste garanti quelle que soit l'image). Sans JavaScript, ou déjà vue
// pendant la visite, elle n'apparaît pas (tokens.css, script en tête de page).

const SEEN_KEY = 'mt-ouverture-vue'
const IMAGE_SECONDS = 3.5
const LEAVE_MS = 700

type ImageSource = {
  src: string
  srcSet?: string
  width?: number | string
  height?: number | string
}

export type FilmPlan = {
  kind: 'brand' | 'line'
  text: string
  desktop: ImageSource
  mobile: ImageSource
}

type Labels = {
  dialog: string
  summary: string
  skip: string
  enter: string
  pause: string
  play: string
}

type OuvertureFilmProps = {
  plans: FilmPlan[]
  brand: string
  mp4: string
  webm: string
  planSeconds: number
  labels: Labels
}

export function OuvertureFilm({
  plans,
  brand,
  mp4,
  webm,
  planSeconds,
  labels,
}: OuvertureFilmProps) {
  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const firstControl = useRef<HTMLButtonElement>(null)
  const enterButton = useRef<HTMLButtonElement>(null)
  const closed = useRef(false)
  const [open, setOpen] = useState(true)
  const [leaving, setLeaving] = useState(false)
  const [mode, setMode] = useState<'video' | 'images' | null>(null)
  const [index, setIndex] = useState(0)
  const [ended, setEnded] = useState(false)
  const [paused, setPaused] = useState(false)
  const [playing, setPlaying] = useState(false)

  const close = useCallback(() => {
    try {
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      // Stockage indisponible : l'ouverture reviendra à la prochaine visite de l'accueil.
    }
    video.current?.pause()
    closed.current = true
    setLeaving(true)
  }, [])

  // Déjà vue pendant la visite : rien. Sinon, mode vidéo ou photos selon les conditions.
  useEffect(() => {
    if (document.documentElement.dataset.ouverture === 'vue') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false)
      return
    }
    setMode(videoAllowed() ? 'video' : 'images')
  }, [])

  // Fenêtre modale : reste de la page inerte, défilement bloqué, focus sur le premier contrôle.
  useEffect(() => {
    const overlay = root.current
    if (!open || !overlay || document.documentElement.dataset.ouverture === 'vue') return
    const inerted: Element[] = []
    let node: Element = overlay
    while (node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && !sibling.hasAttribute('inert') && sibling.tagName !== 'SCRIPT') {
          sibling.setAttribute('inert', '')
          inerted.push(sibling)
        }
      }
      if (node.parentElement === document.body) break
      node = node.parentElement
    }
    const html = document.documentElement
    html.style.overflow = 'hidden'
    firstControl.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      for (const element of inerted) element.removeAttribute('inert')
      html.style.overflow = ''
      document.removeEventListener('keydown', onKey)
      // La page n'est plus inerte : le focus peut aller au titre de l'accueil.
      if (closed.current) document.getElementById('seuil-titre')?.focus({ preventScroll: true })
    }
  }, [open, close])

  // Photos : un plan toutes les 3,5 s, arrêtées par la pause.
  useEffect(() => {
    if (mode !== 'images' || paused || ended || leaving) return
    const timer = window.setTimeout(() => {
      if (index < plans.length - 1) setIndex(index + 1)
      else setEnded(true)
    }, IMAGE_SECONDS * 1000)
    return () => window.clearTimeout(timer)
  }, [mode, paused, ended, leaving, index, plans.length])

  // Fin du film : le bouton « Entrer » prend le focus.
  useEffect(() => {
    if (ended) enterButton.current?.focus()
  }, [ended])

  // Sortie : fondu, puis la page reprend la main (focus sur le titre de l'accueil).
  useEffect(() => {
    if (!leaving) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(
      () => {
        document.documentElement.dataset.ouverture = 'vue'
        setOpen(false)
      },
      reduced ? 0 : LEAVE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [leaving])

  if (!open) return null

  const togglePause = () => {
    const next = !paused
    setPaused(next)
    if (mode === 'video') {
      if (next) video.current?.pause()
      else void video.current?.play().catch(() => {})
    }
  }

  const showImages = mode === 'images' || !playing

  return (
    <div
      ref={root}
      data-ouverture
      role="dialog"
      aria-modal="true"
      aria-label={labels.dialog}
      className={`fixed inset-0 z-40 overflow-hidden bg-sapin text-ivoire transition-opacity duration-hero ease-maison ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {plans.map((plan, i) =>
        i === 0 || mode === 'images' ? (
          <picture key={i}>
            <source media="(min-width: 64rem)" srcSet={plan.desktop.srcSet} />
            <img
              src={plan.mobile.src}
              srcSet={plan.mobile.srcSet}
              sizes="100vw"
              width={plan.mobile.width}
              height={plan.mobile.height}
              alt=""
              aria-hidden="true"
              decoding="async"
              {...(i === 0 ? { fetchPriority: 'high' as const } : {})}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-hero ease-maison ${
                showImages && (i === index || (mode !== 'images' && i === 0))
                  ? 'opacity-100'
                  : 'opacity-0'
              }`}
            />
          </picture>
        ) : null,
      )}

      {mode === 'video' ? (
        <video
          ref={video}
          aria-hidden="true"
          muted
          autoPlay
          playsInline
          preload="auto"
          onPlaying={() => setPlaying(true)}
          onTimeUpdate={(event) =>
            setIndex(
              Math.min(plans.length - 1, Math.floor(event.currentTarget.currentTime / planSeconds)),
            )
          }
          onEnded={() => setEnded(true)}
          onError={() => setMode('images')}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-hero ease-maison ${
            playing ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <source src={webm} type="video/webm" />
          <source src={mp4} type="video/mp4" />
        </video>
      ) : null}

      <div aria-hidden="true" className="absolute inset-0 bg-voile" />

      <p className="sr-only">{labels.summary}</p>

      <div aria-hidden="true" className="absolute inset-0">
        {plans.map((plan, i) => (
          <div
            key={i}
            className={`absolute inset-0 flex items-center justify-center px-margin text-center transition-opacity duration-hero ease-maison ${
              i === index && !ended ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {plan.kind === 'brand' ? (
              <p className="font-display text-marque">{plan.text}</p>
            ) : (
              <p className="max-w-titre font-display text-display-xl text-balance">{plan.text}</p>
            )}
          </div>
        ))}
      </div>

      {ended ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-48 px-margin text-center">
          <p aria-hidden="true" className="font-display text-marque">
            {brand}
          </p>
          <button
            ref={enterButton}
            type="button"
            onClick={close}
            className={`${BUTTON_CLASSES} cursor-pointer bg-sapin`}
          >
            <span className="filet-survol">{labels.enter}</span>
          </button>
        </div>
      ) : null}

      <div className="absolute right-margin bottom-24 flex gap-8">
        {ended ? null : (
          <button
            ref={firstControl}
            type="button"
            onClick={togglePause}
            className="focus-sur-image inline-flex min-h-touch cursor-pointer items-center bg-sapin px-16 text-label uppercase"
          >
            {paused ? labels.play : labels.pause}
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className="focus-sur-image inline-flex min-h-touch cursor-pointer items-center bg-sapin px-16 text-label uppercase"
        >
          {labels.skip}
        </button>
      </div>
    </div>
  )
}
