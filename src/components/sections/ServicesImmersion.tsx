'use client'

import Image, { type StaticImageData } from 'next/image'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { PauseLabel } from '@/components/media/LoopVideo'
import { afterLoad, videoAllowed } from '@/components/media/videoConditions'
import { setVideosPaused, useVideosPaused } from '@/components/media/videoPause'
import { Button } from '@/components/ui/Button'

// M23 (D56, D58 ; idées de « Scroll Gallery » et de « Split Photo Slider » collées par Sady,
// reprises dans nos règles) : les trois services de la page Services en une scène plein écran,
// collante, que le défilement de la page (natif, jamais capturé) fait avancer.
// - À gauche, l'image du service, puis sa vidéo : le geste (la main qui pose les fleurs, la page
//   qui tourne, le romarin dans le verre) joue une fois quand le service arrive, en fondu sur
//   l'image, et s'arrête sur sa dernière image. Le service suivant se dévoile par bandes
//   horizontales, de haut en bas, pendant que son image se resserre (1,12 → 1) (idée de la galerie).
// - À droite, sur aplat sapin, le texte : compteur 01 / 03 barré d'un filet, nom, promesse, ce que
//   la maison fait, bouton vers la page. Au changement, le texte sort par le haut et le suivant
//   monte (idée du panneau partagé). Jamais de texte sur l'image.
// - Sur la jointure, trois vignettes carrées (rayon 0) ; en bas, un filet champagne de progression
//   et la pause des vidéos (WCAG 2.2.2, partagée avec les autres vidéos du site).
// Fluidité : la scène ne suit pas le défilement au cran près, elle le rattrape en douceur
// (rapprochement exponentiel, environ une demi-seconde), comme un « scrub » amorti.
// Ce composant ne fait que lire le défilement et poser l'état de chaque service ; le reste est en
// CSS (tokens.css, bloc M23 ; transform, opacity et masque seulement).
// Hors desktop avec souris, sans JavaScript ou en mouvement réduit : services empilés (image, puis
// texte), sans vignettes ni vidéo ; le contenu est le même.

export type PlanService = {
  anchor: string
  number: string
  name: string
  promise: string
  need: string
  link: string
  href: string
  image: StaticImageData
  alt: string
  video?: { mp4: string; webm: string }
}

type ServicesImmersionProps = {
  plans: PlanService[]
  thumbnailsLabel: string
  pause: PauseLabel
  play: PauseLabel
}

// Même requête que le bloc M23 de tokens.css (sans `scripting`, toujours vrai ici).
const IMMERSION =
  '(width >= 64rem) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
// Parts de la hauteur d'écran, comme --immersion-pas et --immersion-attente (tokens.css).
const PAS = 0.9
const ATTENTE = 0.35
// Bandes du dévoilement, vitesse de remplissage d'une bande, resserrement de l'image.
const BANDES = 12
const VITESSE = 2
const ECHELLE = 0.12
// Part du dévoilement à partir de laquelle le texte passe au service suivant.
const SEUIL = 0.4
// Amorti : part de l'écart comblée par soixantième de seconde.
const AMORTI = 0.09
// Une vidéo se charge quand son service est à moins de 1,3 pas.
const APPROCHE = 1.3

const borne = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

// Masque en bandes : la bande j (0 en haut) commence avec un retard de j / BANDES × 0,5 et se
// remplit de bas en haut ; arrêts francs, aucun dégradé visible.
function masque(r: number): string {
  const pas = 100 / BANDES
  const arrets: string[] = []
  for (let j = 0; j < BANDES; j++) {
    const part = borne((r - (j / BANDES) * 0.5) * VITESSE, 0, 1)
    const debut = j * pas
    const fin = (j + 1) * pas
    const haut = Math.max(debut, fin - part * pas - (part > 0 ? 0.05 : 0))
    arrets.push(`transparent ${debut}%`, `transparent ${haut}%`, `#000 ${haut}%`, `#000 ${fin}%`)
  }
  return `linear-gradient(to bottom, ${arrets.join(', ')})`
}

function poserMasque(el: HTMLElement, valeur: string) {
  el.style.setProperty('mask-image', valeur)
  el.style.setProperty('-webkit-mask-image', valeur)
}

// Sources posées à la demande : rien n'est téléchargé hors du mode immersif.
function charger(video: HTMLVideoElement, sources: { mp4: string; webm: string }) {
  if (video.dataset.charge) return
  video.dataset.charge = '1'
  for (const [src, type] of [
    [sources.webm, 'video/webm'],
    [sources.mp4, 'video/mp4'],
  ] as const) {
    const source = document.createElement('source')
    source.src = src
    source.type = type
    video.appendChild(source)
  }
  video.preload = 'auto'
  video.load()
}

