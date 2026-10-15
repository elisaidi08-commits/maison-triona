import { getTranslations } from 'next-intl/server'
import { Wordmark } from '@/components/brand/Wordmark'
import { Stamp } from '@/components/ui/Stamp'
import { LanguageSwitcher } from './LanguageSwitcher'
import { MobileMenu } from './MobileMenu'
import { NavLink } from './NavLink'

// En-tête (docs/art-direction.md §7.1) : wordmark, 4 entrées, FR · EN. Transparent, non collant.
// Desktop : navigation en ligne. Mobile : « Menu » ouvre un menu plein écran (MobileMenu).

const ENTRIES = [
  { href: '/la-maison', key: 'house' },
  { href: '/services', key: 'services' },
  { href: '/territoires', key: 'territories' },
  { href: '/contact', key: 'contact' },
] as const

export async function Header({ locale }: { locale: string }) {
  const t = await getTranslations('Header')
  const nav = await getTranslations('Nav')
  const lang = await getTranslations('Locale')
  const names = { fr: lang('fr'), en: lang('en') }

  return (
    <header className="flex items-center justify-between gap-24 px-margin py-16">
      <Wordmark href={`/${locale}`} label={t('home')} />

      <div className="hidden items-center gap-48 lg:flex">
        <nav aria-label={t('navLabel')}>
          <ul className="flex items-center gap-32">
            {ENTRIES.map(({ href, key }) => (
              <li key={key}>
                <NavLink href={href}>{nav(key)}</NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <LanguageSwitcher label={lang('label')} names={names} />
      </div>

      <MobileMenu openLabel={t('menu')} closeLabel={t('close')}>
        <nav aria-label={t('navLabel')}>
          <ul className="flex flex-col gap-16">
            {ENTRIES.map(({ href, key }) => (
              <li key={key}>
                <NavLink href={href} large>
                  {nav(key)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-end justify-between">
          <Stamp size="sm" />
          <LanguageSwitcher label={lang('label')} names={names} />
        </div>
      </MobileMenu>
    </header>
  )
}
