import type { Metadata } from 'next'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { cormorant, ebGaramond } from '@/styles/fonts'
import '@/styles/tokens.css'

// 404 des adresses qui ne passent par aucune langue (fichiers inconnus) : bilingue, sans gabarit.

export const metadata: Metadata = {
  title: 'Maison Triona',
}

export default function GlobalNotFound() {
  return (
    <html lang="fr" className={`${cormorant.variable} ${ebGaramond.variable}`}>
      <body>
        <main className="conteneur flex flex-col gap-24 py-section">
          <Rule short />
          <h1 className="font-display text-display-l text-sapin">Cette page n’existe pas.</h1>
          <p>
            <TextLink href="/fr">Revenir à l’accueil</TextLink>
          </p>
          <p lang="en">
            <TextLink href="/en">This page does not exist. Back to the home page</TextLink>
          </p>
        </main>
      </body>
    </html>
  )
}
