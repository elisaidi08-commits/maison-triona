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
  '/services/grand-age': { fr: '/services/grand-age', en: '/services/later-life' },
  '/services/enfants': { fr: '/services/enfants', en: '/services/childcare' },
  '/territoires': { fr: '/territoires', en: '/where-we-work' },
  '/faq': '/faq',
  '/comment-ca-se-passe': { fr: '/comment-ca-se-passe', en: '/how-it-works' },
  '/comment-ca-se-passe/langage-simple': {
    fr: '/comment-ca-se-passe/langage-simple',
    en: '/how-it-works/easy-read',
  },
  '/notre-independance': { fr: '/notre-independance', en: '/our-independence' },
  '/contact': '/contact',
  // Remerciement après un envoi (story 3.2 B) : noindex, hors du sitemap.
  '/contact/merci': '/contact/merci',
  '/mentions-legales': { fr: '/mentions-legales', en: '/legal-notice' },
  '/confidentialite': { fr: '/confidentialite', en: '/privacy' },
  '/accessibilite': { fr: '/accessibilite', en: '/accessibility' },
  '/demo': '/demo',
} as const

export type InternalPath = keyof typeof PATHNAMES

/** Chemin public d'une page dans une langue : `/en/the-house`. */
export function localizedPath(internal: InternalPath, locale: Locale): string {
  const entry = PATHNAMES[internal]
  const path = typeof entry === 'string' ? entry : entry[locale]
  return path === '/' ? `/${locale}` : `/${locale}${path}`
}

// Liens personnels de réservation d'appel (story 3.10) : hors de la table, même chemin dans les deux
// langues (comme /contact/merci), jamais dans le sitemap. Le jeton est dans l'adresse : ces pages sont
// noindex, no-store, référent réduit à l'origine (next.config.ts).
const BOOKING = /^\/(?:fr|en)(\/contact\/appel\/[A-Za-z0-9_-]{43}(?:\/confirmation)?)$/

/** Page de réservation d'un lien : `/fr/contact/appel/<jeton>`. */
export function bookingPath(locale: Locale, token: string): string {
  return `/${locale}/contact/appel/${token}`
}

/** Confirmation, après la réservation. */
export function bookingConfirmationPath(locale: Locale, token: string): string {
  return `${bookingPath(locale, token)}/confirmation`
}

/** Fichier .ics de l'appel (« Ajouter à mon agenda »). */
export function bookingCalendarPath(locale: Locale, token: string): string {
  return `${bookingPath(locale, token)}/agenda`
}

/** Même page dans une autre langue ; à défaut, l'accueil de cette langue. */
export function switchLocalePath(publicPath: string, target: Locale): string {
  const clean = publicPath.replace(/\/$/, '') || '/'
  // Lien de réservation : la même page, dans l'autre langue (le jeton ne change pas).
  const booking = BOOKING.exec(clean)
  if (booking) return `/${target}${booking[1]}`
  for (const internal of Object.keys(PATHNAMES) as InternalPath[]) {
    for (const locale of LOCALES) {
      if (localizedPath(internal, locale) === clean) return localizedPath(internal, target)
    }
  }
  return `/${target}`
}
