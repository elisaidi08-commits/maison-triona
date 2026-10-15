'use client'

import { useLocale } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

// Sélecteur typographique FR · EN : vrais liens vers la même page dans l'autre langue,
// `lang` et `hrefLang` sur chaque lien, langue active en encre, inactive en encre 68 %.

type LanguageSwitcherProps = {
  label: string
  names: Record<(typeof routing.locales)[number], string>
}

export function LanguageSwitcher({ label, names }: LanguageSwitcherProps) {
  const active = useLocale()
  const pathname = usePathname()
  return (
    <nav aria-label={label} className="flex items-center gap-8 text-label uppercase">
      {routing.locales.map((locale, index) => (
        <span key={locale} className="flex items-center gap-8">
          {index > 0 ? (
            <span aria-hidden="true" className="text-encre-68">
              ·
            </span>
          ) : null}
          <Link
            href={pathname}
            locale={locale}
            lang={locale}
            hrefLang={locale}
            aria-current={locale === active ? 'true' : undefined}
            className={`inline-flex min-h-touch min-w-touch items-center justify-center ${
              locale === active ? 'text-encre' : 'text-encre-68 hover:text-encre'
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
