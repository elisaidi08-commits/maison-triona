'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { videoAllowed } from '@/components/media/videoConditions'
import { FILM_FIN } from './finDuFilm'

// Film d'entrée de l'accueil calme (prototype V5, D31, M18 ; l'idée de la référence « Lumina » de
// Sady, sans WebGL, sans script tiers ni image tierce). Avant l'accueil, quatre plans plein cadre :
// les trois services, puis la maison. Chaque plan s'ouvre en cercle depuis le centre ; la bande
// sapin du bas porte le numéro, le titre et la phrase du plan (jamais de texte sur l'image), les
// quatre plans (vrais boutons, la ligne du plan en cours se remplit) et deux commandes, « Pause » et
// « Passer » (WCAG 2.2.2). Au dernier plan, la scène se resserre sur l'image des portes de
// l'accueil : le visiteur arrive devant la maison, puis les portes s'ouvrent (OuverturePortes).
// L'accueil est rendu derrière dès le départ. Desktop seulement, sans mouvement réduit, avec
// JavaScript (variante `film-entree`) et sans économie de données ; sinon rien ne s'affiche.
// Fenêtre modale native : le reste de la page est inerte, Échap passe le film.

export type PlanFilm = {
  id: string
  title: string
  text: string
  image: ReactNode
}

type FilmAccueilProps = {
  plans: PlanFilm[]
  labels: { film: string; plans: string; pause: string; play: string; skip: string }
}

type Etat = 'attente' | 'film' | 'arrivee' | 'sortie' | 'fini'

// Format de P10 (16:9) et recadrage des portes dans l'accueil (`object-portes`, 67 % 50 %).
const FORMAT = 16 / 9
const PORTES_X = 0.67

const pad = (value: number) => String(value).padStart(2, '0')

export function FilmAccueil({ plans, labels }: FilmAccueilProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const scene = useRef<HTMLDivElement>(null)
  const portes = useRef<HTMLDivElement>(null)
  const skipButton = useRef<HTMLButtonElement>(null)
  const [etat, setEtat] = useState<Etat>('attente')
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const last = plans.length - 1

  const fermer = useCallback(() => {
    const element = dialog.current
    if (element?.open) element.close()
    document.documentElement.style.overflow = ''
    setEtat('fini')
    window.dispatchEvent(new Event(FILM_FIN))
  }, [])

  const passer = useCallback(() => {
    setEtat('sortie')
    window.setTimeout(fermer, 320)
  }, [fermer])

  // Arrivée : l'image des portes, qui remplit la scène, rejoint exactement sa place dans
  // l'accueil (même échelle, même recadrage), pendant que l'aplat et la bande s'effacent.
  const arriver = useCallback(() => {
    const element = dialog.current
    const area = scene.current
    const doors = portes.current
    window.scrollTo(0, 0)
    const target = document.querySelector('[data-accueil-portes]')?.getBoundingClientRect()
    if (!element || !area || !doors || !target || target.width === 0) {
      passer()
      return
    }
    const box = area.getBoundingClientRect()
    const width = Math.max(box.width, box.height * FORMAT)
    const left = (box.width - width) / 2
    const top = (box.height - width / FORMAT) / 2
    Object.assign(doors.style, {
      inset: 'auto',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${width / FORMAT}px`,
    })
    area.style.bottom = '0px'
    area.style.clipPath = `inset(0px 0px ${window.innerHeight - box.bottom}px 0px)`
    const targetWidth = Math.max(target.width, target.height * FORMAT)
    const x = target.left + (target.width - targetWidth) * PORTES_X
    const y = target.top + (target.height - targetWidth / FORMAT) / 2
    requestAnimationFrame(() => {
      element.dataset.etat = 'arrivee'
      setEtat('arrivee')
      void area.offsetWidth
      area.style.clipPath = `inset(${target.top}px ${window.innerWidth - target.right}px ${
        window.innerHeight - target.bottom
      }px ${target.left}px)`
      doors.style.transform = `translate(${x - left}px, ${y - top}px) scale(${targetWidth / width})`
      window.setTimeout(fermer, 1500)
    })
  }, [fermer, passer])

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (getComputedStyle(element).display === 'none' || !videoAllowed()) {
      fermer()
      return
    }
    window.scrollTo(0, 0)
    document.documentElement.style.overflow = 'hidden'
    if (!element.open) element.showModal()
    skipButton.current?.focus()
    setEtat('film')
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [fermer])

  if (etat === 'fini') return null

  const suivant = () => (index < last ? setIndex(index + 1) : arriver())
  const current = plans[index]!
  const command =
    'inline-flex min-h-touch cursor-pointer items-center text-label text-ivoire uppercase underline decoration-champagne decoration-1 underline-offset-8'

  return (
    <dialog
      ref={dialog}
      data-film-accueil
      data-etat={etat}
      data-pause={paused ? '' : undefined}
      aria-label={labels.film}
      onCancel={(event) => {
        event.preventDefault()
        passer()
      }}
      className={`fixed inset-0 z-50 m-0 hidden size-full max-h-none max-w-none overflow-hidden border-0 p-0 text-ivoire backdrop:bg-transparent film-entree:block ${
        etat === 'attente' ? 'animate-film-secours' : ''
      }`}
    >
      <div
        ref={scene}
        data-scene
        className="absolute inset-x-0 top-0 bottom-bande-film overflow-hidden"
      >
        {plans.map((plan, position) => (
          <div
            key={plan.id}
            data-plan={position <= index ? 'vu' : 'a-venir'}
            className="absolute inset-0"
          >
            <div
              ref={position === last ? portes : undefined}
              data-scene-portes={position === last ? '' : undefined}
              className="absolute inset-0 origin-top-left"
            >
              {plan.image}
            </div>
          </div>
        ))}
      </div>

      <div
        data-bande
        data-surface="sapin"
        className="absolute inset-x-0 bottom-0 flex h-bande-film items-center gap-48 px-margin"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-8">
          <p aria-hidden="true" className="text-label text-champagne">
            {pad(index + 1)} / {pad(plans.length)}
          </p>
          <p key={`titre-${index}`} className="animate-entree font-display text-title-h2">
            {current.title}
          </p>
          <p key={`texte-${index}`} className="animate-entree text-ivoire-80">
            {current.text}
          </p>
        </div>

        <div className="flex w-7/12 shrink-0 flex-col gap-16">
          <ol aria-label={labels.plans} className="grid grid-cols-4 gap-gutter">
            {plans.map((plan, position) => (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => setIndex(position)}
                  aria-current={position === index ? 'step' : undefined}
                  className="flex min-h-touch w-full cursor-pointer flex-col items-start gap-12 pt-12 text-left text-label uppercase"
                >
                  <span aria-hidden="true" className="relative block h-px w-full bg-sauge">
                    <span
                      data-progression={position === index ? '' : undefined}
                      onAnimationEnd={position === index ? suivant : undefined}
                      style={{ animationPlayState: paused ? 'paused' : 'running' }}
                      className={`absolute inset-0 origin-left bg-champagne ${
                        position === index
                          ? 'animate-progression'
                          : position > index
                            ? 'scale-x-0'
                            : ''
                      }`}
                    />
                  </span>
                  <span className={position === index ? 'text-ivoire' : 'text-ivoire-80'}>
                    {plan.title}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex justify-end gap-32">
            <button type="button" onClick={() => setPaused(!paused)} className={command}>
              {paused ? labels.play : labels.pause}
            </button>
            <button ref={skipButton} type="button" onClick={passer} className={command}>
              {labels.skip}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  )
}
