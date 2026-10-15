import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// Configuration de base. En-têtes de sécurité : story 5.1 ; images : stories 1.3 et 2.5.
const nextConfig: NextConfig = {
  // Requis par `ensureStatic` (docs/architecture.md §2).
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
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
