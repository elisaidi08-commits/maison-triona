'use client'

import Link from 'next/link'
import { cormorant, ebGaramond } from '@/styles/fonts'
import '@/styles/tokens.css'

// Erreur du layout racine (audit du 06/11/2026, §3.1 n° 13) : elle remplace tout le document, avec
// ses propres <html> et <body>, ses polices et ses styles (règle de Next.js). Bilingue, comme la 404
// globale ; pas de métadonnées possibles ici, d'où le <title> de React.

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="fr" className={`${cormorant.variable} ${ebGaramond.variable}`}>
      <body>
        <title>Maison Triona</title>
        <main className="conteneur flex flex-col gap-24 py-section">
          <h1 className="font-display text-display-l text-balance text-sapin">
            Un incident nous empêche d’afficher cette page.
          </h1>
          <p lang="en">Something prevents us from showing this page.</p>
          <p className="flex flex-col items-start gap-16">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex min-h-touch cursor-pointer items-center text-sapin underline decoration-or decoration-1 underline-offset-8"
            >
              Réessayer · <span lang="en">Try again</span>
            </button>
            <Link
              href="/fr"
              className="inline-flex min-h-touch items-center text-sapin underline decoration-or decoration-1 underline-offset-8"
            >
              Revenir à l’accueil
            </Link>
            <Link
              href="/en"
              lang="en"
              className="inline-flex min-h-touch items-center text-sapin underline decoration-or decoration-1 underline-offset-8"
            >
              Back to the home page
            </Link>
          </p>
        </main>
      </body>
    </html>
  )
}
