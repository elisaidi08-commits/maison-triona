'use client'

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { deplacerAppel } from '@/actions/booking-manage'
import { SlotChoices, type TextesCreneaux } from '@/components/forms/SlotChoices'
import { Button } from '@/components/ui/Button'
import { choiceInputId } from '@/components/ui/ChoiceRow'
import { ErrorSummary } from '@/components/ui/ErrorSummary'
import type { CreneauAffiche } from '@/lib/booking/form'
import { teteDeListe } from '@/lib/booking/grouping'
import { ETAT_DEPLACEMENT_INITIAL, type EtatDeplacement } from '@/lib/booking/manage-form'

// Déplacer un appel (story 3.11 ; docs/reservation-appel.md §2, étape 6) : les créneaux où il peut
// aller (sans lui : sa plage et sa place dans le plafond du jour lui sont rendues), comme à la
// réservation (SlotChoices), et un seul bouton. L'ancien créneau n'est libéré qu'une fois le nouveau
// pris (la base le fait dans la même instruction).
// - Sans JavaScript : POST natif vers la Server Action ; la page revient avec le résumé d'erreurs ou le
//   message, ou repart vers la page de gestion, qui dit « Votre appel est déplacé ».
// - Avec JavaScript : même chose sans rechargement ; le résumé ou le message reçoit le focus ; un
//   second envoi pendant le premier est ignoré.

export type TextesDeplacement = {
  slots: TextesCreneaux
  button: string
  sending: string
  errors: { one: string; prefix: string; creneau: string }
  status: { taken: string; failed: string; limit: string }
}

type MoveBookingFormProps = {
  locale: 'fr' | 'en'
  jeton: string
  creneaux: CreneauAffiche[]
  etatInitial?: EtatDeplacement
  textes: TextesDeplacement
}

const PREFIXE = 'deplacer'

export function MoveBookingForm({
  locale,
  jeton,
  creneaux,
  etatInitial,
  textes,
}: MoveBookingFormProps) {
  const [etat, envoyer, enCours] = useActionState(
    deplacerAppel,
    etatInitial ?? ETAT_DEPLACEMENT_INITIAL,
  )
  const statut = useRef<HTMLDivElement>(null)
  const etatTraite = useRef(etat)
  const [tentative, setTentative] = useState(0)
  const [etatVu, setEtatVu] = useState(etat)
  if (etat !== etatVu) {
    setEtatVu(etat)
    setTentative((n) => n + 1)
  }

  useEffect(() => {
    if (etatTraite.current === etatVu) return
    etatTraite.current = etatVu
    if (['pris', 'echec', 'limite'].includes(etatVu.statut)) statut.current?.focus()
  }, [etatVu])

  const surEnvoi = (event: FormEvent<HTMLFormElement>) => {
    if (enCours) event.preventDefault()
  }

  const libres = etat.creneaux ?? creneaux
  const pris = etat.statut === 'pris'
  const tete = teteDeListe(libres, pris ? etat.creneauPris : undefined)
  const enErreur = etat.statut === 'erreurs'
  const resume = enErreur
    ? [
        {
          href: `#${choiceInputId(`${PREFIXE}-creneau`, tete[0]?.debut ?? '')}`,
          message: textes.errors.creneau,
        },
      ]
    : []
  const suite =
    locale === 'fr'
      ? textes.errors.creneau.charAt(0).toLowerCase() + textes.errors.creneau.slice(1)
      : textes.errors.creneau

  const message = pris
    ? textes.status.taken
    : etat.statut === 'echec'
      ? textes.status.failed
      : etat.statut === 'limite'
        ? textes.status.limit
        : null

  return (
    <form action={envoyer} noValidate onSubmit={surEnvoi} className="flex flex-col gap-48">
      {message ? (
        <div
          ref={statut}
          id="deplacer-statut"
          tabIndex={-1}
          className="border-l-2 border-sapin py-8 pl-24"
        >
          <p role="status" className="text-title-h3 text-sapin">
            {message}
          </p>
        </div>
      ) : null}
      <ErrorSummary
        key={tentative}
        id="deplacer-erreurs"
        title={textes.errors.one}
        errors={resume}
        focusOnMount={tentative > 0}
      />

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="jeton" value={jeton} />

      <SlotChoices
        prefixe={PREFIXE}
        creneaux={libres}
        creneauPris={pris ? etat.creneauPris : undefined}
        defaultValue={pris ? undefined : etat.creneau}
        error={enErreur ? `${textes.errors.prefix} ${suite}` : undefined}
        textes={textes.slots}
      />

      <div>
        <Button type="submit" pending={enCours ? textes.sending : undefined}>
          {textes.button}
        </Button>
      </div>
      <p role="status" className="sr-only">
        {enCours ? textes.sending : ''}
      </p>
    </form>
  )
}
