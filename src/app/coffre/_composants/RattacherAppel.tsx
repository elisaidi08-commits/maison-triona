'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { estErreurAppel, MESSAGES_APPEL } from '@/lib/coffre/appels'
import type { OptionDemande } from '@/lib/coffre/appels'

import { rattacherAppel } from '../appels/actions'
import type { EtatAppel } from '../appels/actions'

// Rattacher un appel au dossier d'une demande du coffre, ou retirer le rattachement (story 3.13). La
// liste ne montre que les colonnes en clair des demandes récentes (date, type, besoin, pays) ; le
// formulaire n'envoie que deux identifiants. Code rendu par l'action, page rafraîchie.

const INITIAL: EtatAppel = { resultat: null }

export function RattacherAppel({
  id,
  options,
  actuelle,
  heures,
}: {
  id: string
  options: OptionDemande[]
  actuelle: string
  heures: string
}) {
  const [etat, envoyer, enCours] = useActionState(rattacherAppel, INITIAL)
  const champ = `rattachement-${id}`

  return (
    <form action={envoyer} className="flex flex-col gap-16">
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-col gap-8">
        <label htmlFor={champ} className="text-label text-encre uppercase">
          Demande rattachée<span className="sr-only"> à l’appel de {heures}</span>
        </label>
        <select
          id={champ}
          name="demande"
          defaultValue={actuelle}
          key={actuelle}
          className="min-h-touch w-full rounded-none border-0 border-b border-encre-68 bg-transparent px-0 py-8 text-body text-encre"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Button
          type="submit"
          variant="discret"
          pending={enCours ? 'Enregistrement en cours' : undefined}
        >
          Enregistrer le rattachement<span className="sr-only"> de l’appel de {heures}</span>
        </Button>
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
    </form>
  )
}
