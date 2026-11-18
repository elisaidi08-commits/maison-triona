import { pageJsonLd, type PublicPage } from '@/lib/seo'

// Données structurées d'une page (story 4.3). Un bloc `application/ld+json` n'est pas exécuté :
// la CSP ne le concerne pas. `<` est échappé pour qu'aucun texte ne ferme la balise.

export async function JsonLd({ page }: { page: PublicPage }) {
  const data = await pageJsonLd(page)
  if (!data) return null
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
