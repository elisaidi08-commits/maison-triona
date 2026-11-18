import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { RequestForm, type TextesFormulaire } from '@/components/forms/RequestForm'
import { JsonLd } from '@/components/seo/JsonLd'
import { Rule } from '@/components/ui/Rule'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { pageMetadata } from '@/lib/seo'

// Contact (stories 3.1, 3.4 et 3.5) : le formulaire en étapes, variante A (D08) : une colonne de
// 640 px centrée, sur l'aplat ivoire, le titre puis le formulaire ; pas de bloc Contact sapin sur
// cette page (docs/art-direction.md §7.5). La page reste statique (garde `ensureStatic` du layout) :
// l'envoi est une Server Action, en POST. Textes en brouillon (content/brouillons.json).

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/contact')
}

export default async function Page() {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations('Contact')
  return (
    <>
      <JsonLd page="/contact" />
      <div className="conteneur py-section">
        <div className="mx-auto flex max-w-measure flex-col gap-64">
          <header className="flex flex-col gap-24">
            <Rule short />
            <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
              {t('title')}
            </h1>
            <p className="text-body-l">{t('intro')}</p>
          </header>
          <RequestForm
            locale={locale}
            textes={t.raw('form') as TextesFormulaire}
            confidentialite={`${localizedPath('/confidentialite', locale)}#demande`}
          />
        </div>
      </div>
    </>
  )
}
