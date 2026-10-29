'use client'

import { useEffect, useRef, useState } from 'react'
import { GLOBE } from '@/lib/globe-territoires'

// M23 (D55 ; idée du « Wireframe Dotted Globe » collé par Sady, reprise dans nos règles) : globe en
// points sur un aplat encre. Sphère sapin cerclée de champagne, terres en points champagne, contours
// et méridiens ivoire en filigrane, les cinq pays de la maison en filet champagne avec un repère
// chacun. À sa première apparition, le globe tourne jusqu'à l'Europe de l'Ouest (3,5 s, moins de
// 5 s : aucune commande de pause n'est due) puis s'arrête ; à la souris, on le fait tourner, et il
// revient de lui-même aux cinq pays. Ni molette capturée, ni rotation sans fin, ni bibliothèque :
// projection orthographique écrite ici, données Natural Earth embarquées (scripts/globe-territoires.mjs),
// aucun appel réseau. Décoratif (aria-hidden) : les pays sont écrits en clair sous le globe.
// Mouvement réduit : le globe est posé sur l'Europe, sans rotation d'entrée ni retour animé.

const RAD = Math.PI / 180
// Rotation d'entrée : depuis l'Atlantique, vers le centre des cinq pays.
const DEPART: [number, number] = [-60, 20]
const ENTREE = 3500
const RETOUR = 1500
const ATTENTE_RETOUR = 2500
// Glissement de la souris → rotation, en degrés par pixel.
const SENSIBILITE = 0.35

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
const couleur = (element: Element, jeton: string) =>
  getComputedStyle(element).getPropertyValue(`--color-${jeton}`).trim()

