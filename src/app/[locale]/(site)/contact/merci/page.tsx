import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { EffacerBrouillon } from '@/components/forms/EffacerBrouillon'
import { Rule } from '@/components/ui/Rule'
import { Stamp } from '@/components/ui/Stamp'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'

// Remerciement après un envoi (story 3.2, partie B ; docs/architecture.md §6.1, étape 5). Page
// statique, noindex, hors du sitemap : elle ne reprend rien de la demande (aucun paramètre lu,
// aucun état reçu), seulement le délai de réponse. Le brouillon du formulaire s'efface à
// l'affichage. Même colonne que le contact, close par le cachet « K. » de 64 px (story 3.3),
// décoratif, sur l'axe gauche, avec 64 px d'air au-dessus (relecture de la direction artistique :
// hors de l'espacement de 24 px du texte, qui n'en laisserait que 24). Texte en brouillon (content/brouillons.json), d'après l'annexe B.4 de
// docs/trust-contact-launch.md.

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
      <div className="mx-auto max-w-measure">
        <div className="flex flex-col gap-24">
          <Rule short />
          <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
            {t('title')}
          </h1>
          <p className="text-body-l">{t('body')}</p>
          <p>
            <TextLink href={localizedPath('/', locale)}>{t('back')}</TextLink>
          </p>
        </div>
        {/* `flex` : le cachet n'hérite d'aucune hauteur de ligne, l'air au-dessus reste de 64 px. */}
        <div className="flex pt-64">
          <Stamp size="lg" />
        </div>
      </div>
      <EffacerBrouillon />
    </div>
  )
}
