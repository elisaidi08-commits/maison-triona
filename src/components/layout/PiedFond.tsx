'use client'

import { useEffect, useRef } from 'react'

// M22 (D54 ; idée du « Kiln Wordmark Footer » collé par Sady) : derrière le pied de page, un grand
// disque et une dalle cyprès sur le sapin, comme un émail. Le disque penche vers la souris ; un clic
// sur une partie vide du pied de page passe à la composition suivante. Décoratif (aria-hidden).
// Seul `transform` bouge (aucun décalage de mise en page) ; mouvement réduit : le disque se place
// sans glisser. Sans JavaScript, la première composition reste.

// Compositions, en parts de la largeur (disque : centre et rayon ; dalle : bord gauche et largeur).
type Tuile = { cx: number; cy: number; r: number; sx: number; sw: number }
const TUILES: Tuile[] = [
  { cx: 0.385, cy: 0.5, r: 0.415, sx: 0.755, sw: 0.245 },
  { cx: 0.615, cy: 0.5, r: 0.415, sx: 0, sw: 0.245 },
  { cx: 0.5, cy: 1.04, r: 0.5, sx: 0.5, sw: 0 },
  { cx: 1, cy: 0, r: 0.6, sx: 0, sw: 0.3 },
]
const CLES = ['cx', 'cy', 'r', 'sx', 'sw'] as const
// Penchant maximal vers la souris, en part de la largeur (et 1,6 fois en hauteur).
const PENCHANT = 0.035
// Rapprochement indépendant de la cadence : part de l'écart comblée par soixantième de seconde.
const approche = (de: number, vers: number, k: number, dt: number) =>
  vers + (de - vers) * Math.pow(1 - k, Math.min(dt, 0.1) * 60)

export function PiedFond() {
  const fond = useRef<SVGSVGElement>(null)
  const disque = useRef<SVGCircleElement>(null)
  const dalle = useRef<SVGRectElement>(null)

  useEffect(() => {
    const svg = fond.current
    const pied = svg?.parentElement
    if (!svg || !pied) return
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)')
    let rang = 0
    let cible: Tuile = { ...TUILES[0]! }
    const actuel: Tuile = { ...cible }
    let penche = [0, 0]
    let largeur = pied.clientWidth
    let hauteur = pied.clientHeight
    let frame = 0
    let dernier = 0

    const peindre = () => {
      svg.setAttribute('viewBox', `0 0 ${largeur} ${hauteur}`)
      disque.current?.setAttribute(
        'transform',
        `translate(${actuel.cx * largeur} ${actuel.cy * hauteur}) scale(${actuel.r * largeur})`,
      )
      dalle.current?.setAttribute(
        'transform',
        `translate(${actuel.sx * largeur} 0) scale(${Math.max(0, actuel.sw * largeur)} ${hauteur})`,
      )
    }
    const pas = (maintenant: number) => {
      const dt = dernier ? (maintenant - dernier) / 1000 : 1 / 60
      dernier = maintenant
      const but: Tuile = {
        ...cible,
        cx: cible.cx + PENCHANT * penche[0]!,
        cy: cible.cy + PENCHANT * 1.6 * penche[1]!,
      }
      let enCours = false
      for (const cle of CLES) {
        const suivant = reduit.matches ? but[cle] : approche(actuel[cle], but[cle], 0.075, dt)
        actuel[cle] = Math.abs(suivant - but[cle]) < 1e-4 ? but[cle] : suivant
        if (actuel[cle] !== but[cle]) enCours = true
      }
      peindre()
      frame = enCours ? requestAnimationFrame(pas) : 0
    }
    const lancer = () => {
      if (frame) return
      dernier = 0
      frame = requestAnimationFrame(pas)
    }

    const bouge = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const boite = pied.getBoundingClientRect()
      penche = [
        ((event.clientX - boite.left) / boite.width) * 2 - 1,
        ((event.clientY - boite.top) / boite.height) * 2 - 1,
      ]
      lancer()
    }
    const sort = () => {
      penche = [0, 0]
      lancer()
    }
    // Les liens, la touche et le grand mot gardent leur clic ; une sélection de texte n'en est pas un.
    const clic = (event: MouseEvent) => {
      if ((event.target as Element).closest('a, button, [data-mot]')) return
      if (window.getSelection()?.toString()) return
      rang = (rang + 1) % TUILES.length
      cible = { ...TUILES[rang]! }
      lancer()
    }
    const taille = new ResizeObserver(() => {
      largeur = pied.clientWidth
      hauteur = pied.clientHeight
      peindre()
    })

    peindre()
    taille.observe(pied)
    pied.addEventListener('pointermove', bouge)
    pied.addEventListener('pointerleave', sort)
    pied.addEventListener('click', clic)
    return () => {
      cancelAnimationFrame(frame)
      taille.disconnect()
      pied.removeEventListener('pointermove', bouge)
      pied.removeEventListener('pointerleave', sort)
      pied.removeEventListener('click', clic)
    }
  }, [])

  // Rendu serveur : première composition sur une boîte de 1 440 × 960, recalée au montage.
  return (
    <svg
      ref={fond}
      data-pied-fond
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1440 960"
      preserveAspectRatio="none"
    >
      <circle
        ref={disque}
        r={1}
        transform="translate(554.4 480) scale(597.6)"
        className="fill-cypres"
      />
      <rect
        ref={dalle}
        width={1}
        height={1}
        transform="translate(1087.2 0) scale(352.8 960)"
        className="fill-cypres"
      />
    </svg>
  )
}
