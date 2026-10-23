'use client'

import { useEffect, type ReactNode } from 'react'

// M6 (docs/motion-spec.md, D37) : la page qui arrive par une navigation interne apparaît en fondu,
// 240 ms, entrée seulement. Monté par template.tsx, qui se remonte à chaque navigation. Le premier
// affichage n'est jamais animé : l'image principale s'affiche aussitôt. Mouvement réduit : la règle
// globale ramène le fondu à rien.
// Prototype MT-03 : après une navigation interne, le focus revenait au corps de la page et la
// tabulation suivante partait de l'ancien lien, souvent jusqu'au pied de page (constaté sous
// Chromium, WebKit et Firefox, déjà avant MT-03). Le focus va désormais au titre principal de la
// nouvelle page (tabIndex -1, sans cadre), à défaut au contenu principal, sans défilement : la
// tabulation suivante part du contenu. Le titre, plutôt que `<main>`, parce que WebKit ignore le
// point de départ donné par `<main>`. Le premier affichage n'est pas touché.

let navigated = false

export function TransitionPage({ children }: { children: ReactNode }) {
  const animate = navigated
  useEffect(() => {
    if (navigated) {
      const main = document.getElementById('contenu')
      const title = main?.querySelector<HTMLElement>('h1')
      if (title && !title.hasAttribute('tabindex')) title.tabIndex = -1
      ;(title ?? main)?.focus({ preventScroll: true })
    }
    navigated = true
  }, [])
  return <div className={animate ? 'animate-page' : undefined}>{children}</div>
}
