'use client'

import Link from 'next/link'
import { useEffect, useRef, ViewTransition, type CSSProperties, type ReactNode } from 'react'
import { TextLink } from '@/components/ui/TextLink'

// M21 (prototype MT-03, D52 ; idée du « Zoom Slider » collé par Sady, reprise dans nos règles) :
// services de l'accueil en file de cartes posées sur le bas de l'écran, de plus en plus grandes vers
// la droite. Le défilement de la page (natif, jamais capturé) fait avancer la file : chaque carte
// glisse vers la droite en grandissant, puis revient par la gauche (les trois services, deux fois).
// Le nom du service survolé apparaît au-dessus de sa carte ; sans survol, celui de la carte en
// vedette (la plus grande entièrement visible).
//
// Géométrie (tokens.css, bloc M21) : une carte au rang continu p (0 à 6) a son bord gauche à
// u × p² et sa largeur à u × (2p + 1) ; les cartes se touchent, et la file s'accélère vers la droite.
// Ce composant ne fait que poser `--p` sur chaque carte au fil du défilement et marquer la vedette ;
// tout le reste est en CSS (transform seulement, aucun décalage de mise en page).
//
// Hors desktop avec souris, sans JavaScript ou en mouvement réduit, la même liste reste empilée :
// les copies sont masquées, chaque service garde son image, son texte et son lien.

export type ServiceZoom = {
  key: string
  anchor: string
  number: string
  name: string
  text: string
  link: string
  href: string
  image: ReactNode
}

type ServicesZoomProps = {
  label: string
  title: string
  services: ServiceZoom[]
}

// Même requête que le bloc M21 de tokens.css (sans `scripting`, toujours vrai ici).
const ZOOM =
  '(width >= 64rem) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'
const CARTES = 6
// Rang de chaque carte en haut de la piste : la conciergerie en vedette (rang 3), le grand âge et
// les enfants arrivent par la gauche ; les copies (cartes 3 à 5) complètent la boucle.
const DEPART = [3, 2, 1, 0, 5, 4]
// Rangs parcourus sur toute la piste : chaque service passe une fois en vedette.
const PASSAGES = 2
const estVedette = (p: number) => p >= 3 && p < 4
// Arrivée directe avec une ancre de service : traitée au premier montage seulement.
let arriveeTraitee = false

