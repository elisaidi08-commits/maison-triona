import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Rule } from '@/components/ui/Rule'
import { JsonLd } from '@/components/seo/JsonLd'
import { pageMetadata } from '@/lib/seo'

// La Maison (story 2.6, PRD §7) : l'histoire, l'exigence, la discrétion, le sens du nom,
// l'expérience. Textes à fournir par Cat ; colonne de lecture, aucun visuel imposé.

type Section = { title: string; text: string }

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/la-maison')
}

export default async function HousePage() {
  const pages = await getTranslations('Pages')
  const t = await getTranslations('House')
  const sections = t.raw('sections') as Section[]
  return (
    <>
      <JsonLd page="/la-maison" />
      <article className="conteneur flex flex-col gap-96 py-section">
        <header className="flex flex-col gap-24">
          <Rule short />
          <h1 tabIndex={-1} className="font-display text-display-l text-sapin">
            {pages('house')}
          </h1>
          <p className="max-w-measure text-body-l">{t('intro')}</p>
        </header>
        {sections.map(({ title, text }) => (
          <section key={title} className="flex max-w-measure flex-col gap-16">
            <h2 className="font-display text-title-h2 text-sapin">{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </article>
    </>
  )
}
