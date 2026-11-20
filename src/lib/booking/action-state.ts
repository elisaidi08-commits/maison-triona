import { headers } from 'next/headers'

import type { EtatReservation } from './form.ts'

// État de la réservation, de la Server Action au rendu de la page, dans la même requête (story 3.10).
// Sans JavaScript, le navigateur envoie le formulaire et Next rend la page après l'action. Avec Cache
// Components, une page dynamique est servie en reprenant sa coquille prérendue (`resume` de React),
// qui ignore l'état des formulaires (`formState`) : `useActionState` repartirait de l'état initial,
// sans erreurs ni saisie. L'action dépose donc son état ici et la page le relit, puis le donne au
// formulaire comme état initial. Clé : l'objet des en-têtes de la requête, propre à chaque requête
// (`headers()` le rend tel quel à l'action et au rendu qui la suit) ; table faible : rien ne survit à
// la requête, rien n'est écrit nulle part. Avec JavaScript, la page n'est pas rendue après l'action :
// l'état revient par `useActionState`, ceci ne sert pas. Vérifié de bout en bout sans JavaScript
// (tests/e2e/reservation-parcours.spec.ts), à revérifier à chaque montée de version de Next.

// Depuis la story 3.11, le même mécanisme sert au déplacement d'un appel (src/actions/booking-manage.ts) :
// l'état est d'un type ou de l'autre selon le formulaire ; chaque page relit celui de son action.
const etats = new WeakMap<object, unknown>()

export async function retenirEtat<T = EtatReservation>(etat: T): Promise<T> {
  etats.set(await headers(), etat)
  return etat
}

// Lu une fois, puis retiré : rien ne reste en mémoire après le rendu qui le consomme.
export async function etatRetenu<T = EtatReservation>(): Promise<T | undefined> {
  const cle = await headers()
  const etat = etats.get(cle) as T | undefined
  etats.delete(cle)
  return etat
}
