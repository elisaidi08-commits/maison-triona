import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { PageService } from '@/components/sections/ServiceDetails'
import type { Locale } from '@/i18n/pathnames'
import { SERVICES } from '@/lib/services'

// Page dédiée (partage, SEO ; stories 2.13 et 2.14) : la scène, la fiche complète du service et le
// bloc Contact (PageService).

const service = SERVICES[1]

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Services')
  return { title: t(`${service.key}.name`) }
}

export default async function ServicePage() {
  const locale = (await rootParams.locale()) as Locale
  return <PageService service={service} locale={locale} />
}
