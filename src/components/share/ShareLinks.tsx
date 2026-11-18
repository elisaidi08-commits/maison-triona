import { getTranslations } from 'next-intl/server'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { pageMetaKey, type PublicPage } from '@/lib/seo'
import { siteUrl } from '@/lib/site'
import { CopyLink } from './CopyLink'

// Partage familial (story 2.11, docs/trust-contact-launch.md §5) : « Envoyer à un proche » par un
// `mailto:` prérempli dans la langue de la page, et « Copier le lien ». Aucun réseau social, aucun
// script ni widget tiers (CLAUDE.md, discrétion) ; pas de `navigator.share` sans l'accord de Sady.
// Masqué à l'impression.

export async function ShareLinks({ page, locale }: { page: PublicPage; locale: Locale }) {
  const t = await getTranslations('Share')
  const pages = await getTranslations('Meta.pages')
  const url = `${siteUrl()}${localizedPath(page, locale)}`
  const title = pages(`${pageMetaKey(page)}.title`)
  const mailto = `mailto:?subject=${encodeURIComponent(
    t('subject', { title }),
  )}&body=${encodeURIComponent(t('body', { url }))}`
  return (
    <aside
      aria-labelledby="partage-titre"
      data-share
      className="conteneur print:hidden flex flex-col gap-16 border-t border-sapin-20 py-48 lg:flex-row lg:items-center lg:gap-48"
    >
      {/* Un repère, pas un titre (comme « Les autres services ») : la page garde ses trois temps. */}
      <p id="partage-titre" className="text-label text-encre uppercase">
        {t('title')}
      </p>
      <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:gap-32">
        <TextLink href={mailto}>{t('email')}</TextLink>
        <CopyLink url={url} label={t('copy')} copied={t('copied')} />
      </div>
    </aside>
  )
}
