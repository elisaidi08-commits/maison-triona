import type { Metadata } from 'next'
import * as rootParams from 'next/root-params'
import { PageService } from '@/components/sections/ServiceDetails'
import type { Locale } from '@/i18n/pathnames'
import { SERVICES } from '@/lib/services'
import { JsonLd } from '@/components/seo/JsonLd'
import { pageMetadata } from '@/lib/seo'

// Page dédiée (partage, SEO ; stories 2.13 et 2.14) : la scène, la fiche complète du service et le
// bloc Contact (PageService).

const service = SERVICES[0]

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/services/conciergerie')
}

export default async function ServicePage() {
  const locale = (await rootParams.locale()) as Locale
  return (
    <>
      <JsonLd page="/services/conciergerie" />
      <PageService service={service} locale={locale} />
    </>
  )
}