export function ServicesImmersion({ plans, thumbnailsLabel, pause, play }: ServicesImmersionProps) {
  const piste = useRef<HTMLDivElement>(null)
  const [actif, setActif] = useState(0)
  const [videos, setVideos] = useState(false)
  const enPause = useVideosPaused()
  const pauseRef = useRef(enPause)
  const actifRef = useRef(0)

  useEffect(() => {
    // Vidéos possibles : desktop, mouvement autorisé, pas d'économie de données.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVideos(videoAllowed() && plans.some((plan) => plan.video))
  }, [plans])

  useEffect(() => {
    const track = piste.current
    if (!track) return
    const media = window.matchMedia(IMMERSION)
    const cadres = Array.from(track.querySelectorAll<HTMLElement>('[data-plan-image]'))
    const textes = Array.from(track.querySelectorAll<HTMLElement>('[data-plan-texte]'))
    const films = cadres.map((cadre) => cadre.querySelector<HTMLVideoElement>('video'))
    const n = cadres.length
    const lances = cadres.map(() => false)
    let frame = 0
    let dernier = -1
    let courant = 0
    let precedent = 0
    let charge = false

    const cible = () => {
      const h = window.innerHeight
      const parcouru = -track.getBoundingClientRect().top
      return borne((parcouru - ATTENTE * h) / (PAS * h), 0, n - 1)
    }
    const enVue = () => {
      const r = track.getBoundingClientRect()
      return r.top < window.innerHeight * 0.75 && r.bottom > 0
    }

    const lancer = (k: number) => {
      const film = films[k]
      if (!film || pauseRef.current) return
      lances[k] = true
      film.currentTime = 0
      film.play().catch(() => {
        lances[k] = false
      })
    }
    const arreter = (k: number) => {
      const film = films[k]
      lances[k] = false
      if (!film) return
      film.pause()
      if (film.readyState > 0) film.currentTime = 0
      delete film.dataset.joue
    }

    const poser = (x: number) => {
      const vue = enVue()
      cadres.forEach((cadre, k) => {
        const calque = cadre.querySelector<HTMLElement>('[data-plan-media]')
        // Dévoilement : la première image est là dès le départ.
        const r = k === 0 ? 1 : borne(x - (k - 1), 0, 1)
        cadre.style.visibility = r <= 0 ? 'hidden' : ''
        poserMasque(cadre, r > 0 && r < 1 ? masque(r) : '')
        // Resserrement sur deux pas : 1,12 au début du dévoilement, 1 deux pas plus loin.
        const ecart = k === 0 ? x + 1 : x - (k - 1)
        const echelle = 1 + ECHELLE * (1 - borne(ecart / 2, 0, 1))
        if (calque) calque.style.transform = `scale(${echelle.toFixed(4)})`

        // Vidéo : chargée à l'approche, lancée quand le service commence à paraître, remise à zéro
        // quand il disparaît (on remonte), pour rejouer le geste au retour.
        const film = films[k]
        const sources = plans[k]?.video
        if (!film || !sources || !videos) return
        if (charge && x > k - APPROCHE) charger(film, sources)
        const parait = (k === 0 ? vue : r > 0) && charge
        if (parait && !lances[k]) lancer(k)
        if (!parait && lances[k]) arreter(k)
        // Recouverte par le service suivant : en pause, sans perdre sa place ; elle reprend si l'on
        // remonte et que son geste n'est pas fini.
        const couverte = k < n - 1 && x - k >= 1
        if (lances[k] && couverte && !film.paused) film.pause()
        if (lances[k] && !couverte && film.paused && !film.ended && !pauseRef.current) {
          film.play().catch(() => {})
        }
      })

      track.style.setProperty('--avancee', (n > 1 ? x / (n - 1) : 1).toFixed(4))

      const rang = borne(Math.floor(x + 1 - SEUIL), 0, n - 1)
      if (rang !== dernier) {
        dernier = rang
        actifRef.current = rang
        textes.forEach((texte, k) => {
          texte.dataset.etat = k < rang ? 'apres' : k === rang ? 'actif' : 'avant'
        })
        setActif(rang)
      }
    }

    // Rattrapage amorti, indépendant de la cadence d'affichage.
    const pas = (temps: number) => {
      frame = 0
      const dt = precedent ? Math.min((temps - precedent) / 1000, 0.1) : 1 / 60
      precedent = temps
      const but = cible()
      courant = but + (courant - but) * Math.pow(1 - AMORTI, dt * 60)
      if (Math.abs(but - courant) < 0.0005) courant = but
      poser(courant)
      if (courant !== but) frame = window.requestAnimationFrame(pas)
      else precedent = 0
    }
    const demander = () => {
      if (!frame && media.matches) frame = window.requestAnimationFrame(pas)
    }
    const sauter = () => {
      courant = cible()
      poser(courant)
    }
    // Vidéos chargées après l'événement `load` : elles ne concurrencent jamais le premier affichage.
    const annulerCharge = afterLoad(() => {
      charge = true
      demander()
    })

    // Arrivée ou retour sur une ancre de service (#grand-age) : la scène va au bon pas.
    const versAncre = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      const k = textes.findIndex((texte) => texte.id === id)
      if (k < 0 || !media.matches) return
      const h = window.innerHeight
      const haut = window.scrollY + track.getBoundingClientRect().top
      window.scrollTo({ top: haut + ATTENTE * h + k * PAS * h, behavior: 'instant' })
      sauter()
    }

    const nettoyer = () => {
      cadres.forEach((cadre, k) => {
        cadre.style.visibility = ''
        poserMasque(cadre, '')
        const calque = cadre.querySelector<HTMLElement>('[data-plan-media]')
        if (calque) calque.style.transform = ''
        arreter(k)
      })
    }

    const brancher = () => {
      if (media.matches) {
        window.addEventListener('scroll', demander, { passive: true })
        window.addEventListener('resize', demander)
        window.addEventListener('hashchange', versAncre)
        versAncre()
        sauter()
      } else {
        window.removeEventListener('scroll', demander)
        window.removeEventListener('resize', demander)
        window.removeEventListener('hashchange', versAncre)
        nettoyer()
      }
    }

    // Une vidéo jouée affiche son image ; à la fin, elle reste sur la dernière.
    const surLecture = (event: Event) => {
      ;(event.target as HTMLVideoElement).dataset.joue = '1'
    }
    films.forEach((film) => film?.addEventListener('playing', surLecture))

    brancher()
    media.addEventListener('change', brancher)
    return () => {
      media.removeEventListener('change', brancher)
      window.removeEventListener('scroll', demander)
      window.removeEventListener('resize', demander)
      window.removeEventListener('hashchange', versAncre)
      films.forEach((film) => film?.removeEventListener('playing', surLecture))
      annulerCharge()
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [plans, videos])

  // Pause partagée : arrête la vidéo en cours ; à la reprise, elle repart là où elle était.
  useEffect(() => {
    pauseRef.current = enPause
    const track = piste.current
    if (!track) return
    const films = Array.from(track.querySelectorAll<HTMLVideoElement>('[data-plan-video]'))
    if (enPause) films.forEach((film) => film.pause())
    else {
      const film = films[actifRef.current]
      if (film && film.dataset.joue && !film.ended) film.play().catch(() => {})
    }
  }, [enPause])

  // Vignette : amène la scène au service choisi (défilement doux sauf en mouvement réduit, M12).
  const aller = (k: number) => {
    const track = piste.current
    if (!track) return
    const h = window.innerHeight
    const haut = window.scrollY + track.getBoundingClientRect().top
    window.scrollTo({ top: haut + ATTENTE * h + k * PAS * h })
  }

  const total = String(plans.length).padStart(2, '0')

  return (
    <div
      ref={piste}
      data-immersion
      className="mt-96"
      style={{ '--plans': plans.length } as CSSProperties}
    >
      <div data-immersion-scene>
        <ol data-immersion-vignettes aria-label={thumbnailsLabel}>
          {plans.map((plan, k) => (
            <li key={plan.anchor}>
              <button
                type="button"
                data-vignette
                aria-label={plan.name}
                aria-current={k === actif ? 'true' : undefined}
                onClick={() => aller(k)}
              >
                <Image src={plan.image} alt="" sizes="64px" />
              </button>
            </li>
          ))}
        </ol>

        {plans.map((plan, k) => (
          <div key={plan.anchor} data-plan>
            <div data-plan-image>
              <div data-plan-media>
                <Image
                  src={plan.image}
                  alt={plan.alt}
                  fill
                  sizes="(min-width: 64rem) 50vw, (min-width: 48rem) 40vw, 100vw"
                  loading={k === 0 ? 'eager' : 'lazy'}
                  fetchPriority={k === 0 ? 'high' : 'auto'}
                />
                {plan.video ? (
                  <video
                    data-plan-video
                    muted
                    playsInline
                    preload="none"
                    disablePictureInPicture
                    aria-hidden="true"
                    tabIndex={-1}
                  />
                ) : null}
              </div>
            </div>
            <div
              id={plan.anchor}
              data-plan-texte
              data-etat={k === 0 ? 'actif' : 'avant'}
              aria-labelledby={`${plan.anchor}-titre`}
              role="group"
            >
              <p data-compteur data-monte aria-hidden="true">
                <span>{plan.number}</span>
                <i />
                <span>{total}</span>
              </p>
              <h2 id={`${plan.anchor}-titre`} data-plan-nom>
                <span data-ligne>
                  <span>{plan.name}</span>
                </span>
              </h2>
              <p data-plan-promesse data-monte style={{ '--ligne': 1 } as CSSProperties}>
                {plan.promise}
              </p>
              <p data-plan-besoin data-monte style={{ '--ligne': 2 } as CSSProperties}>
                {plan.need}
              </p>
              <p data-monte style={{ '--ligne': 3 } as CSSProperties}>
                <Button href={plan.href}>{plan.link}</Button>
              </p>
            </div>
          </div>
        ))}

        <span data-immersion-progression aria-hidden="true" />
        {videos ? (
          <button
            type="button"
            data-immersion-pause
            onClick={() => setVideosPaused(!enPause)}
            aria-label={enPause ? play.full : pause.full}
          >
            {enPause ? play.visible : pause.visible}
          </button>
        ) : null}
      </div>
    </div>
  )
}
