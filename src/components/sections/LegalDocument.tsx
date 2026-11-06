import { getTranslations } from 'next-intl/server'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type InternalPath, type Locale } from '@/i18n/pathnames'

// Pages légales (story 4.4) : mentions légales et politique de confidentialité, FR et EN, d'après
// docs/privacy.md et docs/decisions.md D38. Même gabarit pour les deux : en-tête sobre, sommaire
// « Sur cette page » (vrais liens d'ancre, collant en desktop), puis les sections en colonne de
// lecture, intertitres en EB Garamond (le grand serif reste au h1). Une section peut porter des paragraphes, une liste, un tableau de faits (<dl>) et un
// lien interne. Les données légales réelles (forme, siège, BCE, TVA, adresses) n'existent qu'après
// l'inscription de janvier 2027 : `[CONTENU À FOURNIR PAR CAT]`, et `check:content` bloque la
// mise en production tant qu'il en reste.

type Fact = { term: string; value: string }

type LegalSection = {
  id: string
  title: string
  paragraphs?: string[]
  items?: string[]
  facts?: Fact[]
  after?: string[]
  link?: { label: string; path: InternalPath }
}

export async function LegalDocument({
  namespace,
  locale,
}: {
  namespace: 'Legal' | 'Privacy'
  locale: Locale
}) {
  const t = await getTranslations(namespace)
  const page = await getTranslations('LegalPage')
  const sections = t.raw('sections') as LegalSection[]

  return (
    <article className="conteneur py-section">
      <header className="flex flex-col gap-24">
        <Rule short />
        <h1 className="max-w-titre font-display text-display-l text-balance text-sapin">
          {t('title')}
        </h1>
        <p className="max-w-measure text-body-l">{t('intro')}</p>
        <p className="text-body-s text-encre-68">{t('updated')}</p>
      </header>

      <div className="mt-96 grid gap-64 lg:grid-cols-12 lg:gap-gutter">
        <nav aria-labelledby="sommaire-titre" className="max-w-measure lg:col-span-3 lg:max-w-none">
          <div className="flex flex-col gap-16 lg:sticky lg:top-mini-menu lg:pt-32">
            <h2 id="sommaire-titre" className="text-label text-encre uppercase">
              {page('toc')}
            </h2>
            <ol className="flex flex-col border-t border-or">
              {sections.map((section) => (
                <li key={section.id} className="border-b border-sapin-20">
                  <a
                    href={`#${section.id}`}
                    className="flex min-h-touch items-center py-8 text-body-s text-sapin transition-colors duration-micro ease-standard hover:text-cypres"
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="flex flex-col lg:col-span-8 lg:col-start-5">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-titre`}
              className="flex max-w-measure flex-col gap-16 border-t border-sapin-20 py-48 first:border-t-0 first:pt-0"
            >
              <h2 id={`${section.id}-titre`} className="text-title-h3 text-sapin">
                {section.title}
              </h2>
              {section.paragraphs?.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {section.items ? (
                <ul className="flex flex-col">
                  {section.items.map((item, index) => (
                    <li key={index} className="border-b border-sapin-20 py-12 first:border-t">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {section.facts ? (
                <dl className="flex flex-col border-t border-sapin-20">
                  {section.facts.map((fact) => (
                    <div
                      key={fact.term}
                      className="flex flex-col gap-4 border-b border-sapin-20 py-12 md:grid md:grid-cols-5 md:gap-gutter"
                    >
                      <dt className="text-label text-encre uppercase md:col-span-2 md:pt-4">
                        {fact.term}
                      </dt>
                      <dd className="md:col-span-3">{fact.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {section.after?.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {section.link ? (
                <p>
                  <TextLink href={localizedPath(section.link.path, locale)}>
                    {section.link.label}
                  </TextLink>
                </p>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </article>
  )
}
