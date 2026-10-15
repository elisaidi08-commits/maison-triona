import type { NextConfig } from 'next'

// Configuration de base (story 1.1). En-têtes de sécurité : story 5.1 ; images : stories 1.3 et 2.5.
const nextConfig: NextConfig = {
  // Requis par `ensureStatic` (docs/architecture.md §2).
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

export default nextConfig
