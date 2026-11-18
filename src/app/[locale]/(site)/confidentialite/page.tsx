import type { Metadata } from 'next'
import * as rootParams from 'next/root-params'
import { LegalDocument } from '@/components/sections/LegalDocument'
import type { Locale } from '@/i18n/pathnames'
import { JsonLd } from '@/components/seo/JsonLd'
import { pageMetadata } from '@/lib/seo'

// Politique de confidentialité (story 4.4) : ce que le site collecte, pourquoi, où, combien de
// temps, les droits des personnes et les limites connues (docs/privacy.md).
// Textes en brouillon (content/brouillons.json) jusqu'à l'inscription de la société ; seulement ce
// que la maison peut affirmer aujourd'hui (D61).

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/confidentialite')
}

export default async function Page() {
  const locale = (await rootParams.locale()) as Locale
  return (
    <>
      <JsonLd page="/confidentialite" />
      <LegalDocument namespace="Privacy" locale={locale} />
    </>
  )
}
