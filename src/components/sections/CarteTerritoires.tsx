'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  CARTE_VIEWBOX,
  PAYS_MAISON,
  PAYS_VOISINS,
  REPERES,
  type CodePays,
} from '@/lib/carte-territoires'
import { LIEUX, type CleLieu } from '@/lib/lieux-territoires'
import { versCarte } from '@/lib/projection-europe'

// M24 (D56 ; Sady : « une carte européenne », qu'on comprenne d'emblée où la maison opère et
// pourquoi, sans avoir à appuyer) : la carte d'Europe de la story 1.7 reste à l'écran pendant qu'on
// lit les cinq pays. Dès l'arrivée, les cinq pays sont teintés et nommés. Quand le texte d'un pays
// passe au milieu de l'écran, la carte s'approche de lui, le teinte en sapin et montre les lieux que
// son texte cite ; un clic sur un pays de la carte amène à son texte. Défilement natif, aucune
// molette capturée ; seuls `transform` (zoom) et les couleurs bougent. La carte et ses noms sont
// décoratifs (aria-hidden) : les pays et leurs textes sont du contenu réel, dans l'ordre de
// lecture. Sans JavaScript : la carte des cinq pays, fixe, et tous les textes. Mouvement réduit :
// chaque pays s'affiche sans trajet.

type Vue = { s: number; tx: number; ty: number }
type Pays = { code: CodePays; nom: string }

type CarteTerritoiresProps = {
  pays: Pays[]
  lieux: Record<CleLieu, string>
  children: ReactNode
}

const COTE = 1000
const ENSEMBLE: Vue = { s: 1, tx: 0, ty: 0 }
const DUREE = 900
const ZOOM_MAX = 6
// Part du cadre occupée par le pays lu.
const OCCUPATION = 0.5
// Ligne de lecture : le pays dont le texte passe sous cette part de la hauteur de l'écran.
const LIGNE = 0.55
// Monaco n'a pas de tracé à cette échelle : un cadre de 40 unités (56 km) autour de son repère.
const CADRE_MONACO = 40

const douce = (t: number) => 1 - Math.pow(1 - t, 4)
const borne = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

const LIEUX_PLACES = LIEUX.map((lieu) => ({ ...lieu, point: versCarte(lieu.lon, lieu.lat) }))

