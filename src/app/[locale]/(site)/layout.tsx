import type { ReactNode } from 'react'

// Garde-fou : toutes les pages du site sont statiques ; le build échoue si un rendu à la requête
// s'introduit (docs/architecture.md §2). La page attrape-tout des 404 reste hors de ce groupe.
export const ensureStatic = 'navigation'

export default function SiteLayout({ children }: { children: ReactNode }) {
  return children
}
