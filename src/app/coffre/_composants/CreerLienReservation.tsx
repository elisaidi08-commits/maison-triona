'use client'

import { useActionState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/Button'
import { ChoiceRow } from '@/components/ui/ChoiceRow'
import { dateHeure } from '@/lib/coffre/libelles'

import { creerLienReservation } from '../actions'
import type { EtatLienReservation } from '../actions'

// « Créer un lien de réservation » (story 3.10) : pont en attendant l'e-mail du lien (story 3.9). Cat
// crée un lien personnel (48 heures, une réservation) et l'envoie elle-même. Le lien s'affiche une
// seule fois, dans cette page : rechargée ou quittée, il n'est plus nulle part (la base n'en garde
// que l'empreinte). L'action reçoit la langue seule, jamais l'état précédent (aucun lien ne repart
// vers le serveur) ; le bouton reste inactif tant que la page n'est pas hydratée (le coffre demande
// JavaScript).

const INITIAL: EtatLienReservation = { etat: 'vide' }

// Faux au rendu serveur, vrai une fois la page hydratée.
const abonner = () => () => {}

export function CreerLienReservation() {
  const hydrate = useSyncExternalStore(
    abonner,
    () => true,
    () => false,
  )
  const [etat, envoyer, enCours] = useActionState(
    (_avant: EtatLienReservation, donnees: FormData) => creerLienReservation(donnees),
    INITIAL,
  )

  return (
    <section
      aria-labelledby="lien-reservation-titre"
      className="flex max-w-measure flex-col gap-24"
    >
      <h2 id="lien-reservation-titre" className="text-title-h3 text-encre">
        Lien de réservation d’un appel
      </h2>
      <p>
        En attendant l’envoi par e-mail, créez ici un lien personnel pour convenir d’un appel. Il
        vaut 48 heures et sert à une seule réservation. Envoyez-le vous-même à la personne : il ne
        s’affiche qu’une fois, ni le coffre ni la base ne le gardent. La création est inscrite au
        journal d’accès, sans le lien.
      </p>
      <form action={envoyer} className="flex flex-col gap-24">
        <ChoiceRow
          id="lien-langue"
          name="langue"
          legend="Langue de la page de réservation"
          required
          defaultValue="fr"
          options={[
            { value: 'fr', label: 'Français' },
            { value: 'en', label: 'Anglais' },
          ]}
        />
        <div>
          <Button
            type="submit"
            disabled={!hydrate}
            pending={enCours ? 'Création en cours' : undefined}
          >
            Créer un lien de réservation
          </Button>
        </div>
      </form>
      <div aria-live="polite">
        {etat.etat === 'cree' ? (
          <div className="flex flex-col gap-8 border-l-2 border-or py-8 pl-24">
            <p>
              Lien créé, valable jusqu’au {dateHeure.format(new Date(etat.expire))}. Copiez-le
              maintenant : il ne s’affichera plus.
            </p>
            <p>
              <code className="break-all select-all">{etat.lien}</code>
            </p>
          </div>
        ) : null}
        {etat.etat === 'erreur' ? (
          <p className="border-l-2 border-encre py-8 pl-24">
            Erreur : le lien n’a pas pu être créé. Réessayez dans un instant.
          </p>
        ) : null}
      </div>
    </section>
  )
}
