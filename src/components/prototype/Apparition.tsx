'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

// Prototype V5 (choix de Sady, 22/10/2026, d'après le composant hero-04) : les éléments d'une
// légende apparaissent l'un après l'autre (fondu et 12 px, M3, sans flou), une seule fois, quand
// elle entre dans l'écran. Rien ne bouge en mouvement réduit, sans JavaScript, ni pour une légende
// déjà visible au chargement ; un focus clavier dans la légende l'affiche aussitôt (aucun lien
// invisible). Délais en cascade : tokens.css (`[data-apparition]`).

export function Apparition({ children, className }: { children: ReactNode; className?: string }) {
  const group = useRef<HTMLDivElement>(null)
  const [waiting, setWaiting] = useState(false)

  useEffect(() => {
    const element = group.current
    if (!element || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (element.getBoundingClientRect().top < window.innerHeight) return
    setWaiting(true)
    const show = () => {
      setWaiting(false)
      observer.disconnect()
      element.removeEventListener('focusin', show)
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
    <div ref={group} data-apparition={waiting ? 'attente' : 'visible'} className={className}>
      {children}
    </div>
  )
}
