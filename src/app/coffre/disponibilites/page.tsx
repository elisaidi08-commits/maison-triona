import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { ErrorSummary } from '@/components/ui/ErrorSummary'
import { TextField } from '@/components/ui/TextField'
import { lireAccesRequete } from '@/lib/auth/serveur'
import { belgianHolidays } from '@/lib/booking/belgian-holidays'
import { callsDuring, toSlotConfig } from '@/lib/booking/config'
import type { StoredException, StoredRule } from '@/lib/booking/config'
import { listConfirmedCalls, loadAvailability } from '@/lib/booking/repository'
import { DEFAULT_BOOKING_SETTINGS, SETTINGS_LIMITS } from '@/lib/booking/settings'
import type { BookingSettings, SettingLimit } from '@/lib/booking/settings'
import { computeSlots } from '@/lib/booking/slots'
import type { BookedCall, Slot } from '@/lib/booking/slots'
import { addDays, zonedParts, zonedTimeToUtc } from '@/lib/booking/zoned-time'
import {
  dateEnLettres,
  ERREURS,
  heureEnLettres,
  JOURS_SEMAINE,
  lireStatut,
  SUCCES,
  TYPES_ABSENCE,
} from '@/lib/coffre/disponibilites'
import { getCoffrePool } from '@/lib/db/pool'
import { MINUTES_PAR_HEURE } from '@/lib/validation/disponibilites'

import { seDeconnecter } from '../actions'
import { EnTete } from '../_composants/EnTete'
import { LienCoffre } from '../_composants/LienCoffre'
import {
  ajouterAbsence,
  ajouterPlage,
  bloquerJournee,
  enregistrerJoursFeries,
  enregistrerReglages,
  preremplirJoursFeries,
  retirerAbsence,
  retirerPlage,
} from './actions'

// Disponibilités de Cat (story 3.8, partie B ; docs/reservation-appel.md §3.1) : semaine type, réglages
// des appels, absences, jours fériés, et l'aperçu des prochains créneaux calculés par computeSlots
// avec ces réglages, pour en voir l'effet. Session ouverte par le TOTP exigée. Formulaires natifs vers
// des actions serveur (./actions.ts), chacune journalisée sans valeur. La page ne fait que lire :
// Next 16 (Cache Components) peut la rendre deux fois par requête. Rien de personnel ici : des heures
// et des dates. Sans icône ; textes internes, en français.

export const metadata: Metadata = { title: 'Disponibilités' }

const FUSEAU = DEFAULT_BOOKING_SETTINGS.timeZone

function pluriel(nombre: number, singulier: string, plurielForme: string): string {
  return `${nombre} ${nombre === 1 ? singulier : plurielForme}`
}

// « De 15 à 120 minutes » : bornes des champs, tirées de SETTINGS_LIMITS (jamais recopiées).
function intervalle(limite: SettingLimit, unite: string, diviseur = 1): string {
  return `De ${limite.min / diviseur} à ${limite.max / diviseur} ${unite}`
}

function plageEnLettres(plage: StoredRule): string {
  return `${heureEnLettres(plage.start)} à ${heureEnLettres(plage.end)}`
}

function absenceEnLettres(absence: StoredException): string {
  if (absence.startDate === absence.endDate) return dateEnLettres(absence.startDate)
  return `Du ${dateEnLettres(absence.startDate).toLowerCase()} au ${dateEnLettres(absence.endDate).toLowerCase()}`
}

function parJour(creneaux: Slot[]): { date: string; heures: string[] }[] {
  const jours = new Map<string, string[]>()
  for (const creneau of creneaux) {
    jours.set(creneau.localDate, [...(jours.get(creneau.localDate) ?? []), creneau.localTime])
  }
  return [...jours].map(([date, heures]) => ({ date, heures }))
}

