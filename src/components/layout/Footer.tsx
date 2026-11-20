import { getTranslations } from 'next-intl/server'
import { Stamp } from '@/components/ui/Stamp'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NavLink } from './NavLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICE_PATHS, SERVICES } from '@/lib/services'

// Pied de page « Kiln » (D54, validé par Cat), rendu immobile par D64 (2), resserré par D72 (story
// 2.16) : fond ivoire, filet or en tête ; la phrase de l'accueil en deux lignes ; deux zones (la
// maison et ses pays, la navigation) ; le nom « Maison Triona » signé du « K. » (Stamp, 48 px) ; une
// barre sous un filet or : copyright, liens légaux, FR · EN, puis la mention des images générées par
// IA (privacy.md §4) et « Revenir en haut de la page », un vrai lien texte vers `#top` (sans
// JavaScript). D72 retire la colonne Contact, qui répétait le bloc Contact posé juste au-dessus sur la
// plupart des pages (le lien Contact reste dans la navigation et dans la barre mobile), et la touche
// sapin de 96 px. Rien ne bouge. Aucun réseau social (CLAUDE.md, discrétion), aucun texte nouveau.
//
// Mobile (< 768) : la navigation se replie dans un <details> natif (s'ouvre sans JavaScript, signe
// + / − comme la FAQ). Tablette et desktop : la maison à gauche, la navigation ouverte à droite.

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
    { href: '/faq', label: nav('faq') },
    { href: '/contact', label: nav('contact') },
  ] as const

  // Les deux listes de la navigation, rendues ouvertes (≥ 768) ou repliées (< 768).
  const listes = (
    <>
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
    </>
  )

  return (
    <footer id="pied-de-page" aria-label={t('label')} className="border-t border-or print:hidden">
      <div className="conteneur pt-48 pb-24 lg:pt-64">
        <p className="font-display text-title-h2 text-balance text-sapin">
          {lignes.map((ligne) => (
            <span key={ligne} className="block">
              {ligne}
            </span>
          ))}
        </p>

        <div className="mt-48 grid gap-x-gutter gap-y-32 md:grid-cols-12 lg:mt-64">
          <div className="flex flex-col gap-16 md:col-span-4 lg:col-span-3">
            <h2 className="text-label text-encre uppercase">{meta('siteName')}</h2>
            <ul className="flex flex-wrap gap-x-24 text-label-l text-encre uppercase md:flex-col">
              {pays.map((nom) => (
                <li key={nom}>{nom}</li>
              ))}
            </ul>
          </div>
          <nav
            aria-label={t('navigation')}
            className="hidden flex-col gap-8 md:col-span-8 md:flex lg:col-span-6 lg:col-start-7"
          >
            <h2 className="text-label text-encre uppercase">{t('navigation')}</h2>
            <div className="flex gap-x-48">{listes}</div>
          </nav>
          <nav aria-label={t('navigation')} className="md:hidden">
            <details className="group border-y border-or">
              <summary className="flex min-h-touch cursor-pointer items-center justify-between text-label text-encre uppercase">
                {t('navigation')}
                <span aria-hidden="true" className="font-display text-title-h3 group-open:hidden">
                  +
                </span>
                <span
                  aria-hidden="true"
                  className="hidden font-display text-title-h3 group-open:inline"
                >
                  −
                </span>
              </summary>
              <div className="flex flex-col pb-16">{listes}</div>
            </details>
          </nav>
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
              <li>
                <NavLink href={localizedPath('/accessibilite', locale)}>
                  {t('accessibility')}
                </NavLink>
              </li>
            </ul>
            <LanguageSwitcher label={lang('label')} active={locale} names={names} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-32">
            <p className="text-body-s">{t('ai')}</p>
            {/* « #top » ramène en haut de la page, même sans JavaScript (défilement doux de M12). */}
            <a
              href="#top"
              className="inline-flex min-h-touch items-center text-nav text-encre decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:text-sapin hover:underline"
            >
              {t('top')}
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
