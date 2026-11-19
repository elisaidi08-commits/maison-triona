'use client'

import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { reserverAppel } from '@/actions/booking'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { ChoiceRow, choiceInputId } from '@/components/ui/ChoiceRow'
import { ErrorSummary } from '@/components/ui/ErrorSummary'
import { TextField } from '@/components/ui/TextField'
import {
  CHAMPS_RESERVATION,
  ETAT_RESERVATION_INITIAL,
  type ChampReservation,
  type CodeErreurReservation,
  type CreneauAffiche,
  type EtatReservation,
} from '@/lib/booking/form'
import { grouperParSemaine, teteDeListe } from '@/lib/booking/grouping'
import { LANGUES, LIMITES, ORIGINES } from '@/lib/demande/champs'

// Réservation d'un appel (story 3.10 ; docs/reservation-appel.md §2, étape 3) : un seul écran, un seul
// bouton. En tête, les trois prochains créneaux (après un créneau pris, les trois plus proches) ;
// puis les autres, par semaine et par jour ; puis nom, numéro, la mention « pas de message vocal »,
// langue de l'appel, SMS en option (masqué tant que le fournisseur n'est pas choisi), origine (liste fermée de D41), consentement. Mêmes composants que
// le formulaire de contact (ChoiceRow, TextField, CheckboxField, ErrorSummary).
// - Sans JavaScript : POST natif vers la Server Action ; la page revient avec le résumé d'erreurs et
//   toute la saisie (WCAG 3.3.7), ou part vers la confirmation.
// - Avec JavaScript : même chose sans rechargement ; le résumé ou le message reçoit le focus ; un
//   second envoi pendant le premier est ignoré (le serveur, de toute façon, ne réserve qu'une fois).
// Tous les créneaux portent le même `name` : un seul choix possible, d'un groupe à l'autre. Libellés
// composés sur le serveur (src/lib/booking/display.ts). Validation native coupée (`noValidate`) : les
// messages sont ceux du site, en tête et près du champ.

type Libelles = Record<string, string>

export type TextesReservation = {
  slots: { legend: string; next: string; nearby: string; week: string }
  form: {
    fields: {
      nom: { label: string }
      telephone: { label: string; hint: string }
      voicemail: string
      langue: { legend: string; options: Libelles }
      sms: { label: string; hint: string }
      consentement: { label: string; link: string }
    }
    buttons: { send: string; sending: string }
    errors: {
      prefix: string
      one: string
      many: string
      codes: Record<CodeErreurReservation, string>
    }
    status: { taken: string; failed: string; limit: string }
  }
  origine: { legend: string; options: Libelles }
}

type BookingFormProps = {
  locale: 'fr' | 'en'
  jeton: string
  creneaux: CreneauAffiche[]
  // État de l'action rendu avec la page, après un envoi sans JavaScript (src/lib/booking/action-state.ts).
  etatInitial?: EtatReservation
  // Case « Me prévenir aussi par SMS » : proposée seulement une fois le fournisseur choisi
  // (src/lib/booking/options.ts) ; sinon absente.
  sms: boolean
  textes: TextesReservation
  // Politique de confidentialité, section « Lorsque vous convenez d'un appel ».
  confidentialite: string
}

const ID: Record<ChampReservation, string> = {
  creneau: 'appel-creneau',
  nom: 'appel-nom',
  telephone: 'appel-telephone',
  langue: 'appel-langue',
  sms: 'appel-sms',
  origine: 'appel-origine',
  consentement: 'appel-consentement',
}

