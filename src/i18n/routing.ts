import { defineRouting } from 'next-intl/routing'
import { LOCALES, PATHNAMES } from './pathnames'

// Langues et chemins localisés (docs/architecture.md §4).
// Toujours préfixé (/fr, /en), aucune détection automatique, aucun cookie de langue.
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: false,
  localeCookie: false,
  pathnames: PATHNAMES,
})

export type { Locale } from './pathnames'
