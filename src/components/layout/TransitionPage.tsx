'use client'

import { useEffect, type ReactNode } from 'react'

// M6 (docs/motion-spec.md, D37) : la page qui arrive par une navigation interne apparaît en fondu,
// 240 ms, entrée seulement. Monté par template.tsx, qui se remonte à chaque navigation. Le premier
// affichage n'est jamais animé : l'image principale s'affiche aussitôt. Mouvement réduit : la règle
// globale ramène le fondu à rien.

let navigated = false

export function TransitionPage({ children }: { children: ReactNode }) {
  const animate = navigated
  useEffect(() => {
    navigated = true
  }, [])
  return <div className={animate ? 'animate-page' : undefined}>{children}</div>
}
