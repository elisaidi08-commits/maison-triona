'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LOCALES, switchLocalePath, type Locale } from '@/i18n/pathnames'

// Sélecteur typographique FR · EN : vrais liens vers la même page dans l'autre langue,
// `lang` et `hrefLang` sur chaque lien, langue active en encre, inactive en encre 68 %. Sur sapin
// (`onDark`, pied de page D54) : ivoire et ivoire 80 %.

type LanguageSwitcherProps = {
  label: string
  active: Locale
  names: Record<Locale, string>
  onDark?: boolean
}

export function LanguageSwitcher({ label, active, names, onDark = false }: LanguageSwitcherProps) {
  const pathname = usePathname()
  return (
    <nav aria-label={label} className="flex items-center gap-8 text-label uppercase">
      {LOCALES.map((locale, index) => (
        <span key={locale} className="flex items-center gap-8">
          {index > 0 ? (
            <span aria-hidden="true" className={onDark ? 'text-ivoire-80' : 'text-encre-68'}>
              ·
            </span>
          ) : null}
          <Link
            href={switchLocalePath(pathname, locale)}
            lang={locale}
            hrefLang={locale}
            aria-current={locale === active ? 'true' : undefined}
            className={`inline-flex min-h-touch min-w-touch items-center justify-center ${
              locale === active
                ? onDark
                  ? 'text-ivoire'
                  : 'text-encre'
                : onDark
                  ? 'text-ivoire-80 hover:text-ivoire'
                  : 'text-encre-68 hover:text-encre'
            }`}
          >
            {locale.toUpperCase()}
            <span className="sr-only"> – {names[locale]}</span>
          </Link>
        </span>
      ))}
    </nav>
  )
}
