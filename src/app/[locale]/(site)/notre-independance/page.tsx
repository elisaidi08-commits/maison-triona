import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { JsonLd } from '@/components/seo/JsonLd'
import { ContactBlock } from '@/components/sections/ContactBlock'
import { FicheRow } from '@/components/sections/Fonctionnement'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { pageMetadata } from '@/lib/seo'

// « Notre indépendance » (story 2.10, docs/trust-contact-launch.md §2.3 et annexe B.3) : seulement
// les blocs que Cat a confirmés (D40 : la maison n'emploie personne, le professionnel la rémunère,
// le client ne lui paie rien, une seule interlocutrice). Aucun montant, rien qui attende le juriste
// (D61). Un bloc non confirmé n'entre pas dans `Independence.blocks`.

type Block = { id: string; title: string; text: string }

export function generateMetadata(): Promise<Metadata> {
  return pageMetadata('/notre-independance')
}

export default async function IndependencePage() {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations('Independence')
  const links = await getTranslations('HowItWorksPage')
  const blocks = t.raw('blocks') as Block[]
  return (
    <>
      <JsonLd page="/notre-independance" />
      <article className="py-section">
        <header className="conteneur flex flex-col gap-24 pb-48">
          <Rule short />
          <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
            {t('title')}
          </h1>
          <p className="max-w-measure text-body-l">{t('intro')}</p>
        </header>
        <div className="conteneur">
          {blocks.map((block) => (
            <FicheRow key={block.id} id={block.id} title={block.title}>
              <p>{block.text}</p>
            </FicheRow>
          ))}
          <p className="flex flex-col items-start gap-8 border-t border-sapin-20 pt-48 lg:flex-row lg:gap-32">
            <TextLink href={localizedPath('/comment-ca-se-passe', locale)}>
              {links('detailLink')}
            </TextLink>
            <TextLink href={localizedPath('/faq', locale)}>{links('faqLink')}</TextLink>
          </p>
        </div>
      </article>
      <ContactBlock locale={locale} />
    </>
  )
}
