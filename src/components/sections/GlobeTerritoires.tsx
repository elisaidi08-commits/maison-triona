'use client'

import { useEffect, useRef, useState } from 'react'
import { GLOBE, type CodePaysGlobe } from '@/lib/globe-territoires'

// M23 (D55 ; idée du « Wireframe Dotted Globe » collé par Sady, reprise dans nos règles) : globe en
// points sur un aplat encre. Sphère sapin cerclée de champagne, terres en points champagne, contours
// et méridiens ivoire en filigrane, les cinq pays de la maison en filet champagne avec un repère
// chacun. À sa première apparition, le globe tourne jusqu'à l'Europe de l'Ouest (3,5 s, moins de
// 5 s : aucune commande de pause n'est due) puis s'arrête. Sous le globe, un bouton par pays (et
// « Vue d'ensemble ») le fait tourner et s'approcher du pays choisi, qui se teinte et prend son nom ;
// de près, les points s'effacent au profit des frontières fines des pays voisins. À la souris, on le
// fait tourner, et il revient de lui-même à la vue choisie. Ni molette capturée, ni rotation sans
// fin, ni bibliothèque : projection orthographique écrite ici, données Natural Earth embarquées
// (scripts/globe-territoires.mjs), aucun appel réseau. Le dessin est décoratif (aria-hidden) : les
// pays sont écrits en clair sous le globe. Mouvement réduit : chaque vue s'affiche sans trajet.
// Sans JavaScript : la sphère seule ; les boutons gardent leur place mais restent invisibles tant que
// le globe n'est pas prêt (`data-pret`, tokens.css), donc toujours sans JavaScript.

const RAD = Math.PI / 180
// Rotation d'entrée : depuis l'Atlantique, vers le centre des cinq pays.
const DEPART: Vue = { centre: [-60, 20], zoom: 1 }
const ENTREE = 3500
const TRAJET = 1800
const RETOUR = 1500
const ATTENTE_RETOUR = 2500
// Glissement de la souris → rotation, en degrés par pixel à l'échelle du globe entier.
const SENSIBILITE = 0.35
// Rapprochement maximal : Monaco et le Luxembourg, avec ce qui les entoure.
const ZOOM_MAX = 28

type Vue = { centre: [number, number]; zoom: number }
type Pays = { code: CodePaysGlobe; nom: string }
type Moteur = { montrer: (code: CodePaysGlobe | null) => void }

type GlobeTerritoiresProps = {
  indication: string
  legende: string
  ensemble: string
  pays: Pays[]
}

const decoder = (base64: string) => {
  const octets = Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0))
  const entiers = new Int16Array(octets.buffer)
  const paires: [number, number][] = []
  for (let i = 0; i < entiers.length; i += 2)
    paires.push([entiers[i]! / 100, entiers[i + 1]! / 100])
  return paires
}
const anneaux = (paires: [number, number][], longueurs: readonly number[]) => {
  let debut = 0
  return longueurs.map((longueur) => paires.slice(debut, (debut += longueur)))
}
// Sortie douce, proche de la courbe de la maison (cubic-bezier(0.22, 1, 0.36, 1)).
const douce = (t: number) => 1 - Math.pow(1 - t, 4)
const borne = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
const couleur = (element: Element, jeton: string) =>
  getComputedStyle(element).getPropertyValue(`--color-${jeton}`).trim()

