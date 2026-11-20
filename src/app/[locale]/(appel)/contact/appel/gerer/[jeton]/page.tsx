import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { connection } from 'next/server'
import { MoveBookingForm, type TextesDeplacement } from '@/components/forms/MoveBookingForm'
import { BookingNotice } from '@/components/sections/BookingNotice'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, manageCalendarPath, manageCancelPath, type Locale } from '@/i18n/pathnames'
import { etatRetenu } from '@/lib/booking/action-state'
import { libelleHeure, libelleJour } from '@/lib/booking/display'
import { lirePageGestion } from '@/lib/booking/link-page'
import type { EtatDeplacement } from '@/lib/booking/manage-form'
import { DEFAULT_BOOKING_SETTINGS } from '@/lib/booking/settings'
import { zonedParts } from '@/lib/booking/zoned-time'

// Page de gestion d'un appel (story 3.11 ; docs/reservation-appel.md §2, étapes 4 et 6), par le lien
// de gestion : elle tient lieu de confirmation après la réservation. Le jour et l'heure (Bruxelles),
// « Ajouter à mon agenda » (fichier .ics, ./agenda), puis déplacer (autres créneaux, MoveBookingForm)
// et annuler (page de confirmation, ./annuler). Appel commencé : on ne peut plus rien y changer ; annulé :
// « Retirer de mon agenda » (METHOD:CANCEL) et « Convenir d'un autre appel ». Lue à chaque affichage,
// sans rien écrire (un GET n'engage rien, §4.4). Lien inconnu, mal formé, expiré (fin de l'appel) ou
// annulé : la même page sobre que pour un lien de réservation. `?deplace=1` : retour d'un
// déplacement abouti, rien de personnel dans l'adresse. Liens simples (`<a>`) vers les pages qui
// portent le jeton : pas de préchargement. Textes en brouillon (content/brouillons.json).

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations({ locale, namespace: 'Booking.manage' })
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
    referrer: 'strict-origin',
  }
}

const LIEN =
  'inline-flex min-h-touch items-center self-start text-sapin underline decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:decoration-sapin'

export default async function Page({
  params,
  searchParams,
}: PageProps<'/[locale]/contact/appel/gerer/[jeton]'>) {
  // À chaque requête, avant toute lecture de l'heure ou de la base.
  await connection()
  const { jeton } = await params
  const locale = (await rootParams.locale()) as Locale
  const lu = await lirePageGestion(jeton, locale, { creneaux: true })
  if (lu.etat === 'invalide') return <BookingNotice locale={locale} kind="invalid" />
  if (lu.etat === 'indisponible') return <BookingNotice locale={locale} kind="unavailable" />

  const etat = await etatRetenu<EtatDeplacement>()
  const deplace = (await searchParams).deplace === '1' && lu.phase === 'upcoming'
  const t = await getTranslations('Booking.manage')
  const { date, time } = zonedParts(lu.appel.start, DEFAULT_BOOKING_SETTINGS.timeZone)
  const quand = t('when', { jour: libelleJour(date, locale), heure: libelleHeure(time, locale) })
  const textes: TextesDeplacement = {
    slots: t.raw('move.slots') as TextesDeplacement['slots'],
    button: t('move.button'),
    sending: t('move.sending'),
    errors: t.raw('move.errors') as TextesDeplacement['errors'],
    status: t.raw('move.status') as TextesDeplacement['status'],
  }
  // Annulé par la maison (D78) : la personne n'y est pour rien, la page le dit et propose un autre
  // appel ; par la personne : « Votre appel est annulé. »
  const titre =
    lu.phase === 'cancelled'
      ? lu.appel.status === 'cancelled_by_house'
        ? t('cancelled.byHouse')
        : t('cancelled.title')
      : lu.phase === 'started'
        ? t('started.title')
        : t('title')

  return (
    <div className="conteneur py-section">
      <div className="mx-auto flex max-w-measure flex-col gap-64">
        <header className="flex flex-col gap-24">
          <Rule short />
          <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
            {titre}
          </h1>
          <p className="text-body-l text-encre">{quand}</p>
          {deplace ? (
            <div className="border-l-2 border-sapin py-8 pl-24">
              <p role="status" className="text-body-l text-sapin">
                {t('moved')}
              </p>
            </div>
          ) : null}
          {lu.phase === 'upcoming' ? (
            <>
              <p className="text-body-l">{t('body')}</p>
              <p className="border-l border-or pl-16 text-body text-encre">{t('keep')}</p>
            </>
          ) : null}
          {lu.phase === 'started' ? <p className="text-body-l">{t('started.body')}</p> : null}
          {lu.phase === 'cancelled' ? <p className="text-body-l">{t('cancelled.body')}</p> : null}
          {lu.phase !== 'started' ? (
            <div className="flex flex-col gap-8">
              {/* Lien simple (pas de préchargement) vers le fichier produit sur le serveur. */}
              <a
                href={manageCalendarPath(locale, jeton)}
                download="maison-triona-appel.ics"
                className={LIEN}
              >
                {lu.phase === 'cancelled' ? t('cancelled.calendar') : t('calendar')}
              </a>
              <p className="text-body-s text-encre">
                {lu.phase === 'cancelled' ? t('cancelled.calendarHint') : t('calendarHint')}
              </p>
            </div>
          ) : null}
        </header>

        {lu.phase === 'upcoming' ? (
          <section aria-labelledby="deplacer-titre" className="flex flex-col gap-24">
            <h2 id="deplacer-titre" className="font-display text-title-h2 text-sapin">
              {t('move.title')}
            </h2>
            {lu.creneaux.length === 0 ? (
              <p className="text-body-l">{t('move.none')}</p>
            ) : (
              <>
                <p className="text-body-l">{t('move.intro')}</p>
                <MoveBookingForm
                  locale={locale}
                  jeton={jeton}
                  creneaux={lu.creneaux}
                  etatInitial={etat}
                  textes={textes}
                />
              </>
            )}
          </section>
        ) : null}

        {lu.phase === 'upcoming' ? (
          <section aria-labelledby="annuler-titre" className="flex flex-col gap-24">
            <h2 id="annuler-titre" className="font-display text-title-h2 text-sapin">
              {t('cancel.title')}
            </h2>
            <p className="text-body-l">{t('cancel.intro')}</p>
            <a href={manageCancelPath(locale, jeton)} className={LIEN}>
              {t('cancel.link')}
            </a>
          </section>
        ) : null}

        <ul className="flex flex-col gap-8">
          {lu.phase === 'cancelled' ? (
            <li>
              <TextLink href={localizedPath('/contact/appel', locale)}>
                {t('cancelled.newCall')}
              </TextLink>
            </li>
          ) : null}
          {lu.phase === 'started' ? (
            <li>
              <TextLink href={localizedPath('/contact', locale)}>{t('write')}</TextLink>
            </li>
          ) : null}
          <li>
            <TextLink href={localizedPath('/', locale)}>{t('back')}</TextLink>
          </li>
        </ul>
      </div>
    </div>
  )
}