export function ServicesZoom({ label, title, services }: ServicesZoomProps) {
  const piste = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const track = piste.current
    if (!track) return
    const cartes = Array.from(track.querySelectorAll<HTMLElement>('[data-carte-rang]'))
    const media = window.matchMedia(ZOOM)
    let frame = 0

    const course = () => track.offsetHeight - window.innerHeight
    const debut = () => track.getBoundingClientRect().top + window.scrollY
    // Position de défilement où un service est en vedette (début, milieu ou fin de la piste).
    const positionDe = (index: number) => debut() + (course() * index) / PASSAGES

    const poser = (t: number) => {
      cartes.forEach((carte, k) => {
        const p = ((((DEPART[k] ?? 0) + t) % CARTES) + CARTES) % CARTES
        carte.style.setProperty('--p', p.toFixed(4))
        carte.toggleAttribute('data-vedette', estVedette(p))
      })
    }
    const actualiser = () => {
      frame = 0
      const total = course()
      // Arrondie au millième : au haut de la piste, la position tombe entre deux pixels et ferait
      // trembler les cartes d'une fraction de pixel à chaque image.
      const progression = total > 0 ? -track.getBoundingClientRect().top / total : 0
      poser((Math.round(Math.min(Math.max(progression, 0), 1) * 1000) / 1000) * PASSAGES)
    }
    const auDefilement = () => {
      if (!frame) frame = requestAnimationFrame(actualiser)
    }

    // Les entrées du seuil (#conciergerie…) mènent au moment où le service est en vedette, et le
    // focus va sur son titre (M12) ; le saut natif tomberait au hasard de la piste.
    const versService = (event: MouseEvent) => {
      if (!media.matches || event.defaultPrevented || event.button !== 0) return
      const lien = (event.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]')
      const index = services.findIndex((service) => lien?.hash === `#${service.anchor}`)
      const service = services[index]
      if (!lien || !service) return
      event.preventDefault()
      history.pushState(null, '', lien.hash)
      window.scrollTo({ top: positionDe(index), behavior: 'smooth' })
      document.getElementById(`${service.anchor}-titre`)?.focus({ preventScroll: true })
    }
    // Au clavier, le lien d'un service amène sa carte en vedette, pour que le focus reste visible.
    // Déjà en vedette (focus rendu au retour, par exemple), la page ne bouge pas.
    const auFocus = (event: FocusEvent) => {
      const cible = event.target as HTMLElement
      const carte = cible.closest<HTMLElement>('[data-carte-rang]')
      const index = Number(carte?.dataset.carteRang)
      if (!media.matches || !carte || carte.hasAttribute('data-vedette')) return
      if (index >= services.length || !cible.matches(':focus-visible')) return
      window.scrollTo({ top: positionDe(index), behavior: 'smooth' })
    }

    const brancher = () => {
      if (media.matches) {
        actualiser()
        // Arrivée directe sur /fr#grand-age : la page s'ouvre sur ce service. Une seule fois, et
        // jamais au retour, où la position notée par le navigateur prime.
        if (!arriveeTraitee) {
          arriveeTraitee = true
          const index = services.findIndex((service) => location.hash === `#${service.anchor}`)
          const [entree] = performance.getEntriesByType('navigation')
          const retour =
            (entree as PerformanceNavigationTiming | undefined)?.type === 'back_forward'
          if (index >= 0 && !retour)
            window.scrollTo({ top: positionDe(index), behavior: 'instant' })
        }
        window.addEventListener('scroll', auDefilement, { passive: true })
        window.addEventListener('resize', auDefilement)
      } else {
        window.removeEventListener('scroll', auDefilement)
        window.removeEventListener('resize', auDefilement)
        poser(0)
      }
    }

    brancher()
    media.addEventListener('change', brancher)
    document.addEventListener('click', versService)
    track.addEventListener('focusin', auFocus)
    return () => {
      cancelAnimationFrame(frame)
      media.removeEventListener('change', brancher)
      document.removeEventListener('click', versService)
      track.removeEventListener('focusin', auFocus)
      window.removeEventListener('scroll', auDefilement)
      window.removeEventListener('resize', auDefilement)
    }
  }, [services])

  return (
    <div ref={piste} data-zoom>
      <div data-scene>
        <div data-entete className="flex flex-col gap-24">
          <p className="text-label text-encre uppercase">{label}</p>
          <h2 id="services-titre" className="font-display text-title-h2 text-balance text-sapin">
            {title}
          </h2>
        </div>
        <ol data-cartes className="mt-64 flex flex-col gap-96 lg:mt-96 lg:gap-128">
          {DEPART.map((depart, k) => {
            const service = services[k % services.length]
            if (!service) return null
            const copie = k >= services.length
            const versPiece = !copie && service.key === 'concierge' ? ['vers-piece'] : undefined
            return (
              <li
                key={k}
                id={copie ? undefined : service.anchor}
                data-carte-rang={k}
                data-vedette={estVedette(depart) || undefined}
                aria-hidden={copie || undefined}
                style={{ '--p': depart } as CSSProperties}
                className={`flex-col gap-16 ${copie ? 'hidden' : 'flex'}`}
              >
                {/* L'image mène aussi au service, à la souris ; le lien du texte est celui du
                    clavier et des lecteurs d'écran. */}
                <Link
                  href={service.href}
                  transitionTypes={versPiece}
                  tabIndex={-1}
                  aria-hidden="true"
                  data-carte
                  className="relative -mx-margin mb-16 block aspect-portrait overflow-hidden bg-pierre lg:mx-0 lg:aspect-auto lg:h-bande"
                >
                  {versPiece ? (
                    // P02 : l'image de la conciergerie porte le même nom que l'image de sa page.
                    <ViewTransition
                      name="piece-conciergerie"
                      share={{ 'vers-piece': 'piece', default: 'none' }}
                      default="none"
                    >
                      <div className="absolute inset-0">{service.image}</div>
                    </ViewTransition>
                  ) : (
                    service.image
                  )}
                </Link>
                <div data-etiquette className="flex flex-col gap-16">
                  <p aria-hidden="true" className="text-label text-cypres">
                    {service.number}
                  </p>
                  <h3
                    id={copie ? undefined : `${service.anchor}-titre`}
                    tabIndex={copie ? undefined : -1}
                    className="text-title-h3 text-balance text-sapin"
                  >
                    {service.name}
                  </h3>
                  <p className="max-w-measure">{service.text}</p>
                  <p>
                    <TextLink
                      href={service.href}
                      transitionTypes={versPiece}
                      tabIndex={copie ? -1 : undefined}
                    >
                      {service.link}
                    </TextLink>
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
