import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { PageIntro } from '@/components/layout/PageIntro'
import { ChoiceList } from '@/components/ui/ChoiceList'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICES, SERVICE_PATHS } from '@/lib/services'

// Page Services (story 2.13, docs/art-direction.md §7.3) : les trois services en lignes numérotées
// 01 à 03, filets or, chacune vers sa page, avec sa promesse ; puis « Évoquer une demande
// particulière » vers le formulaire. La même liste que l'entrée de l'accueil : vrais liens,
// cibles de 56 px, aucune carte.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Pages')
  return { title: t('services') }
}

export default async function Page() {
  const locale = (await rootParams.locale()) as Locale
  const pages = await getTranslations('Pages')
  const t = await getTranslations('Services')
  const home = await getTranslations('Home')
  const choices = [
    ...SERVICES.map((service) => ({
      href: localizedPath(SERVICE_PATHS[service.id], locale),
      number: service.number,
      label: t(`${service.key}.name`),
      note: t(`${service.key}.promise`),
    })),
    {
      href: localizedPath('/contact', locale),
      label: home('choices.unsure.label'),
      note: home('choices.unsure.note'),
    },
  ]

  return (
    <>
      <PageIntro title={pages('services')} />
      <div className="conteneur pb-section">
        <div className="max-w-measure">
          <ChoiceList choices={choices} />
        </div>
      </div>
    </>
  )
}
