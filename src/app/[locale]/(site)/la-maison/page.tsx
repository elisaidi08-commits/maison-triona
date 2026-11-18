import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { JsonLd } from '@/components/seo/JsonLd'
import { Chapter } from '@/components/sections/Chapter'
import { ChapterIndex } from '@/components/sections/ChapterIndex'
import { Rule } from '@/components/ui/Rule'
import { pageMetadata } from '@/lib/seo'

// La Maison (story 2.6, D26, D45) : les cinq chapitres de Cat (l'histoire, l'exigence, la discrétion,
// le sens du nom, l'expérience), en brouillon jusqu'à sa validation, avec un sommaire en vrais liens.
// Aucun visuel imposé tant que les images de la page ne sont pas générées et validées (lot 3 de D26).
// Le prénom de Cat n'apparaît qu'une fois, hors des extraits des moteurs (`data-nosnippet`, D45).

type Section = { id: string; title: string; text: string }

const FIRST_NAME = 'Catriona'

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/la-maison')
}

// Le prénom, s'il figure dans le texte, est entouré de `data-nosnippet`.
function WithoutSnippet({ text }: { text: string }) {
  const parts = text.split(FIRST_NAME)
  return parts.map((part, index) => (
    <span key={index}>
      {part}
      {index < parts.length - 1 ? <span data-nosnippet>{FIRST_NAME}</span> : null}
    </span>
  ))
}

export default async function HousePage() {
  const pages = await getTranslations('Pages')
  const t = await getTranslations('House')
  const sections = t.raw('sections') as Section[]
  const number = (index: number) => String(index + 1).padStart(2, '0')
  return (
    <>
      <JsonLd page="/la-maison" />
      <article className="conteneur flex flex-col gap-96 py-section">
        <header className="grid gap-48 lg:grid-cols-12 lg:gap-gutter">
          <div className="flex flex-col gap-24 lg:col-span-6">
            <Rule short />
            <h1 tabIndex={-1} className="font-display text-display-l text-sapin">
              {pages('house')}
            </h1>
            <p className="max-w-measure text-body-l">{t('intro')}</p>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <ChapterIndex
              label={t('contents')}
              chapters={sections.map(({ id, title }, index) => ({
                href: `#${id}`,
                number: number(index),
                title,
              }))}
            />
          </div>
        </header>
        {sections.map(({ id, title, text }, index) => (
          <Chapter key={id} id={id} number={number(index)} title={title}>
            <p>
              <WithoutSnippet text={text} />
            </p>
          </Chapter>
        ))}
      </article>
    </>
  )
}
