import { Introuvable } from './_composants/Introuvable'

// Introuvable dans le coffre (story 3.2, partie D), pour `notFound()` : une demande bien formée mais
// inconnue, une fois la session vérifiée. Avec Cache Components, la page est déjà en cours d'envoi :
// le statut reste 200, Next ajoute `noindex` (guide « loading », « Status codes »). Un identifiant
// mal formé, lui, est écarté par src/proxy.ts, avec un vrai 404 et une page minimale.
export default function IntrouvableCoffre() {
  return <Introuvable />
}
