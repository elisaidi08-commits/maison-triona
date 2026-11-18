import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { JsonLd } from '@/components/seo/JsonLd'
import { ContactBlock } from '@/components/sections/ContactBlock'
import { FaqAnchorOpener } from '@/components/sections/FaqAnchorOpener'
import { Rule } from '@/components/ui/Rule'
import type { Locale } from '@/i18n/pathnames'
import { pageMetadata } from '@/lib/seo'

// FAQ (story 2.8, docs/trust-contact-launch.md §2.1 et annexe B.1) : huit questions en <details>
// natifs (lisibles sans JavaScript, clavier compris), une ancre par question, toutes ouvertes à
// l'impression. Réponses en brouillon, d'après les réponses de Cat (D45), jusqu'à sa validation.

export type FaqItem = { id: string; question: string; answer: string }

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/faq')
}

export default async function FaqPage() {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations('Faq')
  const items = t.raw('items') as FaqItem[]
  return (
    <>
      <JsonLd page="/faq" />
      <article className="conteneur flex flex-col gap-64 py-section">
        <header className="flex flex-col gap-24">
          <Rule short />
          <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
            {t('title')}
          </h1>
          <p className="max-w-measure text-body-l">{t('intro')}</p>
        </header>
        <div data-faq className="max-w-measure border-t border-or">
          {items.map((item) => (
            <details key={item.id} id={item.id} className="border-b border-or">
              <summary className="flex min-h-touch cursor-pointer items-center justify-between gap-24 py-16 font-medium text-sapin">
                {item.question}
              </summary>
              <p className="pb-24">{item.answer}</p>
            </details>
          ))}
        </div>
        <FaqAnchorOpener />
      </article>
      <ContactBlock locale={locale} />
    </>
  )
}
