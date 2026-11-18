'use client'

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
} from 'react'
import { envoyerDemande, obtenirJeton } from '@/actions/request'
import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { ChoiceRow, choiceInputId, type ChoiceOption } from '@/components/ui/ChoiceRow'
import { ErrorSummary } from '@/components/ui/ErrorSummary'
import { StepProgress } from '@/components/ui/StepProgress'
import { TextField } from '@/components/ui/TextField'
import {
  CHAMPS_BROUILLON,
  ecrireBrouillon,
  effacerBrouillon,
  estChampBrouillon,
  lireBrouillon,
} from '@/lib/demande/brouillon'
import {
  BESOINS,
  CHAMPS,
  CRENEAUX,
  ETAPES,
  ETAT_INITIAL,
  LANGUES,
  LIMITES,
  ORIGINES,
  PAYS,
  POUR_QUI,
  URGENCES,
  premiereEtapeEnErreur,
  type Champ,
  type CodeErreur,
  type Erreurs,
  type StatutDemande,
} from '@/lib/demande/champs'
import { champsDeLEtape, lireValeurs, validerDemande, validerEtape } from '@/lib/validation/demande'

// Formulaire de contact en étapes (story 3.1, docs/architecture.md §6.1, variante A de l'annexe C
// de docs/trust-contact-launch.md, D08). Un seul <form>, quatre fieldset.
// - Sans JavaScript (et au rendu serveur) : les quatre parties à la suite, un POST natif vers la
//   Server Action ; la page revient avec le résumé d'erreurs et toutes les valeurs (WCAG 3.3.7).
// - Avec JavaScript : une partie à la fois (les autres restent dans le formulaire, cachées, et
//   partent avec lui), titre « Étape 2 sur 4 · … » qui reçoit le focus, filet de progression,
//   Retour, vérification de l'étape avant de continuer. Rien ne part avant l'envoi final, sauf la
//   demande de l'horodatage signé (sans aucune donnée saisie, story 3.5).
// - Brouillon : besoin, pays, langue et créneau seulement, dans le stockage de session.
// - Validation native coupée (`noValidate`) : des champs requis cachés bloqueraient l'envoi sans
//   rien dire ; les messages sont ceux du site, en tête et près du champ.

type Libelles = Record<string, string>

export type TextesFormulaire = {
  step: string
  steps: string[]
  fields: {
    besoin: { legend: string; options: Record<string, { label: string; category?: string }> }
    pourQui: { legend: string; options: Libelles }
    pays: { legend: string; options: Libelles }
    urgence: { legend: string; options: Libelles; notice: string }
    nom: { label: string }
    joindre: { legend: string; hint: string }
    email: { label: string }
    telephone: { label: string }
    creneau: { legend: string; hint: string; options: Libelles }
    langue: { legend: string; options: Libelles }
    message: { label: string; hint: string }
    origine: { legend: string; options: Libelles }
    consentement: { label: string; link: string }
    site: { label: string }
  }
  buttons: { continue: string; back: string; send: string; sending: string }
  errors: { prefix: string; one: string; many: string; codes: Record<CodeErreur, string> }
  status: { closed: string; tooEarly: string; limit: string; failed: string }
}

type RequestFormProps = {
  locale: 'fr' | 'en'
  textes: TextesFormulaire
  // Politique de confidentialité, section « Lorsque vous nous écrivez ».
  confidentialite: string
}

const ID: Record<Champ, string> = {
  besoin: 'contact-besoin',
  pourQui: 'contact-pour-qui',
  pays: 'contact-pays',
  urgence: 'contact-urgence',
  nom: 'contact-nom',
  email: 'contact-email',
  telephone: 'contact-telephone',
  creneau: 'contact-creneau',
  langue: 'contact-langue',
  message: 'contact-message',
  origine: 'contact-origine',
  consentement: 'contact-consentement',
}

// Groupes de choix : le lien du résumé d'erreurs mène à leur première option.
const PREMIERE_OPTION: Partial<Record<Champ, string>> = {
  besoin: BESOINS[0],
  pourQui: POUR_QUI[0],
  pays: PAYS[0],
  urgence: URGENCES[0],
  creneau: CRENEAUX[0],
  langue: LANGUES[0],
  origine: ORIGINES[0],
}

