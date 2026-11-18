'use client'

import { useEffect } from 'react'
import { ecrireBrouillon } from '@/lib/demande/brouillon'
import { BESOINS } from '@/lib/demande/champs'

// Présélection du besoin (D26, story 3.4) : un lien qui porte `data-besoin` (choix de l'accueil,
// pages de service) retient ce besoin dans le stockage de session au clic ; le formulaire de
// contact le coche quand il s'affiche. Rien dans l'URL ni dans les journaux du serveur. Sans
// JavaScript, pas de présélection : accepté (D26). Une valeur inconnue est ignorée.

export function PreselectionBesoin() {
  useEffect(() => {
    const retenir = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const besoin = event.target.closest('a[data-besoin]')?.getAttribute('data-besoin')
      if (besoin && (BESOINS as readonly string[]).includes(besoin)) {
        ecrireBrouillon('besoin', besoin)
      }
    }
    // Capture : le besoin est retenu avant que la navigation interne ne démarre. `auxclick` :
    // ouverture dans un nouvel onglet, qui reçoit une copie du stockage de session.
    document.addEventListener('click', retenir, { capture: true })
    document.addEventListener('auxclick', retenir, { capture: true })
    return () => {
      document.removeEventListener('click', retenir, { capture: true })
      document.removeEventListener('auxclick', retenir, { capture: true })
    }
  }, [])

  return null
}
