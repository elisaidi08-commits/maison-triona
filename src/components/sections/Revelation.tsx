'use client'

import { useEffect, useRef, type ReactNode } from 'react'

// M3 (docs/motion-spec.md, à l'essai sur la section Territoires, D37 ; Q4 en attente) : le label
// et le titre d'une section apparaissent quand ils entrent dans l'écran (8 px, 700 ms, 80 ms
// d'écart, styles dans tokens.css). Jamais les paragraphes. Rien n'est caché sans JavaScript, en
// mouvement réduit, ni pour un titre déjà à l'écran au chargement ; le focus clavier le révèle.

export function Revelation({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = root.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (element.getBoundingClientRect().top < window.innerHeight) return
    element.dataset.revelation = 'attente'
    const show = () => {
      element.dataset.revelation = 'visible'
      observer.disconnect()
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) show()
      },
      { threshold: 0.2 },
    )
    observer.observe(element)
    element.addEventListener('focusin', show)
    return () => {
      observer.disconnect()
      element.removeEventListener('focusin', show)
    }
  }, [])

  return (
    <div ref={root} data-revelation="" className="flex flex-col gap-24">
      {children}
    </div>
  )
}
