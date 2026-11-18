import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageIntro } from '@/components/layout/PageIntro'
import { JsonLd } from '@/components/seo/JsonLd'
import { pageMetadata } from '@/lib/seo'

// Page en construction : seul le titre existe pour l'instant (story 1.4).

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/contact')
}

export default async function Page() {
  const t = await getTranslations('Pages')
  return (
    <>
      <JsonLd page="/contact" />
      <PageIntro title={t('contact')} />
    </>
  )
}
