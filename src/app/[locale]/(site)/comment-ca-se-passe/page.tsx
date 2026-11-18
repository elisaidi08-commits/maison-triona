import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { JsonLd } from '@/components/seo/JsonLd'
import { ContactBlock } from '@/components/sections/ContactBlock'
import { ShareLinks } from '@/components/share/ShareLinks'
import { CommentCaSePasse, Modele } from '@/components/sections/Fonctionnement'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { pageMetadata } from '@/lib/seo'

// « Comment ça se passe » (story 2.9, docs/trust-contact-launch.md §2.2 et annexe B.2) : le déroulé
// en six étapes de Cat (D40), le modèle en trois temps et ce qu'il faut savoir, avec un lien vers la
// version en langage simple. Pas de PDF tant que le texte n'est pas validé par Cat (critère de 2.9).

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/comment-ca-se-passe')
}

export default async function HowItWorksPage() {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations('HowItWorksPage')
  return (
    <>
      <JsonLd page="/comment-ca-se-passe" />
      <article className="py-section">
        <header className="conteneur flex flex-col gap-24 pb-48">
          <Rule short />
          <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
            {t('title')}
          </h1>
          <p className="max-w-measure text-body-l">{t('intro')}</p>
          <p className="flex flex-col items-start gap-8 lg:flex-row lg:gap-32">
            <TextLink href={localizedPath('/comment-ca-se-passe/langage-simple', locale)}>
              {t('easyReadLink')}
            </TextLink>
            <TextLink href={localizedPath('/faq', locale)}>{t('faqLink')}</TextLink>
          </p>
        </header>
        <div className="conteneur">
          <CommentCaSePasse locale={locale} title={t('stepsTitle')} pageLink={false} />
        </div>
        <div className="conteneur">
          <Modele />
        </div>
      </article>
      <ShareLinks page="/comment-ca-se-passe" locale={locale} />
      <ContactBlock locale={locale} />
    </>
  )
}
