import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { connection } from 'next/server'
import { BookingNotice } from '@/components/sections/BookingNotice'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { bookingCalendarPath, localizedPath, type Locale } from '@/i18n/pathnames'
import { libelleHeure, libelleJour } from '@/lib/booking/display'
import { lirePageConfirmation } from '@/lib/booking/link-page'
import { DEFAULT_BOOKING_SETTINGS } from '@/lib/booking/settings'
import { zonedParts } from '@/lib/booking/zoned-time'

// Confirmation d'un appel réservé (story 3.10 ; docs/reservation-appel.md §2, étape 4) : le jour et
// l'heure (Bruxelles), la mention « pas de message vocal », et « Ajouter à mon agenda » (fichier .ics
// produit sur le serveur, ./agenda). Lue à chaque affichage, sans rien écrire, tant que l'appel est
// confirmé et pas encore passé ; jusqu'à la story 3.11 (lien de gestion), le lien d'accès consommé en
// est la clé. Sinon, la même page sobre que pour un lien qui ne vaut plus. Aucun e-mail : la
// confirmation par e-mail et la notification à Cat attendent la story 3.3.

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations({ locale, namespace: 'Booking' })
  return {
    title: t('confirmation.metaTitle'),
    robots: { index: false, follow: false },
    referrer: 'strict-origin',
  }
}

export default async function Page({
  params,
}: PageProps<'/[locale]/contact/appel/[jeton]/confirmation'>) {
  // À chaque requête, avant toute lecture de l'heure ou de la base (layout et page se rendent en
  // parallèle : la connexion du layout ne suffit pas).
  await connection()
  const { jeton } = await params
  const locale = (await rootParams.locale()) as Locale
  const lu = await lirePageConfirmation(jeton)
  if (lu.etat === 'invalide') return <BookingNotice locale={locale} kind="invalid" />
  if (lu.etat === 'indisponible') return <BookingNotice locale={locale} kind="unavailable" />

  const t = await getTranslations('Booking.confirmation')
  const { date, time } = zonedParts(lu.confirmation.start, DEFAULT_BOOKING_SETTINGS.timeZone)
  return (
    <div className="conteneur py-section">
      <div className="mx-auto flex max-w-measure flex-col gap-24">
        <Rule short />
        <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
          {t('title')}
        </h1>
        <p className="text-body-l text-encre">
          {t('when', { jour: libelleJour(date, locale), heure: libelleHeure(time, locale) })}
        </p>
        <p className="text-body-l">{t('body')}</p>
        <div className="flex flex-col gap-8">
          {/* Lien simple (pas de préchargement) vers le fichier produit sur le serveur. */}
          <a
            href={bookingCalendarPath(locale, jeton)}
            download="maison-triona-appel.ics"
            className="inline-flex min-h-touch items-center self-start text-sapin underline decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:decoration-sapin"
          >
            {t('calendar')}
          </a>
          <p className="text-body-s text-encre">{t('calendarHint')}</p>
        </div>
        <p>
          <TextLink href={localizedPath('/', locale)}>{t('back')}</TextLink>
        </p>
      </div>
    </div>
  )
}
