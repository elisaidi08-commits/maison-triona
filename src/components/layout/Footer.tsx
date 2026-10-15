import { getTranslations } from 'next-intl/server'
import { Stamp } from '@/components/ui/Stamp'
import { LanguageSwitcher } from './LanguageSwitcher'
import { NavLink } from './NavLink'

// Pied de page (docs/art-direction.md §7.6) : filet or pleine largeur, « K. » 48 px,
// liens légaux et contact, FR · EN, mention des images générées par IA (privacy.md §4).

export async function Footer() {
  const t = await getTranslations('Footer')
  const lang = await getTranslations('Locale')
  const names = { fr: lang('fr'), en: lang('en') }

  return (
    <footer
      id="pied-de-page"
      aria-label={t('label')}
      className="border-t border-or px-margin py-48"
    >
      <div className="flex flex-col items-center gap-24 text-center lg:flex-row lg:justify-between lg:text-left">
        <Stamp size="md" />
        <ul className="flex flex-col items-center gap-8 lg:flex-row lg:gap-32">
          <li>
            <NavLink href="/mentions-legales">{t('legal')}</NavLink>
          </li>
          <li>
            <NavLink href="/confidentialite">{t('privacy')}</NavLink>
          </li>
          <li>
            <NavLink href="/contact">{t('contact')}</NavLink>
          </li>
        </ul>
        <div className="flex flex-col items-center gap-8 lg:items-end">
          <LanguageSwitcher label={lang('label')} names={names} />
          <p className="text-body-s">{t('copyright')}</p>
        </div>
      </div>
      <p className="mt-24 text-center text-body-s">{t('ai')}</p>
    </footer>
  )
}
