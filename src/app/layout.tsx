import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { manrope, newsreader } from '@/styles/fonts'
import '@/styles/tokens.css'

// Garde-fou : le build échoue si un rendu à la requête s'introduit (docs/architecture.md §2).
export const ensureStatic = 'navigation'

// Le site reste en noindex tant que SITE_INDEXABLE ne vaut pas « true » (ouverture, story 5.5).
const indexable = process.env.SITE_INDEXABLE === 'true'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? 'http://localhost:3000'),
  title: 'Maison Triona',
  robots: { index: indexable, follow: indexable },
  // Image de partage typographique (story 1.3) ; à recomposer sur P01-d quand elle sera validée.
  openGraph: {
    siteName: 'Maison Triona',
    images: [{ url: '/brand/og.png', width: 1200, height: 630, alt: 'Maison Triona' }],
  },
}

// Racine provisoire : la langue passera par le segment [locale] en story 1.4.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${manrope.variable} ${newsreader.variable}`}>
      <body>{children}</body>
    </html>
  )
}
