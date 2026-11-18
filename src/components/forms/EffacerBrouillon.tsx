'use client'

import { useEffect } from 'react'
import { effacerBrouillon } from '@/lib/demande/brouillon'

// Page de remerciement : la demande est partie, le brouillon du formulaire (besoin, pays, langue,
// créneau, stockage de session) s'efface (docs/architecture.md §6.1, étape 3). Rien à l'écran.

export function EffacerBrouillon() {
  useEffect(() => {
    effacerBrouillon()
  }, [])
  return null
}
