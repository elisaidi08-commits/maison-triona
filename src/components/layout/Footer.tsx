import { getTranslations } from 'next-intl/server'
import { TextLink } from '@/components/ui/TextLink'
import { Stamp } from '@/components/ui/Stamp'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NavLink } from './NavLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICE_PATHS, SERVICES } from '@/lib/services'

// Pied de page « Kiln » (D54, validé par Cat), rendu immobile et resserré par D64 (2) : fond ivoire
// comme l'en-tête et les pages, filet or en tête. La phrase de l'accueil en deux lignes et la touche
// « revenir en haut » (vrai lien `#top`, sans JavaScript) ; trois colonnes (la maison et ses pays, la
// navigation, le contact) ; le nom « Maison Triona » signé du « K. » (Stamp, 48 px) ; une barre
// sous un filet or : copyright, liens légaux, FR · EN, puis la mention des images générées par IA sur
// sa propre ligne (privacy.md §4). Rien ne bouge : ni disque, ni loupe, ni lettres qui montent (M22
// retiré). Les filets or restent hors des blocs de texte. Liens comme ceux de l'en-tête (NavLink :
// page courante marquée). Aucun réseau social (CLAUDE.md, discrétion), aucun texte nouveau.
//
// Mobile (< 768) : une colonne ; les pays sur deux lignes, les pages sur deux colonnes. Tablette :
// la maison et le contact côte à côte, la navigation dessous. Desktop : trois colonnes.

export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations('Footer')
  const lang = await getTranslations('Locale')
  const nav = await getTranslations('Nav')
  const home = await getTranslations('Home')
  const scenes = await getTranslations('Scenes')
  const services = await getTranslations('Services')
  const meta = await getTranslations('Meta')
  const names = { fr: lang('fr'), en: lang('en') }

  // La phrase de l'accueil, coupée après sa virgule ; les pays, séparés par « · » dans le message.
  const phrase = home('title')
  const coupure = phrase.indexOf(',') + 1
  const lignes = coupure > 0 ? [phrase.slice(0, coupure), phrase.slice(coupure).trim()] : [phrase]
  const pays = scenes('territories.countries').split(/\s*·\s*/)

  const pages = [
    { href: '/la-maison', label: nav('house') },
    { href: '/services', label: nav('services') },
    { href: '/territoires', label: nav('territories') },
    { href: '/contact', label: nav('contact') },
  ] as const

  return (
    <footer id="pied-de-page" aria-label={t('label')} className="border-t border-or">
      <div className="conteneur pt-48 pb-24 lg:pt-64">
        <div className="flex items-start justify-between gap-24">
          <p className="font-display text-title-h2 text-balance text-sapin">
            {lignes.map((ligne) => (
              <span key={ligne} className="block">
                {ligne}
              </span>
            ))}
          </p>
          {/* « #top » ramène en haut de la page, même sans JavaScript (défilement doux de M12). */}
          <a
            href="#top"
            aria-label={t('top')}
            className="grid h-96 w-48 flex-none place-items-center bg-sapin text-ivoire transition-colors duration-micro ease-standard hover:text-champagne"
          >
            <svg
              viewBox="0 0 24 34"
              fill="none"
              aria-hidden="true"
              focusable="false"
              className="w-24"
            >
              <path d="M12 33V2M2 12 12 2l10 10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </a>
        </div>

        <div className="mt-48 grid gap-x-gutter gap-y-48 md:grid-cols-2 lg:mt-64 lg:grid-cols-12">
          <div className="flex flex-col gap-16 lg:col-span-3">
            <h2 className="text-label text-encre uppercase">{meta('siteName')}</h2>
            <ul className="flex flex-wrap gap-x-24 text-label-l text-encre uppercase md:flex-col">
              {pays.map((nom) => (
                <li key={nom}>{nom}</li>
              ))}
            </ul>
          </div>
          <nav
            aria-label={t('navigation')}
            className="flex flex-col gap-8 md:col-span-2 lg:col-span-6"
          >
            <h2 className="text-label text-encre uppercase">{t('navigation')}</h2>
            <div className="flex flex-col md:flex-row md:gap-x-48">
              <ul className="grid grid-cols-2 gap-x-gutter md:flex md:flex-col">
                {pages.map(({ href, label }) => (
                  <li key={href}>
                    <NavLink href={localizedPath(href, locale)}>{label}</NavLink>
                  </li>
                ))}
              </ul>
              <ul className="flex flex-col">
                {SERVICES.map((service) => (
                  <li key={service.id}>
                    <NavLink href={localizedPath(SERVICE_PATHS[service.id], locale)}>
                      {services(`${service.key}.name`)}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
          <div className="flex flex-col items-start gap-16 md:col-start-2 md:row-start-1 lg:col-span-3 lg:col-start-10">
            <h2 className="text-label text-encre uppercase">{scenes('contact.label')}</h2>
            <p className="text-body-s">{scenes('contact.reassurance')}</p>
            <TextLink href={localizedPath('/contact', locale)}>{scenes('contact.button')}</TextLink>
          </div>
        </div>

        {/* Le nom, décoratif (écrit en tête de la première colonne), signé du « K. » de Cat. */}
        <div className="mt-48 flex items-baseline justify-between gap-24 lg:mt-64">
          <p aria-hidden="true" className="font-display text-display-l text-sapin">
            {meta('siteName')}
          </p>
          <Stamp size="md" />
        </div>

        <div className="mt-24 flex flex-col gap-8 border-t border-or pt-16">
          <div className="flex flex-wrap items-center justify-between gap-x-32">
            <p className="text-body-s">{t('copyright')}</p>
            <ul className="order-last flex w-full flex-wrap gap-x-32 lg:order-none lg:w-auto">
              <li>
                <NavLink href={localizedPath('/mentions-legales', locale)}>{t('legal')}</NavLink>
              </li>
              <li>
                <NavLink href={localizedPath('/confidentialite', locale)}>{t('privacy')}</NavLink>
              </li>
            </ul>
            <LanguageSwitcher label={lang('label')} active={locale} names={names} />
          </div>
          <p className="text-body-s">{t('ai')}</p>
        </div>
      </div>
    </footer>
  )
}
