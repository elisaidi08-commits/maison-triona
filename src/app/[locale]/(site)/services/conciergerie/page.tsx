import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { SceneService } from '@/components/sections/SceneService'
import type { Locale } from '@/i18n/pathnames'
import { SERVICES } from '@/lib/services'

// Page dédiée (partage, SEO) : même scène que sur l'accueil, titre de page en h1.

const service = SERVICES[0]

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Services')
  return { title: t(`${service.key}.name`) }
}

export default async function ServicePage() {
  const locale = (await rootParams.locale()) as Locale
  return <SceneService service={service} locale={locale} heading="h1" />
}
