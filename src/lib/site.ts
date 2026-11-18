// Adresse publique du site, sans barre finale (story 4.3). Elle fait les URL absolues des canonical,
// des alternances, du sitemap, de robots.txt, des images de partage et des données structurées.
//
// En production Vercel, son absence fait échouer le build (audit du 06/11/2026, §3.1 n° 8) : sans
// elle, tout pointerait vers localhost. Aperçu Vercel : sa propre adresse. Ailleurs (poste local,
// CI), repli sur localhost.

// Le site reste en noindex tant que SITE_INDEXABLE ne vaut pas « true » (ouverture, story 5.5).
export const indexable = process.env.SITE_INDEXABLE === 'true'

export function siteUrl(): string {
  const url = process.env.SITE_URL?.trim()
  if (url) {
    // Site ouvert sur une adresse vercel.app : doublon d'index et boucle de redirection (next.config.ts).
    if (indexable && new URL(url).hostname.endsWith('.vercel.app')) {
      throw new Error(
        'SITE_URL ne peut pas être une adresse vercel.app quand SITE_INDEXABLE vaut « true ».',
      )
    }
    return url.replace(/\/+$/, '')
  }
  // Aperçu Vercel sans SITE_URL : sa propre adresse, pour que les images de partage s'affichent.
  if (process.env.VERCEL_ENV === 'preview' && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  if (process.env.VERCEL_ENV === 'production') {
    throw new Error(
      'SITE_URL manquante : variable obligatoire en production (le domaine maisontriona.com à l’ouverture, D65).',
    )
  }
  return 'http://localhost:3000'
}
