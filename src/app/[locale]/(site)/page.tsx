import { getTranslations } from 'next-intl/server'
import { PageIntro } from '@/components/layout/PageIntro'

// Accueil provisoire : le premier écran immersif (D19, « Seuil plein écran ») arrive en story 2.1.

export default async function Home() {
  const t = await getTranslations('Pages')
  return <PageIntro title={t('home')} />
}
