import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { EffacerBrouillon } from '@/components/forms/EffacerBrouillon'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'

// Remerciement après un envoi (story 3.2, partie B ; docs/architecture.md §6.1, étape 5). Page
// statique, noindex, hors du sitemap : elle ne reprend rien de la demande (aucun paramètre lu,
// aucun état reçu), seulement le délai de réponse. Le brouillon du formulaire s'efface à
// l'affichage. Même colonne que le contact. Texte en brouillon (content/brouillons.json), d'après
// l'annexe B.4 de docs/trust-contact-launch.md.

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations({ locale, namespace: 'ContactThanks' })
  return { title: t('metaTitle'), robots: { index: false, follow: false } }
}

export default async function Page() {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations('ContactThanks')
  return (
    <div className="conteneur py-section">
      <div className="mx-auto flex max-w-measure flex-col gap-24">
        <Rule short />
        <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
          {t('title')}
        </h1>
        <p className="text-body-l">{t('body')}</p>
        <p>
          <TextLink href={localizedPath('/', locale)}>{t('back')}</TextLink>
        </p>
      </div>
      <EffacerBrouillon />
    </div>
  )
}
