import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { BookingLinkForm, type TextesDemandeLien } from '@/components/forms/BookingLinkForm'
import { Rule } from '@/components/ui/Rule'
import { localizedPath, type Locale } from '@/i18n/pathnames'

// Demande d'un lien de réservation d'appel (story 3.9 ; docs/reservation-appel.md §2, étape 1) : la
// page ne demande que l'adresse e-mail ; la langue vient de l'URL. Même colonne que le contact. Page
// statique (garde `ensureStatic` du layout) : l'envoi est une Server Action, en POST. Noindex et hors
// du sitemap, comme le remerciement : elle n'a rien à dire aux moteurs `[À CONFIRMER par Sady]`.
// Textes en brouillon (content/brouillons.json : `BookingLink`) ; le libellé « Convenir d'un appel »
// reste à valider par Cat (hors de la liste des CTA approuvés, spec §9).

// Section « Lorsque vous convenez d'un appel » de la politique : son ancre change avec la langue.
const ANCRE_APPEL: Record<Locale, string> = { fr: 'appel', en: 'call' }

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations({ locale, namespace: 'BookingLink.request' })
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

export default async function Page() {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations('BookingLink.request')
  return (
    <div className="conteneur py-section">
      <div className="mx-auto flex max-w-measure flex-col gap-64">
        <header className="flex flex-col gap-24">
          <Rule short />
          <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
            {t('title')}
          </h1>
          <p className="text-body-l">{t('intro')}</p>
        </header>
        <BookingLinkForm
          locale={locale}
          textes={t.raw('form') as TextesDemandeLien}
          confidentialite={`${localizedPath('/confidentialite', locale)}#${ANCRE_APPEL[locale]}`}
        />
      </div>
    </div>
  )
}
