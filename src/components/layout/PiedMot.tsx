'use client'

import { useEffect, useRef, type CSSProperties } from 'react'

// M22 (D54) : le nom en très grand, Cormorant Garamond Light, sur toute la largeur du pied de page.
// À sa première apparition, les lettres montent de leur ligne de base, l'une après l'autre ; sous la
// souris, elles prennent du corps (graisse 300 à 400 autour du pointeur, comme une loupe). La chasse
// de Cormorant ne varie presque pas avec la graisse : le mot ne bouge pas. Décoratif (aria-hidden) :
// le nom est écrit plus haut. Sans JavaScript ou en mouvement réduit, le mot est simplement là.

const LEGER = 300
const PLEIN = 400
// Rayon de la loupe, en part de la taille du caractère.
const RAYON = 0.6

export function PiedMot({ mot }: { mot: string }) {
  const ligne = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const element = ligne.current
    if (!element) return
    const lettres = Array.from(element.querySelectorAll<HTMLElement>('[data-lettre]'))
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Apparition : une seule fois, quand le mot entre dans l'écran (déjà visible : rien ne bouge).
    let vue: IntersectionObserver | null = null
    if (!reduit && element.getBoundingClientRect().top > window.innerHeight) {
      element.dataset.mot = 'attente'
      vue = new IntersectionObserver(
        (entrees) => {
          if (entrees.some((entree) => entree.isIntersecting)) {
            element.dataset.mot = 'vu'
            vue?.disconnect()
          }
        },
        { threshold: 0.15 },
      )
      vue.observe(element)
    }

    const loupe = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const rayon = parseFloat(getComputedStyle(element).fontSize) * RAYON
      for (const lettre of lettres) {
        const boite = lettre.getBoundingClientRect()
        const ecart = (boite.left + boite.width / 2 - event.clientX) / rayon
        lettre.style.fontWeight = String(
          Math.round(LEGER + (PLEIN - LEGER) * Math.exp(-ecart * ecart)),
        )
      }
    }
    const repos = () => {
      for (const lettre of lettres) lettre.style.fontWeight = ''
    }
    element.addEventListener('pointermove', loupe)
    element.addEventListener('pointerleave', repos)
    return () => {
      vue?.disconnect()
      element.removeEventListener('pointermove', loupe)
      element.removeEventListener('pointerleave', repos)
    }
  }, [])

  return (
    <p ref={ligne} data-mot aria-hidden="true" className="font-display font-light">
      {Array.from(mot).map((caractere, rang) =>
        caractere === ' ' ? (
          <span key={rang} data-espace />
        ) : (
          <span key={rang} data-lettre style={{ '--rang': rang } as CSSProperties}>
            {caractere}
          </span>
        ),
      )}
    </p>
  )
}
