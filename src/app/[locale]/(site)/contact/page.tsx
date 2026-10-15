import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PageIntro } from '@/components/layout/PageIntro'

// Page en construction : seul le titre existe pour l'instant (story 1.4).

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Pages')
  return { title: t('contact') }
}

export default async function Page() {
  const t = await getTranslations('Pages')
  return <PageIntro title={t('contact')} />
}