export function CarteTerritoires({ pays, lieux, children }: CarteTerritoiresProps) {
  const racine = useRef<HTMLDivElement>(null)
  const formes = useRef(new Map<CodePays, SVGPathElement>())
  const [actif, setActif] = useState<CodePays | null>(null)
  const [vue, setVue] = useState<Vue>(ENSEMBLE)
  const courante = useRef<Vue>(ENSEMBLE)

  // Pays lu : celui dont la section a franchi la ligne de lecture en dernier ; avant le premier,
  // la carte des cinq pays.
  useEffect(() => {
    const element = racine.current
    if (!element) return
    const sections = Array.from(element.querySelectorAll<HTMLElement>('[data-territoire]'))
    let frame = 0
    const lire = () => {
      frame = 0
      const ligne = window.innerHeight * LIGNE
      // Le milieu de la section, pas son haut : à l'arrivée, la carte montre les cinq pays.
      const passee = sections.filter((section) => {
        const { top, height } = section.getBoundingClientRect()
        return top + height / 2 < ligne
      })
      setActif((passee.at(-1)?.dataset.territoire as CodePays | undefined) ?? null)
    }
    const auDefilement = () => {
      if (!frame) frame = requestAnimationFrame(lire)
    }
    // Un clic sur un pays de la carte amène à son texte.
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const clic = (event: MouseEvent) => {
      const code = (event.target as Element).closest<HTMLElement | SVGElement>('[data-pays]')
        ?.dataset.pays
      if (!code) return
      document
        .getElementById(`territoire-${code.toLowerCase()}`)
        ?.scrollIntoView({ behavior: reduit ? 'auto' : 'smooth', block: 'center' })
    }
    const carte = element.querySelector<HTMLElement>('[data-carte]')
    lire()
    window.addEventListener('scroll', auDefilement, { passive: true })
    window.addEventListener('resize', auDefilement)
    carte?.addEventListener('click', clic)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', auDefilement)
      window.removeEventListener('resize', auDefilement)
      carte?.removeEventListener('click', clic)
    }
  }, [])

  // Vers le pays lu : il occupe la moitié du cadre, sans laisser de bord vide.
  useEffect(() => {
    const cible = (): Vue => {
      if (!actif) return ENSEMBLE
      const forme = formes.current.get(actif)
      const [rx, ry] = REPERES[actif]
      const boite = forme
        ? forme.getBBox()
        : {
            x: rx - CADRE_MONACO / 2,
            y: ry - CADRE_MONACO / 2,
            width: CADRE_MONACO,
            height: CADRE_MONACO,
          }
      const s = borne(
        Math.min((COTE * OCCUPATION) / boite.width, (COTE * OCCUPATION) / boite.height),
        1,
        ZOOM_MAX,
      )
      const cx = boite.x + boite.width / 2
      const cy = boite.y + boite.height / 2
      return {
        s,
        tx: borne(COTE / 2 - cx * s, COTE - COTE * s, 0),
        ty: borne(COTE / 2 - cy * s, COTE - COTE * s, 0),
      }
    }
    const vers = cible()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      courante.current = vers
      setVue(vers)
      return
    }
    const de = courante.current
    const debut = performance.now()
    let frame = 0
    const pas = (maintenant: number) => {
      const k = douce(Math.min((maintenant - debut) / DUREE, 1))
      const v: Vue = {
        s: de.s * Math.pow(vers.s / de.s, k),
        tx: de.tx + (vers.tx - de.tx) * k,
        ty: de.ty + (vers.ty - de.ty) * k,
      }
      courante.current = v
      setVue(v)
      if (k < 1) frame = requestAnimationFrame(pas)
    }
    frame = requestAnimationFrame(pas)
    return () => cancelAnimationFrame(frame)
  }, [actif])

  // Position d'un point de la carte dans le cadre, en pourcentage, après le zoom. Arrondie au
  // millième : les fonctions trigonométriques de la projection ne donnent pas les mêmes dernières
  // décimales côté serveur et côté navigateur (l'hydratation les comparerait).
  const position = ([x, y]: [number, number]) =>
    ({
      '--x': `${(((x * vue.s + vue.tx) / COTE) * 100).toFixed(3)}%`,
      '--y': `${(((y * vue.s + vue.ty) / COTE) * 100).toFixed(3)}%`,
    }) as CSSProperties
  // Repère sorti du cadre (vue rapprochée) : son nom ne reste pas coupé au bord.
  const hors = ([x, y]: [number, number]) => {
    const px = x * vue.s + vue.tx
    const py = y * vue.s + vue.ty
    return px < 0 || px > COTE || py < 0 || py > COTE || undefined
  }

  return (
    <div ref={racine} className="lg:grid lg:grid-cols-12 lg:gap-gutter">
      <div data-carte-cadre className="lg:col-span-7">
        <div data-carte>
          <svg viewBox={CARTE_VIEWBOX} aria-hidden="true" focusable="false">
            <g
              transform={`translate(${vue.tx} ${vue.ty}) scale(${vue.s})`}
              fill="none"
              strokeLinejoin="round"
            >
              {PAYS_VOISINS.map(({ code, d }) => (
                <path
                  key={code}
                  d={d}
                  className="stroke-sapin-20"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {PAYS_MAISON.map(({ code, d }) => (
                <path
                  key={code}
                  ref={(element) => {
                    if (element) formes.current.set(code, element)
                  }}
                  d={d}
                  data-pays={code}
                  data-actif={code === actif || undefined}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          </svg>
          <div data-carte-noms aria-hidden="true">
            {pays.map(({ code, nom }) => (
              <span
                key={code}
                data-pays={code}
                data-actif={code === actif || undefined}
                data-hors={hors(REPERES[code])}
                style={position(REPERES[code])}
              >
                <span data-repere />
                <span data-nom className="text-label uppercase">
                  {nom}
                </span>
              </span>
            ))}
            {LIEUX_PLACES.map(({ cle, pays: code, point, cote }) => (
              <span
                key={cle}
                data-lieu
                data-cote={cote}
                data-visible={code === actif || undefined}
                data-hors={hors(point)}
                style={position(point)}
              >
                <span data-lieu-point />
                <span data-nom className="text-label uppercase">
                  {lieux[cle]}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="lg:col-span-4 lg:col-start-9">{children}</div>
    </div>
  )
}