export function BookingForm({
  locale,
  jeton,
  creneaux,
  etatInitial,
  sms,
  textes,
  confidentialite,
}: BookingFormProps) {
  const [etat, envoyer, enCours] = useActionState(
    reserverAppel,
    etatInitial ?? ETAT_RESERVATION_INITIAL,
  )
  const statut = useRef<HTMLDivElement>(null)
  const etatTraite = useRef(etat)
  // Chaque réponse remonte le résumé d'erreurs, qui reprend alors le focus.
  const [tentative, setTentative] = useState(0)
  const [etatVu, setEtatVu] = useState(etat)
  if (etat !== etatVu) {
    setEtatVu(etat)
    setTentative((n) => n + 1)
  }

  // Message de l'envoi (créneau pris, échec) : focus, une seule fois par réponse.
  useEffect(() => {
    if (etatTraite.current === etatVu) return
    etatTraite.current = etatVu
    if (['pris', 'echec', 'limite'].includes(etatVu.statut)) statut.current?.focus()
  }, [etatVu])

  const surEnvoi = (event: FormEvent<HTMLFormElement>) => {
    if (enCours) event.preventDefault()
  }

  const v = etat.valeurs ?? {}
  const f = textes.form.fields
  const erreurs = etat.erreurs ?? {}
  // Créneaux encore libres : relus par l'action après un créneau pris, sinon ceux de la page.
  const libres = etat.creneaux ?? creneaux
  const pris = etat.statut === 'pris'
  const tete = teteDeListe(libres, pris ? etat.creneauPris : undefined)
  const semaines = grouperParSemaine(libres, tete)

  // Le lien du résumé mène au premier créneau proposé, ou à la première option d'un groupe.
  const ancre = (champ: ChampReservation): string => {
    if (champ === 'creneau') return `#${choiceInputId(ID.creneau, tete[0]?.debut ?? '')}`
    if (champ === 'langue') return `#${choiceInputId(ID.langue, LANGUES[0])}`
    if (champ === 'origine') return `#${choiceInputId(ID.origine, ORIGINES[0])}`
    return `#${ID[champ]}`
  }
  const resume = CHAMPS_RESERVATION.flatMap((champ) => {
    const code = erreurs[champ]
    return code ? [{ href: ancre(champ), message: textes.form.errors.codes[code] }] : []
  })
  const titreResume =
    resume.length === 1
      ? textes.form.errors.one
      : textes.form.errors.many.replace('{count}', String(resume.length))

  // « Erreur : merci d'indiquer… » (minuscule après le deux-points en français).
  const erreur = (champ: ChampReservation): string | undefined => {
    const code = erreurs[champ]
    if (!code) return undefined
    const message = textes.form.errors.codes[code]
    const suite = locale === 'fr' ? message.charAt(0).toLowerCase() + message.slice(1) : message
    return `${textes.form.errors.prefix} ${suite}`
  }

  const message = pris
    ? textes.form.status.taken
    : etat.statut === 'echec'
      ? textes.form.status.failed
      : etat.statut === 'limite'
        ? textes.form.status.limit
        : null

  return (
    <form action={envoyer} noValidate onSubmit={surEnvoi} className="flex flex-col gap-64">
      {message ? (
        <div
          ref={statut}
          id="appel-statut"
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
        id="appel-erreurs"
        title={titreResume}
        errors={resume}
        focusOnMount={tentative > 0}
      />

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="jeton" value={jeton} />

      <fieldset className="m-0 flex min-w-0 flex-col gap-48 border-0 p-0">
        <legend className="mb-24 p-0 font-display text-title-h2 text-sapin">
          {textes.slots.legend}
        </legend>
        <ChoiceRow
          id={ID.creneau}
          name="creneau"
          legend={pris ? textes.slots.nearby : textes.slots.next}
          required
          defaultValue={v.creneau}
          error={erreur('creneau')}
          options={tete.map((creneau) => ({
            value: creneau.debut,
            label: `${creneau.libelleJour}, ${creneau.libelleHeure}`,
          }))}
        />
        {semaines.map((semaine) => (
          <fieldset key={semaine.semaine} className="m-0 flex min-w-0 flex-col gap-32 border-0 p-0">
            <legend className="mb-16 p-0 text-label text-encre uppercase">
              {textes.slots.week.replace('{date}', semaine.libelle)}
            </legend>
            {semaine.jours.map((jour) => (
              <ChoiceRow
                key={jour.jour}
                id={`appel-jour-${jour.jour}`}
                name="creneau"
                legend={jour.libelle}
                required
                columns={3}
                defaultValue={v.creneau}
                options={jour.creneaux.map((creneau) => ({
                  value: creneau.debut,
                  label: creneau.libelleHeure,
                }))}
              />
            ))}
          </fieldset>
        ))}
      </fieldset>

      <TextField
        id={ID.nom}
        name="nom"
        label={f.nom.label}
        autoComplete="name"
        required
        maxLength={LIMITES.nomMax}
        defaultValue={v.nom}
        error={erreur('nom')}
      />
      <div className="flex flex-col gap-24">
        <TextField
          id={ID.telephone}
          name="telephone"
          type="tel"
          label={f.telephone.label}
          hint={f.telephone.hint}
          autoComplete="tel"
          required
          maxLength={LIMITES.telephoneMax}
          defaultValue={v.telephone}
          error={erreur('telephone')}
        />
        {/* D41 : la maison ne laisse jamais de message vocal ; une mention, pas une case. */}
        <p className="border-l border-or pl-16 text-body text-encre">{f.voicemail}</p>
      </div>
      <ChoiceRow
        id={ID.langue}
        name="langue"
        legend={f.langue.legend}
        required
        defaultValue={v.langue ?? locale}
        error={erreur('langue')}
        options={LANGUES.map((value) => ({ value, label: f.langue.options[value] ?? value }))}
      />
      {sms ? (
        <CheckboxField
          id={ID.sms}
          name="sms"
          label={f.sms.label}
          defaultChecked={v.sms === 'oui'}
          hint={f.sms.hint}
        />
      ) : null}
      <ChoiceRow
        id={ID.origine}
        name="origine"
        legend={textes.origine.legend}
        defaultValue={v.origine}
        error={erreur('origine')}
        options={ORIGINES.map((value) => ({
          value,
          label: textes.origine.options[value] ?? value,
        }))}
      />
      <CheckboxField
        id={ID.consentement}
        name="consentement"
        label={f.consentement.label}
        required
        defaultChecked={v.consentement === 'oui'}
        error={erreur('consentement')}
        hint={
          // Nouvel onglet, annoncé : la page et sa saisie restent ouvertes.
          <a
            href={confidentialite}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-touch items-center text-sapin underline decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:decoration-sapin"
          >
            {f.consentement.link}
          </a>
        }
      />

      <div>
        <Button type="submit" pending={enCours ? textes.form.buttons.sending : undefined}>
          {textes.form.buttons.send}
        </Button>
      </div>
      <p role="status" className="sr-only">
        {enCours ? textes.form.buttons.sending : ''}
      </p>
    </form>
  )
}
