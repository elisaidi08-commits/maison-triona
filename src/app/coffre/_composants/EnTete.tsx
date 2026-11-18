import type { ReactNode } from 'react'

import { Rule } from '@/components/ui/Rule'

// En-tête des pages du coffre : label, titre, introduction. Sobre, sans icône ni image.
export function EnTete({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <header className="flex max-w-measure flex-col gap-16">
      <Rule short />
      <p className="text-label text-encre uppercase">Maison Triona · Coffre</p>
      <h1 className="font-display text-display-l text-sapin">{titre}</h1>
      {children}
    </header>
  )
}
