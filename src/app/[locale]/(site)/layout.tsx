import type { ReactNode } from 'react'

// Garde-fou : toutes les pages du site sont statiques ; le build échoue si un rendu à la requête
// s'introduit (docs/architecture.md §2). Les adresses inconnues reçoivent la 404 globale
// (`src/app/global-not-found.tsx`), servie telle quelle, sans JavaScript.
export const ensureStatic = 'navigation'

export default function SiteLayout({ children }: { children: ReactNode }) {
  return children
}
