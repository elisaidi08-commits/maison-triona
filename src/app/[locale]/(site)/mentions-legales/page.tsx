import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { LegalDocument } from '@/components/sections/LegalDocument'
import type { Locale } from '@/i18n/pathnames'

// Mentions légales (story 4.4) : éditeur, activité, hébergement, reproduction, images créées par
// IA, droit applicable (D38).
// Textes en brouillon (content/brouillons.json) jusqu'à l'inscription de la société et l'avis du
// juriste.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Legal')
  return { title: t('title') }
}

export default async function Page() {
  const locale = (await rootParams.locale()) as Locale
  return <LegalDocument namespace="Legal" locale={locale} />
}
