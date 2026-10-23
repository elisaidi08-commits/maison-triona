import { getTranslations } from 'next-intl/server'
import { Wordmark } from '@/components/brand/Wordmark'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Stamp } from '@/components/ui/Stamp'
import { LanguageSwitcher } from './LanguageSwitcher'
import { MenuPanneau } from './MenuPanneau'
import { MobileMenu } from './MobileMenu'
import { NavLink } from './NavLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import p01 from '../../../public/media/seuil/P01-fenetre-mer-m.jpg'
import p02 from '../../../public/media/maison/P02-porte-ocre-m.jpg'
import p10 from '../../../public/media/prototype/P10-seuil-portes-m.jpg'
import p13 from '../../../public/media/prototype/P13-console-vase-m.jpg'

// En-tête (docs/art-direction.md §7.1) : wordmark, 4 entrées, FR · EN. Transparent, non collant.
// Desktop : navigation en ligne. Mobile : « Menu » ouvre un menu plein écran (MobileMenu).
// Prototype V5 (D31) : sur les pages qui portent `data-entete-menu`, « Menu » ouvre à toutes les
// tailles le menu plein écran à aplats (MenuPanneau), avec une pièce par entrée.

const ENTRIES = [
  { href: '/la-maison', key: 'house' },
  { href: '/services', key: 'services' },
  { href: '/territoires', key: 'territories' },
  { href: '/contact', key: 'contact' },
] as const

// Pièce montrée au survol de chaque entrée du menu plein écran (décorative : le lien dit tout).
const ROOMS = [p02, p13, p01, p10]

export async function Header({ locale }: { locale: Locale }) {
  const t = await getTranslations('Header')
  const nav = await getTranslations('Nav')
  const lang = await getTranslations('Locale')
  const names = { fr: lang('fr'), en: lang('en') }

  return (
    <header className="flex items-center justify-between gap-24 px-margin py-16">
      <Wordmark href={`/${locale}`} label={t('home')} />

      <div className="hidden items-center gap-48 lg:flex entete-menu:lg:hidden">
        <nav aria-label={t('navLabel')}>
          <ul className="flex items-center gap-32">
            {ENTRIES.map(({ href, key }) => (
              <li key={key}>
                <NavLink href={localizedPath(href, locale)}>{nav(key)}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <LanguageSwitcher label={lang('label')} active={locale} names={names} />
      </div>

      <div className="lg:hidden entete-menu:hidden">
        <MobileMenu openLabel={t('menu')} closeLabel={t('close')}>
          <nav aria-label={t('navLabel')}>
            <ul className="flex flex-col gap-16">
              {ENTRIES.map(({ href, key }) => (
                <li key={key}>
                  <NavLink href={localizedPath(href, locale)} large>
                    {nav(key)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-end justify-between">
            <Stamp size="sm" />
            <LanguageSwitcher label={lang('label')} active={locale} names={names} />
          </div>
        </MobileMenu>
      </div>

      <div className="hidden entete-menu:block">
        <MenuPanneau
          openLabel={t('menu')}
          closeLabel={t('close')}
          images={ROOMS.map((room) => (
            <ResponsiveImage key={room.src} desktop={room} mobile={room} alt="" sizes="28vw" />
          ))}
        >
          <nav aria-label={t('navLabel')}>
            <ul className="flex flex-col gap-8">
              {ENTRIES.map(({ href, key }, index) => (
                <li key={key} data-menu-lien={index}>
                  <NavLink href={localizedPath(href, locale)} menu>
                    {nav(key)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-end justify-between">
            <Stamp size="sm" />
            <LanguageSwitcher label={lang('label')} active={locale} names={names} />
          </div>
        </MenuPanneau>
      </div>
    </header>
  )
}
