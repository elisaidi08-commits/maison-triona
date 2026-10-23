// Fin du film d'entrée de l'accueil calme (FilmAccueil.tsx) : ce qui doit attendre que le visiteur
// soit arrivé sur l'accueil (l'ouverture des portes) s'y abonne. Sans film affiché (mobile,
// mouvement réduit, sans JavaScript, économie de données, film déjà fini), le rappel part tout de
// suite.

export const FILM_FIN = 'maison:film-fin'

export function apresFilm(callback: () => void): () => void {
  const film = document.querySelector<HTMLElement>('[data-film-accueil]')
  if (!film || film.dataset.etat === 'fini' || getComputedStyle(film).display === 'none') {
    callback()
    return () => {}
  }
  window.addEventListener(FILM_FIN, callback, { once: true })
  return () => window.removeEventListener(FILM_FIN, callback)
}
