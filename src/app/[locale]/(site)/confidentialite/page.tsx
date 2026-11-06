import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { LegalDocument } from '@/components/sections/LegalDocument'
import type { Locale } from '@/i18n/pathnames'

// Politique de confidentialité (story 4.4) : ce que le site collecte, pourquoi, où, combien de
// temps, les droits des personnes et les limites connues (docs/privacy.md).
// Textes en brouillon (content/brouillons.json) jusqu'à l'inscription de la société et l'avis du
// juriste.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Privacy')
  return { title: t('title') }
}

export default async function Page() {
  const locale = (await rootParams.locale()) as Locale
  return <LegalDocument namespace="Privacy" locale={locale} />
}
