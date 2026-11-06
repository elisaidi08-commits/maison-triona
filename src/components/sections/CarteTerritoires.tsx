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
type Cote = 'gauche' | 'droite'
// Étiquette de la carte (repère et nom) : un pays ou un lieu.
type Etiquette = {
  cle: string
  point: [number, number]
  prevu: Cote
  // Visible dans la vue (un lieu n'apparaît qu'avec son pays).
  montree: boolean
  // Le pays lu et ses lieux : posés d'abord, jamais masqués.
  prioritaire: boolean
}
// Côté du nom, décalage vertical du nom (le repère reste sur son point), étiquette effacée.
type Placement = { cote: Cote; decalage?: number; masquee?: true }
// Boîte d'une étiquette en pixels : gauche, droite, haut, bas.
type Boite = [number, number, number, number]

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

// Le repère déborde de 4 px (--spacing-4) du côté opposé au nom (tokens.css, [data-carte-noms]).
const DEBORD = 4
// Écart minimal entre deux étiquettes, en pixels.
const MARGE = 2

const LIEUX_PLACES = LIEUX.map((lieu) => ({ ...lieu, point: versCarte(lieu.lon, lieu.lat) }))

// Côté de chaque nom dans la vue visée. Avant la mesure (rendu serveur, premier rendu) : à gauche
// dans la partie droite de la carte, à droite près du bord gauche. Après : chaque nom prend la
// première place qui tient dans le cadre sans chevaucher un nom déjà posé (le côté prévu, l'autre
// côté, puis le nom remonté ou descendu d'une demi-hauteur, son repère restant sur le point). Le
// pays lu et ses lieux sont posés d'abord, puis les noms qui ont le moins de place. Pendant qu'on
// lit un pays, un autre pays qui ne trouve aucune place nette s'efface.
function placer(
  etiquettes: Etiquette[],
  vue: Vue,
  largeur: number,
  tailles: Record<string, [number, number]>,
  lecture: boolean,
): Record<string, Placement> {
  const resultat: Record<string, Placement> = {}
  const k = largeur / COTE
  const aPoser: { e: Etiquette; x: number; y: number; l: number; h: number }[] = []
  for (const e of etiquettes) {
    const px = e.point[0] * vue.s + vue.tx
    const py = e.point[1] * vue.s + vue.ty
    const taille = tailles[e.cle]
    if (!largeur || !taille) {
      resultat[e.cle] = { cote: px > COTE * 0.6 ? 'gauche' : px < COTE * 0.25 ? 'droite' : e.prevu }
      continue
    }
    const x = px * k
    const y = py * k
    if (!e.montree || x < 0 || x > largeur || y < 0 || y > largeur) {
      resultat[e.cle] = { cote: e.prevu }
      continue
    }
    aPoser.push({ e, x, y, l: taille[0], h: taille[1] })
  }

  type APoser = (typeof aPoser)[number]
  const boite = ({ x, y, l, h }: APoser, cote: Cote, dy: number): Boite => {
    const haut = y - h / 2 + dy
    return cote === 'droite'
      ? [x - DEBORD, x - DEBORD + l, haut, haut + h]
      : [x + DEBORD - l, x + DEBORD, haut, haut + h]
  }
  const dedans = ([g, d, ha, ba]: Boite) => g >= 0 && d <= largeur && ha >= 0 && ba <= largeur
  const posees: Boite[] = []
  const libre = ([g, d, ha, ba]: Boite) =>
    !posees.some(
      ([pg, pd, pha, pba]) =>
        pg < d + MARGE && g < pd + MARGE && pha < ba + MARGE && ha < pba + MARGE,
    )
  const place = (etiquette: APoser) =>
    (['droite', 'gauche'] as const).filter((cote) => dedans(boite(etiquette, cote, 0))).length
  aPoser.sort((a, b) => Number(b.e.prioritaire) - Number(a.e.prioritaire) || place(a) - place(b))

  for (const etiquette of aPoser) {
    const { cle, prevu, prioritaire } = etiquette.e
    const autre: Cote = prevu === 'droite' ? 'gauche' : 'droite'
    const s = etiquette.h / 2 + MARGE
    const essais: [Cote, number][] = [
      [prevu, 0],
      [autre, 0],
      [prevu, -s],
      [prevu, s],
      [autre, -s],
      [autre, s],
    ]
    const nette = essais.find(([cote, dy]) => {
      const b = boite(etiquette, cote, dy)
      return dedans(b) && libre(b)
    })
    if (nette) {
      const [cote, dy] = nette
      posees.push(boite(etiquette, cote, dy))
      resultat[cle] = dy ? { cote, decalage: Math.round(dy) } : { cote }
      continue
    }
    const cote = essais.find(([c, dy]) => !dy && dedans(boite(etiquette, c, 0)))?.[0] ?? prevu
    if (!prioritaire && lecture) {
      resultat[cle] = { cote, masquee: true }
      continue
    }
    posees.push(boite(etiquette, cote, 0))
    resultat[cle] = { cote }
  }
  return resultat
}

