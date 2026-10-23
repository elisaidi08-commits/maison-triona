// Table des chemins localisés, sans dépendance : partagée par le routage (next-intl, côté serveur)
// et par les quelques composants client (navigation, sélecteur de langue), pour que next-intl
// ne soit pas envoyé au navigateur.

export const LOCALES = ['fr', 'en'] as const
export type Locale = (typeof LOCALES)[number]

export const PATHNAMES = {
  '/': '/',
  '/la-maison': { fr: '/la-maison', en: '/the-house' },
  '/services': '/services',
  '/services/conciergerie': { fr: '/services/conciergerie', en: '/services/concierge' },
  '/services/grand-age': { fr: '/services/grand-age', en: '/services/senior-companionship' },
  '/services/enfants': { fr: '/services/enfants', en: '/services/childcare' },
  '/territoires': { fr: '/territoires', en: '/where-we-work' },
  '/contact': '/contact',
  '/mentions-legales': { fr: '/mentions-legales', en: '/legal-notice' },
  '/confidentialite': { fr: '/confidentialite', en: '/privacy' },
  '/demo': '/demo',
  '/prototype': '/prototype',
  '/prototype/film': '/prototype/film',
  '/prototype/chemin': '/prototype/chemin',
} as const

export type InternalPath = keyof typeof PATHNAMES

/** Chemin public d'une page dans une langue : `/en/the-house`. */
export function localizedPath(internal: InternalPath, locale: Locale): string {
  const entry = PATHNAMES[internal]
  const path = typeof entry === 'string' ? entry : entry[locale]
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

/** Même page dans une autre langue ; à défaut, l'accueil de cette langue. */
export function switchLocalePath(publicPath: string, target: Locale): string {
  const clean = publicPath.replace(/\/$/, '') || '/'
  for (const internal of Object.keys(PATHNAMES) as InternalPath[]) {
    for (const locale of LOCALES) {
      if (localizedPath(internal, locale) === clean) return localizedPath(internal, target)
    }
  }
  return `/${target}`
}
