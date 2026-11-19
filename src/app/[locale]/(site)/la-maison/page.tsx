import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { JsonLd } from '@/components/seo/JsonLd'
import { Rule } from '@/components/ui/Rule'
import { pageMetadata } from '@/lib/seo'

// La Maison (story 2.6, D26, D45) : les cinq chapitres de Cat (l'histoire, l'exigence, la discrétion,
// le sens du nom, l'expérience), en brouillon jusqu'à sa validation. Même gabarit que les pages
// légales et l'accessibilité (revue DA du point ③) : sommaire collant à gauche, colonne de lecture à
// droite, chapitres en `title-h2` sous le h1 display. Aucun visuel tant que les images de la page ne
// sont pas générées. Le prénom de Cat n'apparaît qu'une fois, hors des extraits (`data-nosnippet`).

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
      <article className="conteneur py-section">
        <header className="flex flex-col gap-24">
          <Rule short />
          <h1
            tabIndex={-1}
            className="max-w-titre font-display text-display-l text-balance text-sapin"
          >
            {pages('house')}
          </h1>
          <p className="max-w-measure text-body-l">{t('intro')}</p>
        </header>
        <div className="mt-96 grid gap-64 lg:grid-cols-12 lg:gap-gutter">
          <nav
            aria-labelledby="sommaire-titre"
            className="max-w-measure lg:col-span-3 lg:max-w-none"
          >
            <div className="flex flex-col gap-16 lg:sommaire-collant lg:sticky lg:top-mini-menu lg:pt-32">
              <p id="sommaire-titre" className="text-label text-encre uppercase">
                {t('contents')}
              </p>
              <ol className="flex flex-col border-t border-or">
                {sections.map(({ id, title }, index) => (
                  <li key={id} className="border-b border-sapin-20">
                    <a
                      href={`#${id}`}
                      className="flex min-h-touch items-center gap-16 py-8 text-body-s text-sapin decoration-or decoration-1 underline-offset-8 hover:underline"
                    >
                      <span aria-hidden="true" className="text-label">
                        {number(index)}
                      </span>
                      {title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </nav>
          <div className="flex flex-col lg:col-span-8 lg:col-start-5">
            {sections.map(({ id, title, text }, index) => (
              <section
                key={id}
                id={id}
                aria-labelledby={`${id}-titre`}
                className="flex max-w-measure flex-col gap-16 border-t border-sapin-20 py-48 first:border-t-0 first:pt-0"
              >
                <p aria-hidden="true" className="text-label text-sapin">
                  {number(index)}
                </p>
                <h2
                  id={`${id}-titre`}
                  tabIndex={-1}
                  className="font-display text-title-h2 text-balance text-sapin"
                >
                  {title}
                </h2>
                <p className="text-body-l">
                  <WithoutSnippet text={text} />
                </p>
              </section>
            ))}
          </div>
        </div>
      </article>
    </>
  )
}
