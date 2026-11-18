import type { Metadata } from 'next'
import * as rootParams from 'next/root-params'
import { LegalDocument } from '@/components/sections/LegalDocument'
import type { Locale } from '@/i18n/pathnames'
import { JsonLd } from '@/components/seo/JsonLd'
import { pageMetadata } from '@/lib/seo'

// Mentions légales (story 4.4) : éditeur, activité, hébergement, crédits, images créées par IA,
// données et cookies (D38).
// Textes en brouillon (content/brouillons.json) jusqu'à l'inscription de la société ; seulement ce
// que la maison peut affirmer aujourd'hui (D61).

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/mentions-legales')
}

export default async function Page() {
  const locale = (await rootParams.locale()) as Locale
  return (
    <>
      <JsonLd page="/mentions-legales" />
      <LegalDocument namespace="Legal" locale={locale} />
    </>
  )
}