// Vue d'un pays : centré sur son cadre, assez près pour qu'il occupe près de la moitié du globe.
const vueDe = (formes: [number, number][][]): Vue => {
  const points = formes.flat()
  const lons = points.map((p) => p[0])
  const lats = points.map((p) => p[1])
  const centre: [number, number] = [
    (Math.min(...lons) + Math.max(...lons)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ]
  const etendue =
    Math.max(
      (Math.max(...lons) - Math.min(...lons)) * Math.cos(centre[1] * RAD),
      Math.max(...lats) - Math.min(...lats),
    ) * RAD
  return { centre, zoom: borne(1.08 / Math.max(etendue, 1e-4), 1, ZOOM_MAX) }
}

export function GlobeTerritoires({ indication, legende, ensemble, pays }: GlobeTerritoiresProps) {
  const toile = useRef<HTMLCanvasElement>(null)
  const moteur = useRef<Moteur | null>(null)
  const noms = useRef(pays)
  const [interactif, setInteractif] = useState(false)
  const [pret, setPret] = useState(false)
  const [choix, setChoix] = useState<CodePaysGlobe | null>(null)

  useEffect(() => {
    const canvas = toile.current
    const contexte = canvas?.getContext('2d')
    if (!canvas || !contexte) return
    const cadre = canvas.parentElement!
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setInteractif(window.matchMedia('(hover: hover) and (pointer: fine)').matches)
    setPret(true)

    const terres = decoder(GLOBE.terres)
    const contours = anneaux(decoder(GLOBE.contours), GLOBE.contoursLongueurs)
    const voisins = anneaux(decoder(GLOBE.voisins), GLOBE.voisinsLongueurs)
    const formes = new Map(
      GLOBE.pays.map(({ code, anneaux: a, longueurs }) => [
        code as CodePaysGlobe,
        anneaux(decoder(a), longueurs),
      ]),
    )
    const reperes = Object.entries(GLOBE.reperes) as unknown as [CodePaysGlobe, [number, number]][]
    const ensembleVue: Vue = { centre: [GLOBE.centre[0], GLOBE.centre[1]], zoom: 1 }
    const vues = new Map([...formes].map(([code, f]) => [code, vueDe(f)]))
    const teintes = {
      sphere: couleur(canvas, 'sapin'),
      champagne: couleur(canvas, 'champagne'),
      ivoire: couleur(canvas, 'ivoire'),
    }
    const police = getComputedStyle(document.body).fontFamily

    let vue: Vue = reduit ? { ...ensembleVue } : { ...DEPART }
    let choisi: CodePaysGlobe | null = null
    let largeur = 0
    let hauteur = 0
    let rayonBase = 0
    let frame = 0
    let retour = 0

    // Projection orthographique centrée sur la vue ; null pour la face cachée.
    const projeter = ([lon, lat]: [number, number]): [number, number] | null => {
      const rayon = rayonBase * vue.zoom
      const l = (lon - vue.centre[0]) * RAD
      const p = lat * RAD
      const p0 = vue.centre[1] * RAD
      const cosC = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)
      if (cosC < 0) return null
      return [
        largeur / 2 + rayon * Math.cos(p) * Math.sin(l),
        hauteur / 2 -
          rayon * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)),
      ]
    }
    const tracer = (ligne: [number, number][]) => {
      let precedent: [number, number] | null = null
      for (const point of ligne) {
        const projete = projeter(point)
        if (projete && precedent) contexte.lineTo(projete[0], projete[1])
        else if (projete) contexte.moveTo(projete[0], projete[1])
        precedent = projete
      }
    }
    const fermer = (anneau: [number, number][]) => [...anneau, anneau[0]!]
    const meridiens: [number, number][][] = []
    for (let lon = -180; lon < 180; lon += 15) {
      const ligne: [number, number][] = []
      for (let lat = -90; lat <= 90; lat += 1) ligne.push([lon, lat])
      meridiens.push(ligne)
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const ligne: [number, number][] = []
      for (let lon = -180; lon <= 180; lon += 1) ligne.push([lon, lat])
      meridiens.push(ligne)
    }

    const dessiner = () => {
      const echelle = rayonBase / 240
      const z = vue.zoom
      contexte.clearRect(0, 0, largeur, hauteur)
      contexte.beginPath()
      contexte.arc(largeur / 2, hauteur / 2, rayonBase * z, 0, 2 * Math.PI)
      contexte.fillStyle = teintes.sphere
      contexte.fill()
      contexte.lineWidth = 1.5 * echelle
      contexte.strokeStyle = teintes.champagne
      contexte.stroke()

      const filet = (lignes: [number, number][][], alpha: number) => {
        if (alpha <= 0) return
        contexte.globalAlpha = alpha
        contexte.beginPath()
        lignes.forEach(tracer)
        contexte.stroke()
      }
      contexte.strokeStyle = teintes.ivoire
      contexte.lineWidth = echelle
      filet(meridiens, 0.12)
      // De loin, les contours du monde ; de près, les frontières fines des voisins.
      filet(contours, 0.35 * borne((5 - z) / 3, 0, 1))
      filet(voisins.map(fermer), 0.4 * borne((z - 1.5) / 2, 0, 1))

      const alphaPoints = 0.75 * borne((4 - z) / 2.5, 0, 1)
      if (alphaPoints > 0) {
        contexte.globalAlpha = alphaPoints
        contexte.fillStyle = teintes.champagne
        contexte.beginPath()
        const r = 1.2 * echelle * Math.min(z, 2)
        for (const point of terres) {
          const projete = projeter(point)
          if (!projete) continue
          contexte.moveTo(projete[0] + r, projete[1])
          contexte.arc(projete[0], projete[1], r, 0, 2 * Math.PI)
        }
        contexte.fill()
      }

      // Les cinq pays : filet champagne, le pays choisi teinté.
      for (const [code, anneauxPays] of formes) {
        contexte.beginPath()
        anneauxPays.forEach((anneau) => tracer(fermer(anneau)))
        if (code === choisi) {
          contexte.globalAlpha = 0.2
          contexte.fillStyle = teintes.champagne
          contexte.fill()
        }
        contexte.globalAlpha = 1
        contexte.strokeStyle = teintes.champagne
        contexte.lineWidth = 1.5 * echelle
        contexte.stroke()
      }
      contexte.globalAlpha = 1
      for (const [code, repere] of reperes) {
        const projete = projeter(repere)
        if (!projete) continue
        contexte.beginPath()
        contexte.arc(projete[0], projete[1], 3.5 * echelle, 0, 2 * Math.PI)
        contexte.fillStyle = teintes.champagne
        contexte.fill()
        contexte.lineWidth = 1.5 * echelle
        contexte.strokeStyle = teintes.sphere
        contexte.stroke()
        // Le nom du pays choisi, en capitales, à côté de son repère.
        if (code === choisi) {
          const nom = noms.current.find((p) => p.code === code)?.nom.toUpperCase() ?? ''
          contexte.font = `500 ${Math.round(14 * Math.max(echelle, 0.85))}px ${police}`
          contexte.letterSpacing = '0.12em'
          const mesure = contexte.measureText(nom).width
          const ecart = 10 * echelle
          const x =
            projete[0] + ecart + mesure < largeur - 8
              ? projete[0] + ecart
              : projete[0] - ecart - mesure
          contexte.textBaseline = 'middle'
          contexte.lineWidth = 4
          contexte.strokeStyle = teintes.sphere
          contexte.strokeText(nom, x, projete[1])
          contexte.fillStyle = teintes.ivoire
          contexte.fillText(nom, x, projete[1])
        }
      }
    }

    const dimensionner = () => {
      const ratio = window.devicePixelRatio || 1
      largeur = cadre.clientWidth
      hauteur = cadre.clientHeight
      rayonBase = Math.min(largeur, hauteur) / 2.4
      canvas.width = Math.round(largeur * ratio)
      canvas.height = Math.round(hauteur * ratio)
      contexte.setTransform(ratio, 0, 0, ratio, 0, 0)
      dessiner()
    }

    // Va de la vue courante à `vers` en `duree` ms (plus court chemin en longitude, rapprochement
    // régulier en échelle logarithmique), puis s'arrête.
    const aller = (vers: Vue, duree: number) => {
      cancelAnimationFrame(frame)
      if (reduit) {
        vue = { centre: [...vers.centre], zoom: vers.zoom }
        dessiner()
        return
      }
      const de: Vue = { centre: [...vue.centre], zoom: vue.zoom }
      const ecart = ((vers.centre[0] - de.centre[0] + 540) % 360) - 180
      const debut = performance.now()
      const pas = (maintenant: number) => {
        const t = Math.min((maintenant - debut) / duree, 1)
        const k = douce(t)
        vue = {
          centre: [de.centre[0] + ecart * k, de.centre[1] + (vers.centre[1] - de.centre[1]) * k],
          zoom: de.zoom * Math.pow(vers.zoom / de.zoom, k),
        }
        dessiner()
        if (t < 1) frame = requestAnimationFrame(pas)
      }
      frame = requestAnimationFrame(pas)
    }
    const vueChoisie = () => (choisi ? (vues.get(choisi) ?? ensembleVue) : ensembleVue)

    moteur.current = {
      montrer: (code) => {
        window.clearTimeout(retour)
        choisi = code
        aller(vueChoisie(), TRAJET)
      },
    }

    const taille = new ResizeObserver(dimensionner)
    taille.observe(cadre)
    dimensionner()

    // Rotation d'entrée, une seule fois, quand le globe entre dans l'écran.
    const apparition = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((entree) => entree.isIntersecting)) {
          apparition.disconnect()
          if (!choisi) aller(ensembleVue, ENTREE)
        }
      },
      { threshold: 0.3 },
    )
    apparition.observe(canvas)

    // À la souris (ou au stylet) : on fait tourner le globe ; au toucher, la page défile.
    const saisir = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0) return
      cancelAnimationFrame(frame)
      window.clearTimeout(retour)
      canvas.setPointerCapture(event.pointerId)
      const depart: Vue = { centre: [...vue.centre], zoom: vue.zoom }
      const x0 = event.clientX
      const y0 = event.clientY
      const bouger = (mouvement: PointerEvent) => {
        const s = SENSIBILITE / depart.zoom
        vue = {
          centre: [
            depart.centre[0] - (mouvement.clientX - x0) * s,
            borne(depart.centre[1] + (mouvement.clientY - y0) * s, -80, 80),
          ],
          zoom: depart.zoom,
        }
        dessiner()
      }
      const lacher = () => {
        canvas.removeEventListener('pointermove', bouger)
        canvas.removeEventListener('pointerup', lacher)
        canvas.removeEventListener('pointercancel', lacher)
        retour = window.setTimeout(() => aller(vueChoisie(), RETOUR), ATTENTE_RETOUR)
      }
      canvas.addEventListener('pointermove', bouger)
      canvas.addEventListener('pointerup', lacher)
      canvas.addEventListener('pointercancel', lacher)
    }
    canvas.addEventListener('pointerdown', saisir)

    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(retour)
      taille.disconnect()
      apparition.disconnect()
      canvas.removeEventListener('pointerdown', saisir)
      moteur.current = null
    }
  }, [])

  const choisir = (code: CodePaysGlobe | null) => {
    setChoix(code)
    moteur.current?.montrer(code)
  }
  const bouton =
    'inline-flex min-h-touch items-center text-label text-encre uppercase underline decoration-transparent decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:decoration-or aria-pressed:decoration-or'

  return (
    <>
      <div data-globe-cadre className="bg-encre">
        {/* Repli sans JavaScript : la sphère seule, à la taille du globe. */}
        <span data-globe-repli aria-hidden="true" />
        <canvas ref={toile} data-globe aria-hidden="true" />
        {interactif ? (
          <p
            aria-hidden="true"
            className="text-label text-ivoire-80 uppercase"
            data-globe-indication
          >
            {indication}
          </p>
        ) : null}
      </div>
      <div
        data-globe-commandes
        data-pret={pret || undefined}
        role="group"
        aria-label={legende}
        className="mt-16 flex flex-wrap gap-x-24"
      >
        {pays.map(({ code, nom }) => (
          <button
            key={code}
            type="button"
            aria-pressed={choix === code}
            onClick={() => choisir(code)}
            className={bouton}
          >
            {nom}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={choix === null}
          onClick={() => choisir(null)}
          className={bouton}
        >
          {ensemble}
        </button>
      </div>
    </>
  )
}
