import { defineRouting } from 'next-intl/routing'

// Langues et chemins localisés (docs/architecture.md §4).
// Toujours préfixé (/fr, /en), aucune détection automatique, aucun cookie de langue.
export const routing = defineRouting({
  locales: ['fr', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: false,
  localeCookie: false,
  pathnames: {
    '/': '/',
    '/la-maison': { fr: '/la-maison', en: '/the-house' },
    '/services': '/services',
    '/territoires': { fr: '/territoires', en: '/where-we-work' },
    '/contact': '/contact',
    '/mentions-legales': { fr: '/mentions-legales', en: '/legal-notice' },
    '/confidentialite': { fr: '/confidentialite', en: '/privacy' },
    '/demo': '/demo',
  },
})

export type Locale = (typeof routing.locales)[number]