export function CarteTerritoires({ pays, lieux, children }: CarteTerritoiresProps) {
  const racine = useRef<HTMLDivElement>(null)
  const formes = useRef(new Map<CodePays, SVGPathElement>())
  const [actif, setActif] = useState<CodePays | null>(null)
  const [vue, setVue] = useState<Vue>(ENSEMBLE)
  const courante = useRef<Vue>(ENSEMBLE)
  // Vue visée par le zoom : les côtés des noms sont choisis pour elle, pas recalculés à chaque
  // image du trajet (un nom ne saute pas d'un côté à l'autre en chemin).
  const [visee, setVisee] = useState<Vue>(ENSEMBLE)
  // Largeur de la carte et tailles des étiquettes, en pixels (mesurées dans le navigateur).
  const [largeur, setLargeur] = useState(0)
  const [tailles, setTailles] = useState<Record<string, [number, number]>>({})

  // Mesure : au chargement, au redimensionnement de la carte et quand les polices sont prêtes.
  useEffect(() => {
    const carte = racine.current?.querySelector<HTMLElement>('[data-carte]')
    if (!carte) return
    let vivant = true
    const mesurer = () => {
      if (!vivant) return
      setLargeur(carte.clientWidth)
      const mesures: Record<string, [number, number]> = {}
      carte.querySelectorAll<HTMLElement>('[data-cle]').forEach((etiquette) => {
        mesures[etiquette.dataset.cle!] = [etiquette.offsetWidth, etiquette.offsetHeight]
      })
      setTailles(mesures)
    }
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(carte)
    void document.fonts.ready.then(mesurer)
    return () => {
      vivant = false
      observateur.disconnect()
    }
  }, [])

  // Pays lu : celui dont la section a franchi la ligne de lecture en dernier ; avant le premier,
  // la carte des cinq pays.
  useEffect(() => {
    const element = racine.current
    if (!element) return
    const sections = Array.from(element.querySelectorAll<HTMLElement>('[data-territoire]'))
    const cadre = element.querySelector<HTMLElement>('[data-carte-cadre]')
    const textes = element.querySelector<HTMLElement>('[data-carte-textes]')
    // Ligne de lecture. Deux colonnes : 55 % de la hauteur de l'écran. Une colonne (carte collée en
    // haut, en portrait) : le milieu de ce qui reste visible entre la carte et la barre mobile, sinon
    // le pays s'allumerait quand son titre est encore sous la carte.
    const ligneDeLecture = () => {
      if (!cadre || !textes) return window.innerHeight * LIGNE
      if (textes.getBoundingClientRect().left >= cadre.getBoundingClientRect().right - 1) {
        return window.innerHeight * LIGNE
      }
      const barre =
        parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--barre-mobile-height'),
        ) || 0
      return (cadre.offsetHeight + window.innerHeight - barre) / 2
    }
    let frame = 0
    const lire = () => {
      frame = 0
      const ligne = ligneDeLecture()
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
    // Un clic sur un pays de la carte amène son texte sur la ligne de lecture (un peu au-dessus,
    // pour qu'il soit lu).
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const clic = (event: MouseEvent) => {
      const code = (event.target as Element).closest<HTMLElement | SVGElement>('[data-pays]')
        ?.dataset.pays
      const section = code && document.getElementById(`territoire-${code.toLowerCase()}`)
      if (!section) return
      const { top, height } = section.getBoundingClientRect()
      window.scrollBy({
        top: top + height / 2 - (ligneDeLecture() - 8),
        behavior: reduit ? 'auto' : 'smooth',
      })
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
    setVisee(vers)
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
  // `--dy` : décalage vertical du nom seul (placer), en pixels.
  const position = ([x, y]: [number, number], decalage?: number) =>
    ({
      '--x': `${(((x * vue.s + vue.tx) / COTE) * 100).toFixed(3)}%`,
      '--y': `${(((y * vue.s + vue.ty) / COTE) * 100).toFixed(3)}%`,
      ...(decalage ? { '--dy': `${decalage}px` } : {}),
    }) as CSSProperties
  // Repère sorti du cadre (vue rapprochée) : son nom ne reste pas coupé au bord.
  const hors = ([x, y]: [number, number]) => {
    const px = x * vue.s + vue.tx
    const py = y * vue.s + vue.ty
    return px < 0 || px > COTE || py < 0 || py > COTE || undefined
  }
  // Côté de chaque nom : aucun ne sort du cadre ni ne recouvre un autre, même sur la carte d'un
  // téléphone.
  const placements = placer(
    [
      ...pays.map(({ code }) => ({
        cle: code,
        point: REPERES[code],
        prevu: 'droite' as const,
        montree: true,
        prioritaire: code === actif,
      })),
      ...LIEUX_PLACES.map(({ cle, pays: code, point, cote }) => ({
        cle,
        point,
        prevu: cote,
        montree: code === actif,
        prioritaire: code === actif,
      })),
    ],
    visee,
    largeur,
    tailles,
    actif !== null,
  )

  // Une colonne en portrait sous 1 024 px (carte collée en haut, texte dessous) ; deux colonnes à
  // l'horizontale et dès 1 024 px (`data-carte-recit`, tokens.css).
  return (
    <div ref={racine} data-carte-recit>
      <div data-carte-cadre>
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
                data-cle={code}
                data-actif={code === actif || undefined}
                data-hors={hors(REPERES[code]) || placements[code]?.masquee}
                data-cote={placements[code]?.cote}
                style={position(REPERES[code], placements[code]?.decalage)}
              >
                <span data-repere />
                <span data-nom className="text-label uppercase">
                  {nom}
                </span>
              </span>
            ))}
            {LIEUX_PLACES.map(({ cle, pays: code, point }) => (
              <span
                key={cle}
                data-lieu
                data-cle={cle}
                data-cote={placements[cle]?.cote}
                data-visible={code === actif || undefined}
                data-hors={hors(point)}
                style={position(point, placements[cle]?.decalage)}
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
      <div data-carte-textes>{children}</div>
    </div>
  )
}
