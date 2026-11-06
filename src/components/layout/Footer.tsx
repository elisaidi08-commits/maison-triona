import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { LanguageSwitcher } from './LanguageSwitcher'
import { PiedFond } from './PiedFond'
import { PiedMot } from './PiedMot'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICE_PATHS, SERVICES } from '@/lib/services'

// Pied de page (D54 ; idée du « Kiln Wordmark Footer » collé par Sady, reprise dans nos règles,
// validé par Cat) : panneau encre, disque et dalle sapin derrière (PiedFond), couleurs du kit
// seulement ; la phrase de l'accueil en deux lignes et la touche « revenir en haut » ; trois colonnes
// (la maison et ses pays, la navigation, le contact) ; le nom en très grand (PiedMot) ; une barre
// filetée : copyright, mention des images générées par IA (privacy.md §4), liens légaux, FR · EN.
// Liens internes par Next.js (`Link`, D37). Aucun réseau social (CLAUDE.md, discrétion), aucun texte
// nouveau : tout vient des messages existants. Texte ivoire partout (13,1:1 sur encre, 10,7:1 sur
// sapin), focus champagne (6,8:1 et 5,5:1).

export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations('Footer')
  const lang = await getTranslations('Locale')
  const nav = await getTranslations('Nav')
  const home = await getTranslations('Home')
  const scenes = await getTranslations('Scenes')
  const services = await getTranslations('Services')
  const meta = await getTranslations('Meta')
  const names = { fr: lang('fr'), en: lang('en') }

  // La phrase de l'accueil, coupée après sa virgule ; les pays, un par ligne (séparés par « · »,
  // entourés d'espaces insécables).
  const phrase = home('title')
  const coupure = phrase.indexOf(',') + 1
  const lignes = coupure > 0 ? [phrase.slice(0, coupure), phrase.slice(coupure).trim()] : [phrase]

  const pages = [
    { href: '/la-maison', label: nav('house') },
    { href: '/services', label: nav('services') },
    { href: '/territoires', label: nav('territories') },
    { href: '/contact', label: nav('contact') },
  ] as const

  return (
    <footer
      id="pied-de-page"
      aria-label={t('label')}
      data-surface="sapin"
      data-pied
      className="bg-encre"
    >
      <PiedFond />
      <div className="px-margin pt-48 pb-24 lg:pt-64">
        <div data-pied-haut className="flex items-start justify-between gap-24">
          <p className="font-display text-display-l">
            {lignes.map((ligne) => (
              <span key={ligne} className="block">
                {ligne}
              </span>
            ))}
          </p>
          {/* « #top » ramène en haut de la page même sans JavaScript (défilement doux de M12). */}
          <a href="#top" data-retour aria-label={t('top')}>
            <svg viewBox="0 0 24 34" fill="none" aria-hidden="true" focusable="false">
              <path d="M12 33V2M2 12 12 2l10 10" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </a>
        </div>

        <div className="mt-48 grid gap-x-24 gap-y-48 md:grid-cols-2 lg:grid-cols-12">
          <div className="flex flex-col gap-16 lg:col-span-3">
            <h2 className="text-label font-medium uppercase">{meta('siteName')}</h2>
            <ul className="text-label-l uppercase">
              {scenes('territories.countries')
                .split(/\s*·\s*/)
                .map((pays) => (
                  <li key={pays}>{pays}</li>
                ))}
            </ul>
          </div>
          <nav
            aria-label={t('navigation')}
            className="flex flex-col gap-16 md:col-span-2 lg:col-span-6"
          >
            <h2 className="text-label font-medium uppercase">{t('navigation')}</h2>
            <div className="flex flex-wrap gap-x-48">
              <ul>
                {pages.map(({ href, label }) => (
                  <li key={href}>
                    <Link data-lien href={localizedPath(href, locale)}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
              <ul>
                {SERVICES.map((service) => (
                  <li key={service.id}>
                    <Link data-lien href={localizedPath(SERVICE_PATHS[service.id], locale)}>
                      {services(`${service.key}.name`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
          <div className="flex flex-col gap-16 md:col-start-2 md:row-start-1 lg:col-span-3 lg:col-start-10">
            <h2 className="text-label font-medium uppercase">{scenes('contact.label')}</h2>
            <p className="text-body-s">{scenes('contact.reassurance')}</p>
            <p>
              <Link data-lien href={localizedPath('/contact', locale)}>
                {scenes('contact.button')}
              </Link>
            </p>
          </div>
        </div>

        <PiedMot mot={meta('siteName').toLowerCase()} />

        <div className="mt-16 flex flex-wrap items-center gap-x-32 gap-y-8 border border-ivoire px-24 py-8">
          <p className="text-body-l">{t('copyright')}</p>
          <p className="min-w-0 flex-1 text-body-s">{t('ai')}</p>
          <ul className="flex flex-wrap gap-x-24">
            <li>
              <Link data-lien href={localizedPath('/mentions-legales', locale)}>
                {t('legal')}
              </Link>
            </li>
            <li>
              <Link data-lien href={localizedPath('/confidentialite', locale)}>
                {t('privacy')}
              </Link>
            </li>
          </ul>
          <LanguageSwitcher label={lang('label')} active={locale} names={names} onDark />
        </div>
      </div>
    </footer>
  )
}