function Section({ id, titre, children }: { id: string; titre: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-titre`} className="flex max-w-measure flex-col gap-24">
      <h2 id={`${id}-titre`} className="text-title-h3 text-encre">
        {titre}
      </h2>
      {children}
    </section>
  )
}

function Apercu({
  jours,
  nombre,
  horizon,
}: {
  jours: ReturnType<typeof parJour>
  nombre: number
  horizon: number
}) {
  return (
    <Section id="apercu" titre="Prochains créneaux">
      <p>
        Ce qu’une personne verrait aujourd’hui en demandant un appel, avec les réglages ci-dessous :{' '}
        {pluriel(nombre, 'créneau', 'créneaux')} sur les {pluriel(horizon, 'jour', 'jours')} à
        venir, à l’heure de Bruxelles. Les appels déjà confirmés en sont retirés.
      </p>
      {jours.length === 0 ? (
        <p>Aucun créneau à proposer avec ces réglages.</p>
      ) : (
        <ul className="flex flex-col border-t border-sapin-20">
          {jours.map(({ date, heures }) => (
            <li
              key={date}
              className="flex flex-col gap-8 border-b border-sapin-20 py-16 md:flex-row md:items-center md:justify-between md:gap-24"
            >
              <div className="flex flex-col gap-4">
                <p className="text-body text-encre">{dateEnLettres(date)}</p>
                <p className="text-body-s text-encre">{heures.map(heureEnLettres).join(' · ')}</p>
              </div>
              <form action={bloquerJournee}>
                <input type="hidden" name="date" value={date} />
                <Button type="submit" variant="discret">
                  Bloquer cette journée<span className="sr-only"> : {dateEnLettres(date)}</span>
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

function SemaineType({ plages, duree, pas }: { plages: StoredRule[]; duree: number; pas: number }) {
  return (
    <Section id="semaine" titre="Semaine type">
      <p>
        Les plages où vous acceptez des appels, chaque semaine. Un premier appel commence au début
        de la plage, les suivants toutes les {pas} minutes (appel de {duree} minutes et pause), tant
        qu’ils finissent avant la fin de la plage.
      </p>
      <dl className="flex flex-col border-t border-sapin-20">
        {JOURS_SEMAINE.map(({ jour, nom }) => {
          const duJour = plages.filter((plage) => plage.weekday === jour)
          return (
            <div key={jour} className="flex flex-col gap-4 border-b border-sapin-20 py-12">
              <dt className="text-label text-encre uppercase">{nom}</dt>
              {duJour.length === 0 ? (
                <dd className="text-body text-encre">Aucune plage</dd>
              ) : (
                duJour.map((plage) => (
                  <dd
                    key={plage.id}
                    className="flex flex-wrap items-center justify-between gap-x-24 text-body text-encre"
                  >
                    <span>{plageEnLettres(plage)}</span>
                    <form action={retirerPlage}>
                      <input type="hidden" name="id" value={plage.id} />
                      <Button type="submit" variant="discret">
                        Retirer
                        <span className="sr-only">
                          {' '}
                          la plage du {nom.toLowerCase()} de {plageEnLettres(plage)}
                        </span>
                      </Button>
                    </form>
                  </dd>
                ))
              )}
            </div>
          )
        })}
      </dl>

      <form
        action={ajouterPlage}
        aria-labelledby="ajout-plage-titre"
        className="flex flex-col gap-24"
      >
        <h3 id="ajout-plage-titre" className="text-body-l text-encre">
          Ajouter une plage
        </h3>
        <div className="flex flex-col gap-8">
          <label htmlFor="plage-jour" className="text-label text-encre uppercase">
            Jour
          </label>
          <select
            id="plage-jour"
            name="jour"
            required
            className="min-h-touch w-full rounded-none border-0 border-b border-encre-68 bg-transparent px-0 py-8 text-body text-encre"
          >
            {JOURS_SEMAINE.map(({ jour, nom }) => (
              <option key={jour} value={jour}>
                {nom}
              </option>
            ))}
          </select>
        </div>
        <TextField id="plage-debut" name="debut" label="Début" type="time" required />
        <TextField id="plage-fin" name="fin" label="Fin" type="time" required />
        <div>
          <Button type="submit">Ajouter la plage</Button>
        </div>
      </form>
    </Section>
  )
}

function Reglages({ reglages }: { reglages: BookingSettings }) {
  const L = SETTINGS_LIMITS
  return (
    <Section id="reglages" titre="Réglages des appels">
      <p>Heure de Bruxelles (Europe/Brussels), pour toutes les plages et tous les créneaux.</p>
      <form action={enregistrerReglages} className="flex flex-col gap-24">
        <TextField
          id="duree"
          name="duree"
          label="Durée d’un appel, en minutes"
          type="number"
          min={L.durationMinutes.min}
          max={L.durationMinutes.max}
          step={L.durationMinutes.step}
          required
          defaultValue={String(reglages.durationMinutes)}
          hint={`${intervalle(L.durationMinutes, 'minutes')}, par pas de ${L.durationMinutes.step}.`}
        />
        <TextField
          id="pause"
          name="pause"
          label="Pause entre deux appels, en minutes"
          type="number"
          min={L.bufferMinutes.min}
          max={L.bufferMinutes.max}
          step={L.bufferMinutes.step}
          required
          defaultValue={String(reglages.bufferMinutes)}
          hint={`${intervalle(L.bufferMinutes, 'minutes')}, par pas de ${L.bufferMinutes.step}.`}
        />
        <TextField
          id="delai"
          name="delai"
          label="Délai minimal avant un appel, en heures"
          type="number"
          min={L.minNoticeMinutes.min / MINUTES_PAR_HEURE}
          max={L.minNoticeMinutes.max / MINUTES_PAR_HEURE}
          step={L.minNoticeMinutes.step / MINUTES_PAR_HEURE}
          required
          defaultValue={String(reglages.minNoticeMinutes / MINUTES_PAR_HEURE)}
          hint={`${intervalle(L.minNoticeMinutes, 'heures', MINUTES_PAR_HEURE)} : au moins ce délai entre la réservation et le début de l’appel.`}
        />
        <TextField
          id="horizon"
          name="horizon"
          label="Horizon de réservation, en jours"
          type="number"
          min={L.horizonDays.min}
          max={L.horizonDays.max}
          step={L.horizonDays.step}
          required
          defaultValue={String(reglages.horizonDays)}
          hint={`${intervalle(L.horizonDays, 'jours')}, aujourd’hui compris ; 21 jours font trois semaines.`}
        />
        <TextField
          id="plafond"
          name="plafond"
          label="Plafond d’appels par jour"
          type="number"
          min={L.dailyCap.min}
          max={L.dailyCap.max}
          step={L.dailyCap.step}
          required
          defaultValue={String(reglages.dailyCap)}
          hint={`${intervalle(L.dailyCap, 'appels confirmés')} : une fois le plafond atteint, la journée ne propose plus de créneau.`}
        />
        <div>
          <Button type="submit">Enregistrer les réglages</Button>
        </div>
      </form>
    </Section>
  )
}

function Absences({
  absences,
  appels,
  aujourdhui,
}: {
  absences: StoredException[]
  appels: BookedCall[]
  aujourdhui: string
}) {
  return (
    <Section id="absences" titre="Absences">
      <p>
        Congés et journées bloquées à venir : aucun créneau n’y est proposé. Les appels déjà
        confirmés ces jours-là sont gardés et signalés ici, à déplacer un par un.
      </p>
      {absences.length === 0 ? (
        <p>Aucune absence à venir.</p>
      ) : (
        <ul className="flex flex-col border-t border-sapin-20">
          {absences.map((absence) => {
            const gardes = callsDuring(appels, absence, FUSEAU).length
            const libelle = `${TYPES_ABSENCE[absence.kind]} : ${absenceEnLettres(absence)}`
            return (
              <li key={absence.id} className="flex flex-col gap-8 border-b border-sapin-20 py-12">
                <div className="flex flex-wrap items-center justify-between gap-x-24">
                  <span className="text-body text-encre">{libelle}</span>
                  <form action={retirerAbsence}>
                    <input type="hidden" name="id" value={absence.id} />
                    <Button type="submit" variant="discret">
                      {absence.kind === 'blocked' ? 'Débloquer' : 'Retirer'}
                      <span className="sr-only"> : {libelle}</span>
                    </Button>
                  </form>
                </div>
                {gardes > 0 ? (
                  <p className="border-l-2 border-encre py-8 pl-24">
                    Attention : {pluriel(gardes, 'appel déjà confirmé', 'appels déjà confirmés')}{' '}
                    pendant cette absence, {gardes === 1 ? 'gardé' : 'gardés'}. À déplacer un par
                    un.
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <form
        action={ajouterAbsence}
        aria-labelledby="ajout-absence-titre"
        className="flex flex-col gap-24"
      >
        <h3 id="ajout-absence-titre" className="text-body-l text-encre">
          Ajouter une absence
        </h3>
        <TextField id="absence-du" name="du" label="Du" type="date" min={aujourdhui} required />
        <TextField
          id="absence-au"
          name="au"
          label="Au, inclus"
          type="date"
          min={aujourdhui}
          required
          hint="Pour une seule journée, la même date deux fois."
        />
        <div>
          <Button type="submit">Ajouter l’absence</Button>
        </div>
      </form>
    </Section>
  )
}

function JoursFeries({
  feries,
  appels,
  aPreremplir,
}: {
  feries: StoredException[]
  appels: BookedCall[]
  aPreremplir: number[]
}) {
  const annees = [...new Set(feries.map((ferie) => ferie.startDate.slice(0, 4)))]
  return (
    <Section id="feries" titre="Jours fériés">
      <p>
        Les jours fériés belges sont fermés aux appels d’office. Décochez ceux où vous acceptez des
        appels ; recochez-les pour les fermer de nouveau.
      </p>
      {feries.length > 0 ? (
        <form action={enregistrerJoursFeries} className="flex flex-col gap-24">
          {annees.map((annee) => (
            <fieldset key={annee} className="flex flex-col">
              <legend className="text-label text-encre uppercase">
                {annee} : jours cochés fermés aux appels
              </legend>
              {feries
                .filter((ferie) => ferie.startDate.startsWith(annee))
                .map((ferie) => {
                  const gardes = callsDuring(appels, ferie, FUSEAU).length
                  return (
                    <div key={ferie.id}>
                      <input type="hidden" name="affiches" value={ferie.startDate} />
                      <CheckboxField
                        id={`ferie-${ferie.startDate}`}
                        name="fermes"
                        value={ferie.startDate}
                        label={`${dateEnLettres(ferie.startDate)} · ${ferie.label ?? TYPES_ABSENCE.holiday}`}
                        defaultChecked={ferie.active}
                        hint={
                          ferie.active && gardes > 0
                            ? `Attention : ${pluriel(gardes, 'appel déjà confirmé ce jour-là, gardé', 'appels déjà confirmés ce jour-là, gardés')}. À déplacer un par un.`
                            : undefined
                        }
                      />
                    </div>
                  )
                })}
            </fieldset>
          ))}
          <div>
            <Button type="submit">Enregistrer les jours fériés</Button>
          </div>
        </form>
      ) : null}
      {aPreremplir.map((annee) => (
        <form key={annee} action={preremplirJoursFeries} className="flex flex-col gap-16">
          <p>Les jours fériés de {annee} ne sont pas encore préremplis.</p>
          <input type="hidden" name="annee" value={annee} />
          <div>
            <Button type="submit" variant="discret">
              Préremplir les jours fériés de {annee}
            </Button>
          </div>
        </form>
      ))}
    </Section>
  )
}

export default async function PageDisponibilites({
  searchParams,
}: PageProps<'/coffre/disponibilites'>) {
  const statut = lireStatut(await searchParams)
  const acces = await lireAccesRequete()
  if (acces.etat === 'anonyme') redirect('/coffre/connexion')
  if (acces.etat === 'enrolement') redirect('/coffre/enrolement')

  const maintenant = new Date()
  const aujourdhui = zonedParts(maintenant, FUSEAU).date
  const annee = Number(aujourdhui.slice(0, 4))
  const pool = getCoffrePool()
  const etat = await loadAvailability(pool, { since: aujourdhui })

  const absences = etat.exceptions.filter((absence) => absence.kind !== 'holiday')
  // Jours fériés à venir, cette année et la suivante.
  const feries = etat.exceptions.filter(
    (absence) => absence.kind === 'holiday' && Number(absence.startDate.slice(0, 4)) <= annee + 1,
  )

  // Appels confirmés jusqu'au bout de l'horizon et de la dernière absence affichée (aucun avant la
  // story 3.10) : retirés de l'aperçu, signalés sur les absences.
  const dernierJour = [...absences, ...feries].reduce(
    (dernier, absence) => (absence.endDate > dernier ? absence.endDate : dernier),
    addDays(aujourdhui, etat.settings.horizonDays),
  )
  const appels = await listConfirmedCalls(
    pool,
    maintenant,
    zonedTimeToUtc(addDays(dernierJour, 1), '00:00', FUSEAU),
  )
  const creneaux = computeSlots({
    ...toSlotConfig(etat),
    bookings: appels,
    busy: [],
    now: maintenant,
  })
  // Années dont un jour férié à venir manque (au-delà de 2035, ou effacé à la main).
  const connus = new Set(feries.map((ferie) => ferie.startDate))
  const aPreremplir = [annee, annee + 1].filter((une) =>
    belgianHolidays(une).some((ferie) => ferie.date >= aujourdhui && !connus.has(ferie.date)),
  )

  return (
    <>
      <EnTete titre="Disponibilités">
        <p>
          Session de {acces.compte.nom}. Vos réglages décident des créneaux proposés aux personnes
          qui souhaitent convenir d’un appel. Chaque modification est inscrite au journal d’accès,
          sans les valeurs.
        </p>
        <p>
          <LienCoffre href="/coffre">Retour à la liste des demandes</LienCoffre>
        </p>
      </EnTete>

      {statut?.ok ? (
        <p role="status" className="max-w-measure border-l-2 border-or py-8 pl-24">
          {SUCCES[statut.ok]}
        </p>
      ) : null}
      {statut?.erreur ? (
        <div className="max-w-measure">
          <ErrorSummary
            id="erreurs-disponibilites"
            title="La modification n’a pas abouti"
            errors={[
              { href: ERREURS[statut.erreur].ancre, message: ERREURS[statut.erreur].message },
            ]}
            focusOnMount
          />
        </div>
      ) : null}

      <Apercu
        jours={parJour(creneaux)}
        nombre={creneaux.length}
        horizon={etat.settings.horizonDays}
      />
      <SemaineType
        plages={etat.rules}
        duree={etat.settings.durationMinutes}
        pas={etat.settings.durationMinutes + etat.settings.bufferMinutes}
      />
      <Reglages reglages={etat.settings} />
      <Absences absences={absences} appels={appels} aujourdhui={aujourdhui} />
      <JoursFeries feries={feries} appels={appels} aPreremplir={aPreremplir} />

      <form action={seDeconnecter}>
        <Button type="submit" variant="discret">
          Se déconnecter
        </Button>
      </form>
    </>
  )
}
