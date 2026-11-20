'use client'

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { demanderLien } from '@/actions/booking-link'
import { obtenirJeton } from '@/actions/request'
import { Button } from '@/components/ui/Button'
import { ErrorSummary } from '@/components/ui/ErrorSummary'
import { TextField } from '@/components/ui/TextField'
import { ETAT_LIEN_INITIAL, type CodeErreurLien, type StatutLien } from '@/lib/booking/link-form'
import { CHAMP_PIEGE, LIMITES } from '@/lib/demande/champs'

// Demande d'un lien de réservation d'appel (story 3.9 ; docs/reservation-appel.md §2, étape 1) : un
// seul champ, l'adresse e-mail, et un seul bouton. Mêmes protections et mêmes composants que le
// formulaire de contact (story 3.5) : piège à robots hors de l'écran, horodatage signé demandé à
// l'affichage, TextField, ErrorSummary, Button.
// - Sans JavaScript : POST natif vers la Server Action ; la page revient avec le résumé d'erreurs ou
//   le message et la saisie (WCAG 3.3.7), ou part vers « Un lien vient de vous être envoyé ». Le
//   premier envoi ne porte pas d'horodatage (page statique) : « Patientez quelques secondes », avec
//   un horodatage neuf (compromis gardé par D68, comme le contact).
// - Avec JavaScript : même chose sans rechargement ; le résumé ou le message reçoit le focus ; un
//   second envoi pendant le premier est ignoré.
// Validation native coupée (`noValidate`) : les messages sont ceux du site, en tête et près du champ.

export type TextesDemandeLien = {
  fields: {
    email: { label: string; hint: string }
    piege: { label: string }
  }
  buttons: { send: string; sending: string }
  errors: { prefix: string; one: string; codes: Record<CodeErreurLien, string> }
  status: { closed: string; tooEarly: string; failed: string }
  privacy: string
}

type BookingLinkFormProps = {
  locale: 'fr' | 'en'
  textes: TextesDemandeLien
  // Politique de confidentialité, section « Lorsque vous convenez d'un appel ».
  confidentialite: string
}

const STATUTS: Partial<Record<StatutLien, keyof TextesDemandeLien['status']>> = {
  ferme: 'closed',
  'trop-tot': 'tooEarly',
  echec: 'failed',
}

const ID_EMAIL = 'lien-email'

export function BookingLinkForm({ locale, textes, confidentialite }: BookingLinkFormProps) {
  const [etat, envoyer, enCours] = useActionState(demanderLien, ETAT_LIEN_INITIAL)
  const [jeton, setJeton] = useState(etat.jeton)
  const [tentative, setTentative] = useState(0)
  const [etatVu, setEtatVu] = useState(etat)
  const statut = useRef<HTMLDivElement>(null)
  const etatTraite = useRef(etat)

  // Chaque réponse remonte le résumé d'erreurs, qui reprend alors le focus ; l'horodatage reçu
  // accompagne l'envoi suivant.
  if (etat !== etatVu) {
    setEtatVu(etat)
    setTentative((n) => n + 1)
    if (etat.jeton) setJeton(etat.jeton)
  }

  // Horodatage signé (story 3.5), demandé quand le formulaire s'affiche.
  useEffect(() => {
    if (jeton) return
    let actif = true
    obtenirJeton().then(
      (valeur) => {
        if (actif && valeur) setJeton(valeur)
      },
      () => {},
    )
    return () => {
      actif = false
    }
  }, [jeton])

  // Message de l'envoi : focus, une seule fois par réponse.
  useEffect(() => {
    if (etatTraite.current === etatVu) return
    etatTraite.current = etatVu
    if (STATUTS[etatVu.statut]) statut.current?.focus()
  }, [etatVu])

  const surEnvoi = (event: FormEvent<HTMLFormElement>) => {
    if (enCours) event.preventDefault()
  }

  const code = etat.erreurs?.email
  const message = code ? textes.errors.codes[code] : undefined
  // « Erreur : merci d'indiquer… » (minuscule après le deux-points en français).
  const erreur = message
    ? `${textes.errors.prefix} ${locale === 'fr' ? message.charAt(0).toLowerCase() + message.slice(1) : message}`
    : undefined
  const cleStatut = STATUTS[etatVu.statut]

  return (
    <form action={envoyer} noValidate onSubmit={surEnvoi} className="flex flex-col gap-48">
      {cleStatut ? (
        <div
          ref={statut}
          id="lien-statut"
          tabIndex={-1}
          className="border-l-2 border-sapin py-8 pl-24"
        >
          <p role="status" className="text-title-h3 text-sapin">
            {textes.status[cleStatut]}
          </p>
        </div>
      ) : null}
      <ErrorSummary
        key={tentative}
        id="lien-erreurs"
        title={textes.errors.one}
        errors={message ? [{ href: `#${ID_EMAIL}`, message }] : []}
        focusOnMount={tentative > 0}
      />

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="jeton" value={jeton ?? ''} />
      {/* Piège à robots (story 3.5) : hors de l'écran, hors de la tabulation, ignoré des lecteurs
          d'écran ; nom et libellé inconnus du remplissage automatique. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="lien-reference">{textes.fields.piege.label}</label>
        <input
          id="lien-reference"
          type="text"
          name={CHAMP_PIEGE}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <TextField
        id={ID_EMAIL}
        name="email"
        type="email"
        label={textes.fields.email.label}
        hint={textes.fields.email.hint}
        autoComplete="email"
        required
        maxLength={LIMITES.emailMax}
        defaultValue={etat.valeurs?.email}
        error={erreur}
      />
      <p>
        {/* Nouvel onglet, annoncé : la page et sa saisie restent ouvertes. */}
        <a
          href={confidentialite}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-touch items-center text-sapin underline decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:decoration-sapin"
        >
          {textes.privacy}
        </a>
      </p>

      <div>
        <Button type="submit" pending={enCours ? textes.buttons.sending : undefined}>
          {textes.buttons.send}
        </Button>
      </div>
      <p role="status" className="sr-only">
        {enCours ? textes.buttons.sending : ''}
      </p>
    </form>
  )
}
