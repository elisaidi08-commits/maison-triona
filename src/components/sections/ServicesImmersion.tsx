'use client'

import Image, { type StaticImageData } from 'next/image'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/Button'

// M23 (D56 ; idées de « Scroll Gallery » et de « Split Photo Slider » collées par Sady, reprises
// dans nos règles) : les trois services de la page Services en une scène plein écran, collante,
// que le défilement de la page (natif, jamais capturé) fait avancer.
// - À gauche, l'image du service. La suivante se dévoile par bandes horizontales, de haut en bas,
//   chaque bande se remplissant depuis son bord bas, pendant que l'image se resserre (1,12 → 1)
//   (idée de la galerie).
// - À droite, sur aplat sapin, le texte du service : compteur 01 / 03 barré d'un filet, nom,
//   promesse, ce que la maison fait, bouton vers la page. Au changement, le texte sort par le haut
//   et le suivant monte (idée du panneau partagé). Jamais de texte sur l'image.
// - Sur la jointure, trois vignettes carrées (rayon 0) : un clic amène la scène au service choisi.
// Ce composant ne fait que lire la position du défilement et poser l'état de chaque service ; le
// reste est en CSS (tokens.css, bloc M23 ; transform, opacity et mask seulement).
// Hors desktop avec souris, sans JavaScript ou en mouvement réduit : les services restent empilés
// (image, puis texte), sans vignettes ; le contenu est le même.

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
}

type ServicesImmersionProps = {
  plans: PlanService[]
  thumbnailsLabel: string
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

export function ServicesImmersion({ plans, thumbnailsLabel }: ServicesImmersionProps) {
  const piste = useRef<HTMLDivElement>(null)
  const [actif, setActif] = useState(0)

  useEffect(() => {
    const track = piste.current
    if (!track) return
    const media = window.matchMedia(IMMERSION)
    const cadres = Array.from(track.querySelectorAll<HTMLElement>('[data-plan-image]'))
    const textes = Array.from(track.querySelectorAll<HTMLElement>('[data-plan-texte]'))
    const n = cadres.length
    let frame = 0
    let dernier = -1

    const poser = () => {
      frame = 0
      const h = window.innerHeight
      const parcouru = -track.getBoundingClientRect().top
      const x = borne((parcouru - ATTENTE * h) / (PAS * h), 0, n - 1)

      cadres.forEach((cadre, k) => {
        const image = cadre.querySelector<HTMLElement>('img')
        // Dévoilement : la première image est là dès le départ.
        const r = k === 0 ? 1 : borne(x - (k - 1), 0, 1)
        cadre.style.visibility = r <= 0 ? 'hidden' : ''
        poserMasque(cadre, r > 0 && r < 1 ? masque(r) : '')
        // Resserrement sur deux pas : 1,12 au début du dévoilement, 1 deux pas plus loin.
        const ecart = k === 0 ? x + 1 : x - (k - 1)
        const echelle = 1 + ECHELLE * (1 - borne(ecart / 2, 0, 1))
        if (image) image.style.transform = `scale(${echelle.toFixed(4)})`
      })

      const rang = borne(Math.floor(x + 1 - SEUIL), 0, n - 1)
      if (rang !== dernier) {
        dernier = rang
        textes.forEach((texte, k) => {
          texte.dataset.etat = k < rang ? 'apres' : k === rang ? 'actif' : 'avant'
        })
        setActif(rang)
      }
    }

    const demander = () => {
      if (!frame) frame = window.requestAnimationFrame(poser)
    }

    // Arrivée ou retour sur une ancre de service (#grand-age) : la scène va au bon pas.
    const versAncre = () => {
      const id = decodeURIComponent(window.location.hash.slice(1))
      const k = textes.findIndex((texte) => texte.id === id)
      if (k < 0 || !media.matches) return
      const h = window.innerHeight
      const haut = window.scrollY + track.getBoundingClientRect().top
      window.scrollTo({ top: haut + ATTENTE * h + k * PAS * h, behavior: 'instant' })
    }

    const nettoyer = () => {
      cadres.forEach((cadre) => {
        cadre.style.visibility = ''
        poserMasque(cadre, '')
        const image = cadre.querySelector<HTMLElement>('img')
        if (image) image.style.transform = ''
      })
    }

    const brancher = () => {
      if (media.matches) {
        window.addEventListener('scroll', demander, { passive: true })
        window.addEventListener('resize', demander)
        window.addEventListener('hashchange', versAncre)
        versAncre()
        poser()
      } else {
        window.removeEventListener('scroll', demander)
        window.removeEventListener('resize', demander)
        window.removeEventListener('hashchange', versAncre)
        nettoyer()
      }
    }

    brancher()
    media.addEventListener('change', brancher)
    return () => {
      media.removeEventListener('change', brancher)
      window.removeEventListener('scroll', demander)
      window.removeEventListener('resize', demander)
      window.removeEventListener('hashchange', versAncre)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

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
              <Image
                src={plan.image}
                alt={plan.alt}
                fill
                sizes="(min-width: 64rem) 50vw, (min-width: 48rem) 40vw, 100vw"
                loading={k === 0 ? 'eager' : 'lazy'}
                fetchPriority={k === 0 ? 'high' : 'auto'}
              />
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
      </div>
    </div>
  )
}
