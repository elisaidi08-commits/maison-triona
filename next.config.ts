import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// Configuration de base. En-têtes de sécurité : story 5.1 ; images : stories 1.3 et 2.5.

const deploye = Boolean(process.env.VERCEL_ENV)
const dev = process.env.NODE_ENV === 'development'
// Ouverture : production Vercel ET SITE_INDEXABLE (story 5.5). L'aperçu public de D62 est un
// déploiement de production non indexable : il garde le noindex, fichiers compris.
const ouvert = process.env.VERCEL_ENV === 'production' && process.env.SITE_INDEXABLE === 'true'

// CSP statique (docs/architecture.md §9.1) : une CSP à nonce rendrait toutes les pages dynamiques.
// `'unsafe-inline'` reste nécessaire aux scripts en ligne de Next.js (l'option SRI ne couvre que
// les fichiers) ; risque faible, aucun texte saisi par des tiers n'est affiché sur le site public.
// Tout vient de notre domaine : `'self'` partout, aucun domaine tiers.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Seulement une fois déployé : en local (http), il ferait demander les fichiers en https.
  ...(deploye ? ['upgrade-insecure-requests'] : []),
].join('; ')

// En-têtes communs au site et au coffre (story 5.1). La CSP est à part : statique pour le site,
// à nonce pour le coffre (src/proxy.ts) ; deux CSP sur une même réponse se cumuleraient.
const commonHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
]

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  ...commonHeaders,
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
]

// Coffre (story 3.2 C, docs/architecture.md §9.1) : jamais indexé, même le site ouvert ; jamais mis
// en cache ; aucun référent envoyé. Placé en dernier : pour une même clé, la dernière règle l'emporte.
const coffreHeaders = [
  ...commonHeaders,
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Cache-Control', value: 'no-store' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
]

// Tout sauf /coffre et ce qui est dessous.
const HORS_COFFRE = '/((?!coffre(?:/|$)).*)'

const nextConfig: NextConfig = {
  // Requis par `ensureStatic` (docs/architecture.md §2).
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Images : AVIF puis WebP, deux qualités autorisées (obligatoire depuis Next 16).
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 75],
  },
  // Préproduction (story 1.5) et aperçu public (D62) : tout ce qui n'est pas le site ouvert porte
  // X-Robots-Tag noindex, y compris les images et les vidéos que la balise meta ne couvre pas, même si
  // un domaine personnalisé est attribué à une branche (docs/trust-contact-launch.md D.6).
  // En-têtes de sécurité sur toutes les routes, production comprise (story 5.1) ; ceux du coffre à
  // part (story 3.2 C).
  async headers() {
    const site = [{ source: HORS_COFFRE, headers: securityHeaders }]
    const coffre = [{ source: '/coffre/:path*', headers: coffreHeaders }]
    if (ouvert) return [...site, ...coffre]
    return [
      ...site,
      { source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      ...coffre,
    ]
  },
  // Le jour de l'ouverture, l'adresse vercel.app redirige vers le domaine (308) : sinon elle serait
  // indexable en double (audit du 06/11/2026, §3.1 n° 7). Inactive d'ici là, jamais sur un aperçu, et
  // jamais vers une adresse vercel.app (boucle) : siteUrl() refuse alors le build.
  async redirects() {
    const site = process.env.SITE_URL?.trim().replace(/\/+$/, '')
    if (!ouvert || !site || new URL(site).hostname.endsWith('.vercel.app')) return []
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: '.*\\.vercel\\.app' }],
        destination: `${site}/:path*`,
        permanent: true,
      },
    ]
  },
  experimental: {
    // Page 404 unique pour les adresses qui ne passent par aucune langue (fichiers inconnus).
    globalNotFound: true,
    // Envoi du formulaire de contact (story 3.5, docs/architecture.md §6.7) : 64 ko au plus, le
    // mot libre plafonné à 2 000 caractères compris (1 Mo par défaut).
    serverActions: {
      bodySizeLimit: '64kb',
    },
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
