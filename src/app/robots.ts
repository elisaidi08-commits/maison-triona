import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site'

// robots.txt (story 4.3) : tout est autorisé, y compris pendant le noindex. Un `Disallow: /`
// empêcherait les moteurs de lire la balise noindex et laisserait les adresses dans l'index.
// Robots d'IA (Google-Extended, GPTBot…) : choix de Cat (D64, n° 14), autorisés d'ici là ; les
// robots de recherche restent autorisés dans tous les cas.

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
