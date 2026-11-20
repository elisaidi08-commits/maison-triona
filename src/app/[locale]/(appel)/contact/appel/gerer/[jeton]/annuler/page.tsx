import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { connection } from 'next/server'
import { annulerAppel } from '@/actions/booking-manage'
import { BookingNotice } from '@/components/sections/BookingNotice'
import { Button } from '@/components/ui/Button'
import { Rule } from '@/components/ui/Rule'
import { managePath, type Locale } from '@/i18n/pathnames'
import { libelleHeure, libelleJour } from '@/lib/booking/display'
import { lirePageGestion } from '@/lib/booking/link-page'
import { DEFAULT_BOOKING_SETTINGS } from '@/lib/booking/settings'
import { zonedParts } from '@/lib/booking/zoned-time'

// Annuler un appel (story 3.11 ; docs/reservation-appel.md §2, étape 6) : une page de confirmation,
// puis un seul bouton, formulaire natif vers la Server Action (fonctionne sans JavaScript). Afficher
// cette page n'annule rien (un GET n'engage rien, §4.4). Appel commencé ou déjà annulé : une phrase et
// le retour à la page de gestion. `?echec=1`, `?limite=1` : retour d'une annulation qui n'a pas abouti.
// Lien qui ne vaut plus : la même page sobre que partout.

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations({ locale, namespace: 'Booking.cancelPage' })
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
}: PageProps<'/[locale]/contact/appel/gerer/[jeton]/annuler'>) {
  await connection()
  const { jeton } = await params
  const locale = (await rootParams.locale()) as Locale
  const lu = await lirePageGestion(jeton, locale)
  if (lu.etat === 'invalide') return <BookingNotice locale={locale} kind="invalid" />
  if (lu.etat === 'indisponible') return <BookingNotice locale={locale} kind="unavailable" />

  const t = await getTranslations('Booking.cancelPage')
  const recherche = await searchParams
  const erreur =
    recherche.limite === '1' ? t('limit') : recherche.echec === '1' ? t('failed') : null
  const { date, time } = zonedParts(lu.appel.start, DEFAULT_BOOKING_SETTINGS.timeZone)
  const retour = (
    <a href={managePath(locale, jeton)} className={LIEN}>
      {t('keep')}
    </a>
  )

  return (
    <div className="conteneur py-section">
      <div className="mx-auto flex max-w-measure flex-col gap-24">
        <Rule short />
        <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
          {t('title')}
        </h1>
        {lu.phase !== 'upcoming' ? (
          <>
            <p className="text-body-l">{t('unavailable')}</p>
            {retour}
          </>
        ) : (
          <>
            {erreur ? (
              <div className="border-l-2 border-sapin py-8 pl-24">
                <p role="status" className="text-title-h3 text-sapin">
                  {erreur}
                </p>
              </div>
            ) : null}
            <p className="text-body-l">
              {t('body', { jour: libelleJour(date, locale), heure: libelleHeure(time, locale) })}
            </p>
            <form action={annulerAppel} className="flex flex-col gap-24">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="jeton" value={jeton} />
              <div>
                <Button type="submit">{t('confirm')}</Button>
              </div>
            </form>
            {retour}
          </>
        )}
      </div>
    </div>
  )
}
