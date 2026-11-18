import type { Metadata } from 'next'
import { connection } from 'next/server'
import type { ReactNode } from 'react'

import { cormorant, ebGaramond } from '@/styles/fonts'
import '@/styles/tokens.css'

// Espace du coffre (story 3.2, partie C ; docs/architecture.md §2) : second layout racine, hors de
// [locale] et du proxy de next-intl, en français seulement (outil interne de Cat et Sady). Rien n'y
// est partagé avec le site public hormis les tokens et les polices auto-hébergées.
// Rendu à chaque requête (`connection()` avant tout rendu, aucune coquille statique) : la CSP à
// nonce posée par src/proxy.ts l'exige. `instant = false` dispense ce segment de la validation de
// coquille statique de Cache Components (guide « instant »).
// Jamais indexé (balise et en-tête X-Robots-Tag), jamais mis en cache, absent du sitemap, aucun lien
// depuis le site public.

export const instant = false

export const metadata: Metadata = {
  title: { default: 'Coffre · Maison Triona', template: '%s · Coffre · Maison Triona' },
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default async function CoffreLayout({ children }: { children: ReactNode }) {
  await connection()
  return (
    <html lang="fr" className={`${cormorant.variable} ${ebGaramond.variable}`}>
      <body>
        <main id="contenu" className="conteneur flex flex-col gap-48 py-section">
          {/* La lecture des demandes (partie D) se déchiffre dans le navigateur. */}
          <noscript>
            <p className="text-body text-encre">Le coffre demande JavaScript.</p>
          </noscript>
          {children}
        </main>
      </body>
    </html>
  )
}
