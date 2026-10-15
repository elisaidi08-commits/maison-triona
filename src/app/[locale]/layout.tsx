import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { LanguageSuggestion } from '@/components/layout/LanguageSuggestion'
import { MobileBar } from '@/components/layout/MobileBar'
import { SkipLink } from '@/components/layout/SkipLink'
import { localizedPath } from '@/i18n/pathnames'
import { routing, type Locale } from '@/i18n/routing'
import { manrope, newsreader } from '@/styles/fonts'
import '@/styles/tokens.css'

// Layout racine par langue (/fr, /en). La langue vient du segment [locale] via next/root-params.

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

// Le site reste en noindex tant que SITE_INDEXABLE ne vaut pas « true » (ouverture, story 5.5).
const indexable = process.env.SITE_INDEXABLE === 'true'

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await rootParams.locale()) as Locale
  return {
    metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
    title: { default: 'Maison Triona', template: '%s · Maison Triona' },
    robots: { index: indexable, follow: indexable },
    // Image de partage typographique (story 1.3) ; à recomposer sur P01-d quand elle sera validée.
    openGraph: {
      siteName: 'Maison Triona',
      locale: locale === 'fr' ? 'fr_FR' : 'en_GB',
      images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: 'Maison Triona' }],
    },
  }
}

export default async function LocaleLayout({ children }: { children: ReactNode }) {
  const locale = (await rootParams.locale()) as Locale
  const other: Locale = locale === 'fr' ? 'en' : 'fr'
  const t = await getTranslations('SkipLink')
  const bar = await getTranslations('MobileBar')
  // La suggestion s'écrit dans la langue proposée, pas dans celle de la page.
  const suggestion = await getTranslations({ locale: other, namespace: 'LanguageSuggestion' })

  return (
    <html lang={locale} className={`${manrope.variable} ${newsreader.variable}`}>
      <body>
        <SkipLink label={t('label')} />
        <Header locale={locale} />
        <main id="contenu" tabIndex={-1}>
          {children}
        </main>
        <Footer locale={locale} />
        <LanguageSuggestion
          current={locale}
          target={other}
          text={suggestion('text')}
          switchLabel={suggestion('switch')}
          closeLabel={suggestion('close')}
        />
        <MobileBar href={localizedPath('/contact', locale)} label={bar('label')} />
      </body>
    </html>
  )
}
