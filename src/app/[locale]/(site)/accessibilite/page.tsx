import type { Metadata } from 'next'
import * as rootParams from 'next/root-params'
import { JsonLd } from '@/components/seo/JsonLd'
import { LegalDocument } from '@/components/sections/LegalDocument'
import type { Locale } from '@/i18n/pathnames'
import { pageMetadata } from '@/lib/seo'

// Déclaration d'accessibilité (story 4.4, audit du 06/11/2026 §3.1 n° 13) : le niveau visé, ce qui
// est vérifié à ce jour (docs/a11y-report.md), ce qui reste à faire avant l'ouverture et l'adresse
// pour signaler une difficulté (`[CONTENU À FOURNIR PAR CAT]` tant que la boîte n'existe pas).
// Même gabarit que les pages légales.

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/accessibilite')
}

export default async function Page() {
  const locale = (await rootParams.locale()) as Locale
  return (
    <>
      <JsonLd page="/accessibilite" />
      <LegalDocument namespace="Accessibility" locale={locale} />
    </>
  )
}
