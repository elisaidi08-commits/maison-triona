import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// Configuration de base. En-têtes de sécurité : story 5.1 ; images : stories 1.3 et 2.5.
const nextConfig: NextConfig = {
  // Requis par `ensureStatic` (docs/architecture.md §2).
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Préproduction (story 1.5) : tout ce qui n'est pas la production Vercel porte X-Robots-Tag
  // noindex, même si un domaine personnalisé est attribué à une branche (docs/trust-contact-launch.md D.6).
  async headers() {
    if (process.env.VERCEL_ENV === 'production') return []
    return [{ source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }]
  },
  experimental: {
    // Page 404 unique pour les adresses qui ne passent par aucune langue (fichiers inconnus).
    globalNotFound: true,
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
