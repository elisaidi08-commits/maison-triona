import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'

// Réponse à une demande de lien (story 3.9 ; docs/reservation-appel.md §2, étape 1) : TOUJOURS la
// même, qu'un lien parte ou non (adresse inconnue, déjà limitée, robot), pour que la page ne dise rien
// d'une adresse. Page statique, noindex, hors du sitemap ; elle ne lit aucun paramètre et ne reprend
// pas l'adresse. Texte en brouillon (content/brouillons.json : `BookingLink`).

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations({ locale, namespace: 'BookingLink.sent' })
  // Description même en noindex : seuil SEO de Lighthouse (constat n° 7 de docs/a11y-report.md).
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    robots: { index: false, follow: false },
  }
}

export default async function Page() {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations('BookingLink.sent')
  return (
    <div className="conteneur py-section">
      <div className="mx-auto flex max-w-measure flex-col gap-24">
        <Rule short />
        <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
          {t('title')}
        </h1>
        <p className="text-body-l">{t('body')}</p>
        <p>
          <TextLink href={localizedPath('/', locale)}>{t('back')}</TextLink>
        </p>
      </div>
    </div>
  )
}