export function GlobeTerritoires({ indication }: { indication: string }) {
  const toile = useRef<HTMLCanvasElement>(null)
  const [interactif, setInteractif] = useState(false)

  useEffect(() => {
    const canvas = toile.current
    const contexte = canvas?.getContext('2d')
    if (!canvas || !contexte) return
    const cadre = canvas.parentElement!
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const souris = window.matchMedia('(hover: hover) and (pointer: fine)')
    setInteractif(souris.matches)

    const terres = decoder(GLOBE.terres)
    const contours = anneaux(decoder(GLOBE.contours), GLOBE.contoursLongueurs)
    const pays = GLOBE.pays.flatMap(({ anneaux: a, longueurs }) => anneaux(decoder(a), longueurs))
    const reperes = Object.values(GLOBE.reperes) as unknown as [number, number][]
    const cible: [number, number] = [GLOBE.centre[0], GLOBE.centre[1]]
    const teintes = {
      sphere: couleur(canvas, 'sapin'),
      cercle: couleur(canvas, 'champagne'),
      points: couleur(canvas, 'champagne'),
      trait: couleur(canvas, 'ivoire'),
      repere: couleur(canvas, 'champagne'),
    }

    let centre: [number, number] = reduit ? [...cible] : [...DEPART]
    let largeur = 0
    let hauteur = 0
    let rayon = 0
    let frame = 0
    let retour = 0

    // Projection orthographique centrée sur `centre` ; null pour la face cachée.
    const projeter = ([lon, lat]: [number, number]): [number, number] | null => {
      const l = (lon - centre[0]) * RAD
      const p = lat * RAD
      const p0 = centre[1] * RAD
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
    const meridiens: [number, number][][] = []
    for (let lon = -180; lon < 180; lon += 15) {
      const ligne: [number, number][] = []
      for (let lat = -90; lat <= 90; lat += 3) ligne.push([lon, lat])
      meridiens.push(ligne)
    }
    for (let lat = -75; lat <= 75; lat += 15) {
      const ligne: [number, number][] = []
      for (let lon = -180; lon <= 180; lon += 3) ligne.push([lon, lat])
      meridiens.push(ligne)
    }

    const dessiner = () => {
      const echelle = rayon / 240
      contexte.clearRect(0, 0, largeur, hauteur)
      contexte.beginPath()
      contexte.arc(largeur / 2, hauteur / 2, rayon, 0, 2 * Math.PI)
      contexte.fillStyle = teintes.sphere
      contexte.fill()
      contexte.lineWidth = 1.5 * echelle
      contexte.strokeStyle = teintes.cercle
      contexte.stroke()

      contexte.strokeStyle = teintes.trait
      contexte.lineWidth = echelle
      contexte.globalAlpha = 0.12
      contexte.beginPath()
      meridiens.forEach(tracer)
      contexte.stroke()
      contexte.globalAlpha = 0.35
      contexte.beginPath()
      contours.forEach(tracer)
      contexte.stroke()

      contexte.globalAlpha = 0.75
      contexte.fillStyle = teintes.points
      contexte.beginPath()
      const r = 1.2 * echelle
      for (const point of terres) {
        const projete = projeter(point)
        if (!projete) continue
        contexte.moveTo(projete[0] + r, projete[1])
        contexte.arc(projete[0], projete[1], r, 0, 2 * Math.PI)
      }
      contexte.fill()
      contexte.globalAlpha = 1

      contexte.strokeStyle = teintes.cercle
      contexte.lineWidth = 1.5 * echelle
      contexte.beginPath()
      pays.forEach((anneau) => tracer([...anneau, anneau[0]!]))
      contexte.stroke()
      for (const repere of reperes) {
        const projete = projeter(repere)
        if (!projete) continue
        contexte.beginPath()
        contexte.arc(projete[0], projete[1], 3.5 * echelle, 0, 2 * Math.PI)
        contexte.fillStyle = teintes.repere
        contexte.fill()
        contexte.lineWidth = 1.5 * echelle
        contexte.strokeStyle = teintes.sphere
        contexte.stroke()
      }
    }

    const dimensionner = () => {
      const ratio = window.devicePixelRatio || 1
      largeur = cadre.clientWidth
      hauteur = cadre.clientHeight
      rayon = Math.min(largeur, hauteur) / 2.4
      canvas.width = Math.round(largeur * ratio)
      canvas.height = Math.round(hauteur * ratio)
      contexte.setTransform(ratio, 0, 0, ratio, 0, 0)
      dessiner()
    }

    // Va de la position courante à `vers` en `duree` ms, puis s'arrête.
    const aller = (vers: [number, number], duree: number) => {
      cancelAnimationFrame(frame)
      if (reduit) {
        centre = [...vers]
        dessiner()
        return
      }
      const de: [number, number] = [...centre]
      // Le plus court chemin en longitude.
      const ecart = ((vers[0] - de[0] + 540) % 360) - 180
      const debut = performance.now()
      const pas = (maintenant: number) => {
        const t = Math.min((maintenant - debut) / duree, 1)
        const k = douce(t)
        centre = [de[0] + ecart * k, de[1] + (vers[1] - de[1]) * k]
        dessiner()
        if (t < 1) frame = requestAnimationFrame(pas)
      }
      frame = requestAnimationFrame(pas)
    }

    const taille = new ResizeObserver(dimensionner)
    taille.observe(cadre)
    dimensionner()

    // Rotation d'entrée, une seule fois, quand le globe entre dans l'écran.
    const vue = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((entree) => entree.isIntersecting)) {
          vue.disconnect()
          aller(cible, ENTREE)
        }
      },
      { threshold: 0.3 },
    )
    vue.observe(canvas)

    // À la souris (ou au stylet) : on fait tourner le globe ; au toucher, la page défile.
    const saisir = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0) return
      cancelAnimationFrame(frame)
      window.clearTimeout(retour)
      canvas.setPointerCapture(event.pointerId)
      const depart: [number, number] = [...centre]
      const x0 = event.clientX
      const y0 = event.clientY
      const bouger = (mouvement: PointerEvent) => {
        centre = [
          depart[0] - (mouvement.clientX - x0) * SENSIBILITE,
          Math.max(-80, Math.min(80, depart[1] + (mouvement.clientY - y0) * SENSIBILITE)),
        ]
        dessiner()
      }
      const lacher = () => {
        canvas.removeEventListener('pointermove', bouger)
        canvas.removeEventListener('pointerup', lacher)
        canvas.removeEventListener('pointercancel', lacher)
        retour = window.setTimeout(() => aller(cible, RETOUR), ATTENTE_RETOUR)
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
      vue.disconnect()
      canvas.removeEventListener('pointerdown', saisir)
    }
  }, [])

  return (
    <>
      {/* Repli sans JavaScript : la sphère seule, à la taille du globe. */}
      <span data-globe-repli aria-hidden="true" />
      <canvas ref={toile} data-globe aria-hidden="true" />
      {interactif ? (
        <p aria-hidden="true" className="text-label text-ivoire-80 uppercase" data-globe-indication>
          {indication}
        </p>
      ) : null}
    </>
  )
}
