'use client'

import { useState, type FocusEvent, type PointerEvent, type ReactNode } from 'react'

// M21 (prototype MT-03, D52) : bande des services de l'accueil, à partir de 1024 px avec une souris.
// Les styles font tout le travail (tokens.css, `[data-bande]`) ; ce composant retient seulement le
// dernier service survolé ou atteint au clavier, pour que la bande ne se referme pas quand la souris
// la quitte. Sans JavaScript, le survol et le focus ouvrent quand même le bon service. En mobile et
// sur écran tactile, les services restent empilés et l'attribut n'a aucun effet.

export function ServicesBande({ children }: { children: ReactNode }) {
  const [actif, setActif] = useState(0)

  const select = (target: EventTarget) => {
    const panneau = (target as HTMLElement).closest<HTMLElement>('[data-panneau]')
    if (panneau) setActif(Number(panneau.dataset.panneau))
  }

  return (
    <ol
      data-bande={actif}
      onPointerOver={(event: PointerEvent<HTMLOListElement>) => {
        if (event.pointerType === 'mouse') select(event.target)
      }}
      onFocus={(event: FocusEvent<HTMLOListElement>) => select(event.target)}
      className="mt-64 flex flex-col gap-96 lg:mt-96 lg:gap-128 bande:grid"
    >
      {children}
    </ol>
  )
}