function ancre(champ: Champ): string {
  const premiere = PREMIERE_OPTION[champ]
  return `#${premiere ? choiceInputId(ID[champ], premiere) : ID[champ]}`
}

function options(libelles: Libelles, valeurs: readonly string[]): ChoiceOption[] {
  return valeurs.map((value) => ({ value, label: libelles[value] ?? value }))
}

// Statuts qui s'affichent en tête du formulaire et y reçoivent le focus.
const STATUTS: Partial<Record<StatutDemande, keyof TextesFormulaire['status']>> = {
  ferme: 'closed',
  'trop-tot': 'tooEarly',
  limite: 'limit',
  echec: 'failed',
}

// Faux au rendu serveur et sans JavaScript, vrai une fois le formulaire hydraté.
const abonner = () => () => {}

export function RequestForm({ locale, textes, confidentialite }: RequestFormProps) {
  const [etat, envoyer, enCours] = useActionState(envoyerDemande, ETAT_INITIAL)
  const enEtapes = useSyncExternalStore(
    abonner,
    () => true,
    () => false,
  )
  const [etape, setEtape] = useState(() =>
    etat.erreurs ? (premiereEtapeEnErreur(etat.erreurs) ?? 0) : 0,
  )
  const [erreurs, setErreurs] = useState<Erreurs>(etat.erreurs ?? {})
  // Chaque vérification qui échoue remonte le résumé, qui reprend alors le focus.
  const [tentative, setTentative] = useState(0)
  const [etatVu, setEtatVu] = useState(etat)
  const [jeton, setJeton] = useState(etat.jeton)
  const [urgent, setUrgent] = useState(etat.valeurs?.urgence === 'urgent')
  const formulaire = useRef<HTMLFormElement>(null)
  const statut = useRef<HTMLDivElement>(null)
  const titreAFocaliser = useRef(false)
  const etatTraite = useRef(etat)

  // Réponse du serveur : ses erreurs remplacent les nôtres, on se place à la première étape fautive.
  if (etat !== etatVu) {
    setEtatVu(etat)
    setErreurs(etat.erreurs ?? {})
    setTentative((n) => n + 1)
    setUrgent(etat.valeurs?.urgence === 'urgent')
    if (etat.jeton) setJeton(etat.jeton)
    const fautive = etat.erreurs ? premiereEtapeEnErreur(etat.erreurs) : null
    if (fautive !== null) setEtape(fautive)
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

  // Brouillon et présélection : coche les champs retenus ; une valeur inconnue ne coche rien. Relu
  // à chaque affichage : Next.js garde la page quittée en mémoire, et le besoin a pu être choisi
  // entre-temps sur une page de service.
  useEffect(() => {
    const champs = formulaire.current?.elements
    if (!champs) return
    for (const champ of CHAMPS_BROUILLON) {
      const valeur = lireBrouillon(champ)
      const groupe = champs.namedItem(champ)
      if (valeur && groupe instanceof RadioNodeList) groupe.value = valeur
    }
  }, [])

  // Changement d'étape : le focus va au titre de l'étape.
  useEffect(() => {
    if (!titreAFocaliser.current) return
    titreAFocaliser.current = false
    formulaire.current?.querySelector<HTMLElement>(`#etape-${etape + 1}-titre`)?.focus()
  }, [etape])

  // Statut de l'envoi : focus sur le message ; envoi traité, brouillon effacé. Une seule fois par
  // réponse, même si la page est réaffichée.
  useEffect(() => {
    if (etatTraite.current === etatVu) return
    etatTraite.current = etatVu
    if (etatVu.statut === 'ferme') effacerBrouillon()
    if (STATUTS[etatVu.statut]) statut.current?.focus()
  }, [etatVu])

  const remplacerErreurs = (index: number, trouvees: Erreurs) => {
    setErreurs((precedentes) => {
      const suivantes = { ...precedentes }
      for (const champ of champsDeLEtape(index)) delete suivantes[champ]
      return { ...suivantes, ...trouvees }
    })
  }

  const surEnvoi = (event: FormEvent<HTMLFormElement>) => {
    if (!enEtapes) return
    if (enCours) {
      event.preventDefault()
      return
    }
    const valeurs = lireValeurs(new FormData(event.currentTarget))
    if (etape < ETAPES.length - 1) {
      // « Continuer » (ou Entrée dans un champ) : on vérifie l'étape, rien ne part.
      event.preventDefault()
      const trouvees = validerEtape(etape, valeurs)
      remplacerErreurs(etape, trouvees)
      if (Object.keys(trouvees).length > 0) {
        setTentative((n) => n + 1)
        return
      }
      titreAFocaliser.current = true
      setEtape(etape + 1)
      return
    }
    const resultat = validerDemande(valeurs)
    if (!resultat.succes) {
      event.preventDefault()
      setErreurs(resultat.erreurs)
      setTentative((n) => n + 1)
      setEtape(premiereEtapeEnErreur(resultat.erreurs) ?? etape)
    }
    // Sinon, React appelle la Server Action avec les données du formulaire.
  }

  const surChangement = (event: FormEvent<HTMLFormElement>) => {
    const champ = event.target
    if (!(champ instanceof HTMLInputElement) || champ.type !== 'radio' || !champ.checked) return
    if (champ.name === 'urgence') setUrgent(champ.value === 'urgent')
    if (estChampBrouillon(champ.name)) ecrireBrouillon(champ.name, champ.value)
  }

  const retour = () => {
    titreAFocaliser.current = true
    setEtape((index) => Math.max(0, index - 1))
  }

  const v = etat.valeurs ?? {}
  const f = textes.fields
  const total = ETAPES.length
  // Avec JavaScript, le résumé ne cite que l'étape affichée : ses liens mènent à des champs visibles.
  const visibles = enEtapes
    ? CHAMPS.filter((champ) => (ETAPES[etape] as readonly Champ[]).includes(champ))
    : CHAMPS
  const resume = visibles.flatMap((champ) => {
    const code = erreurs[champ]
    return code ? [{ href: ancre(champ), message: textes.errors.codes[code] }] : []
  })
  const titreResume =
    resume.length === 1
      ? textes.errors.one
      : textes.errors.many.replace('{count}', String(resume.length))

  // Message près du champ : « Erreur : merci d'indiquer… » (minuscule après le deux-points en français).
  const erreur = (champ: Champ): string | undefined => {
    const code = erreurs[champ]
    if (!code) return undefined
    const message = textes.errors.codes[code]
    const suite = locale === 'fr' ? message.charAt(0).toLowerCase() + message.slice(1) : message
    return `${textes.errors.prefix} ${suite}`
  }

  const cleStatut = STATUTS[etatVu.statut]
  const derniere = etape === total - 1

  const partie = (index: number, contenu: ReactNode) => (
    <fieldset
      aria-labelledby={`etape-${index + 1}-titre`}
      hidden={enEtapes && index !== etape}
      className="m-0 flex min-w-0 flex-col gap-48 border-0 p-0"
    >
      <StepProgress
        id={`etape-${index + 1}-titre`}
        stepLabel={textes.step
          .replace('{current}', String(index + 1))
          .replace('{total}', String(total))}
        title={textes.steps[index] ?? ''}
        current={index + 1}
        total={total}
      />
      {contenu}
    </fieldset>
  )

  return (
    <form
      ref={formulaire}
      action={envoyer}
      noValidate
      onSubmit={surEnvoi}
      onChange={surChangement}
      className="flex flex-col gap-64"
    >
      {cleStatut ? (
        <div
          ref={statut}
          id="contact-statut"
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
        id="contact-erreurs"
        title={titreResume}
        errors={resume}
        focusOnMount={enEtapes}
      />

      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="jeton" value={jeton ?? ''} />
      {/* Piège à robots (story 3.5) : hors de l'écran, hors de la tabulation, ignoré des lecteurs
          d'écran ; un humain ne le remplit jamais. */}
      <div aria-hidden="true" className="sr-only">
        <label htmlFor="contact-site">{f.site.label}</label>
        <input id="contact-site" type="text" name="site" tabIndex={-1} autoComplete="off" />
      </div>

      {partie(
        0,
        <ChoiceRow
          id={ID.besoin}
          name="besoin"
          legend={f.besoin.legend}
          required
          defaultValue={v.besoin}
          error={erreur('besoin')}
          options={BESOINS.map((value) => ({
            value,
            label: f.besoin.options[value]?.label ?? value,
            category: f.besoin.options[value]?.category,
          }))}
        />,
      )}

      {partie(
        1,
        <>
          <ChoiceRow
            id={ID.pourQui}
            name="pourQui"
            legend={f.pourQui.legend}
            defaultValue={v.pourQui}
            error={erreur('pourQui')}
            options={options(f.pourQui.options, POUR_QUI)}
          />
          <ChoiceRow
            id={ID.pays}
            name="pays"
            legend={f.pays.legend}
            required
            columns={3}
            defaultValue={v.pays}
            error={erreur('pays')}
            options={options(f.pays.options, PAYS).map((option) =>
              option.value === 'non-dit' ? { ...option, wide: true } : option,
            )}
          />
          {/* « Urgent » : la mention des numéros d'urgence (annexe D.5, D41). Sans JavaScript, la
              règle `data-urgence` de tokens.css la montre seulement quand l'option est cochée. */}
          <div data-urgence className="flex flex-col gap-24">
            <ChoiceRow
              id={ID.urgence}
              name="urgence"
              legend={f.urgence.legend}
              required
              defaultValue={v.urgence}
              error={erreur('urgence')}
              options={options(f.urgence.options, URGENCES)}
            />
            <div aria-live="polite">
              {!enEtapes || urgent ? (
                <p data-mention-urgence className="border-l border-or pl-16 text-body text-encre">
                  {f.urgence.notice}
                </p>
              ) : null}
            </div>
          </div>
        </>,
      )}

      {partie(
        2,
        <>
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
          <fieldset
            aria-describedby="contact-joindre-aide"
            className="m-0 flex min-w-0 flex-col gap-32 border-0 p-0"
          >
            <legend className="mb-16 p-0 text-title-h3 text-sapin">{f.joindre.legend}</legend>
            <p id="contact-joindre-aide" className="text-body-s text-encre">
              {f.joindre.hint}
            </p>
            <TextField
              id={ID.email}
              name="email"
              type="email"
              label={f.email.label}
              autoComplete="email"
              maxLength={LIMITES.emailMax}
              defaultValue={v.email}
              error={erreur('email')}
            />
            <TextField
              id={ID.telephone}
              name="telephone"
              type="tel"
              label={f.telephone.label}
              autoComplete="tel"
              maxLength={LIMITES.telephoneMax}
              defaultValue={v.telephone}
              error={erreur('telephone')}
            />
          </fieldset>
          <ChoiceRow
            id={ID.creneau}
            name="creneau"
            legend={f.creneau.legend}
            hint={f.creneau.hint}
            columns={3}
            defaultValue={v.creneau}
            error={erreur('creneau')}
            options={options(f.creneau.options, CRENEAUX)}
          />
          <ChoiceRow
            id={ID.langue}
            name="langue"
            legend={f.langue.legend}
            required
            defaultValue={v.langue ?? locale}
            error={erreur('langue')}
            options={LANGUES.map((value) => ({
              value,
              label: f.langue.options[value] ?? value,
            }))}
          />
        </>,
      )}

      {partie(
        3,
        <>
          <TextField
            id={ID.message}
            name="message"
            label={f.message.label}
            hint={f.message.hint}
            multiline
            maxLength={LIMITES.messageMax}
            defaultValue={v.message}
            error={erreur('message')}
          />
          <ChoiceRow
            id={ID.origine}
            name="origine"
            legend={f.origine.legend}
            defaultValue={v.origine}
            error={erreur('origine')}
            options={options(f.origine.options, ORIGINES)}
          />
          <CheckboxField
            id={ID.consentement}
            name="consentement"
            label={f.consentement.label}
            required
            defaultChecked={v.consentement === 'oui'}
            error={erreur('consentement')}
            hint={
              // Nouvel onglet, annoncé : la page du formulaire et sa saisie restent ouvertes.
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
        </>,
      )}

      {/* Variante A : Retour à gauche, Continuer (ou Envoyer) à droite, même ordre au clavier. */}
      <div className="flex items-center justify-between gap-24">
        {enEtapes && etape > 0 ? (
          <Button variant="discret" onClick={retour}>
            {textes.buttons.back}
          </Button>
        ) : (
          <span aria-hidden="true" />
        )}
        <Button type="submit" pending={enCours ? textes.buttons.sending : undefined}>
          {enEtapes && !derniere ? textes.buttons.continue : textes.buttons.send}
        </Button>
      </div>
      <p role="status" className="sr-only">
        {enCours ? textes.buttons.sending : ''}
      </p>
    </form>
  )
}
