'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import type { BookingStatus } from '@/lib/booking/agenda'
import { estErreurAppel, MESSAGES_APPEL } from '@/lib/coffre/appels'

import { qualifierAppel } from '../appels/actions'
import type { EtatAppel } from '../appels/actions'

// « Fait » ou « Pas de réponse » pour un appel commencé (story 3.13). Deux formulaires, une action :
// l'identifiant et le statut choisi, rien d'autre. L'action serveur rend un code et rafraîchit la page
// (le contenu déchiffré reste affiché) ; le statut courant n'a pas de bouton.

const INITIAL: EtatAppel = { resultat: null }

const CHOIX = [
  { statut: 'done', libelle: 'Fait' },
  { statut: 'no_answer', libelle: 'Pas de réponse' },
] as const

export function QualifierAppel({
  id,
  statut,
  heures,
}: {
  id: string
  statut: BookingStatus
  heures: string
}) {
  const [etat, envoyer, enCours] = useActionState(qualifierAppel, INITIAL)
  const choix = CHOIX.filter((un) => un.statut !== statut)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-x-24">
        {choix.map((un) => (
          <form key={un.statut} action={envoyer}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="statut" value={un.statut} />
            <Button
              type="submit"
              variant="discret"
              pending={enCours ? 'Enregistrement en cours' : undefined}
            >
              {un.libelle}
              <span className="sr-only"> : appel de {heures}</span>
            </Button>
          </form>
        ))}
      </div>
      <div aria-live="polite">
        {etat.resultat ? (
          <p
            className={
              estErreurAppel(etat.resultat)
                ? 'border-l-2 border-encre py-8 pl-24 text-body-s'
                : 'text-body-s'
            }
          >
            {MESSAGES_APPEL[etat.resultat]}
          </p>
        ) : null}
      </div>
    </div>
  )
}
