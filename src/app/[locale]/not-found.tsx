import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { TextLink } from '@/components/ui/TextLink'
import { Rule } from '@/components/ui/Rule'

// 404 dans la langue de la page (Next ajoute lui-même noindex).

export default async function NotFound() {
  const t = await getTranslations('NotFound')
  const locale = await rootParams.locale()
  return (
    <section className="conteneur flex flex-col gap-24 py-section">
      <Rule short />
      <h1 className="font-display text-display-l text-sapin">{t('title')}</h1>
      <p>
        <TextLink href={`/${locale}`}>{t('back')}</TextLink>
      </p>
    </section>
  )
}
