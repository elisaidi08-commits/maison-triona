import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { JsonLd } from '@/components/seo/JsonLd'
import { ContactBlock } from '@/components/sections/ContactBlock'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { pageMetadata } from '@/lib/seo'

// « Comment ça se passe » en langage simple (story 2.9) : les mêmes étapes, une idée par phrase,
// en grand corps, numérotées. Liée depuis la version complète, et elle y renvoie.

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/comment-ca-se-passe/langage-simple')
}

export default async function EasyReadPage() {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations('HowItWorksPage')
  const steps = t.raw('easyRead.steps') as string[]
  return (
    <>
      <JsonLd page="/comment-ca-se-passe/langage-simple" />
      <article className="conteneur flex flex-col gap-48 py-section">
        <header className="flex flex-col gap-24">
          <Rule short />
          <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
            {t('easyRead.title')}
          </h1>
          <p className="max-w-measure text-body-l">{t('easyRead.intro')}</p>
        </header>
        <ol className="flex max-w-measure flex-col border-t border-or">
          {steps.map((step, index) => (
            <li
              key={step}
              className="flex items-baseline gap-24 border-b border-sapin-20 py-24 text-body-l"
            >
              <span
                aria-hidden="true"
                className="w-32 shrink-0 font-display text-title-h2 text-sapin"
              >
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        <p>
          <TextLink href={localizedPath('/comment-ca-se-passe', locale)}>{t('fullLink')}</TextLink>
        </p>
      </article>
      <ContactBlock locale={locale} />
    </>
  )
}
