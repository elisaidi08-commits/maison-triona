import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { SceneService } from '@/components/sections/SceneService'
import { ServiceDetails } from '@/components/sections/ServiceDetails'
import type { Locale } from '@/i18n/pathnames'
import { SERVICES } from '@/lib/services'

// Page dédiée (partage, SEO ; story 2.13) : la scène de l'accueil, titre de page en h1, dont le
// second temps répond aux cinq questions de V3 (ServiceDetails).

const service = SERVICES[2]

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Services')
  return { title: t(`${service.key}.name`) }
}

export default async function ServicePage() {
  const locale = (await rootParams.locale()) as Locale
  return (
    <SceneService service={service} locale={locale} heading="h1">
      <ServiceDetails service={service} locale={locale} />
    </SceneService>
  )
}
