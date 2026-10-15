// Conditions communes à toutes les vidéos (docs/media-pipeline.md, docs/motion-spec.md M10, M13) :
// desktop (≥ 1024 px), aucune préférence de mouvement réduit, pas de mode économie de données.
// Sinon, seule l'image fixe (poster) s'affiche et aucune vidéo n'est téléchargée.

type NetworkInformation = { saveData?: boolean }

export function videoAllowed(): boolean {
  if (typeof window === 'undefined') return false
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection
  return (
    window.matchMedia('(min-width: 64rem)').matches &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    !connection?.saveData
  )
}

// Après l'événement `load` : la vidéo ne concurrence jamais le premier affichage (LCP).
export function afterLoad(callback: () => void): () => void {
  if (document.readyState === 'complete') {
    callback()
    return () => {}
  }
  window.addEventListener('load', callback, { once: true })
  return () => window.removeEventListener('load', callback)
}
