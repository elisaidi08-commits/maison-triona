import type { MetadataRoute } from 'next'
import { LOCALES, localizedPath } from '@/i18n/pathnames'
import { languageAlternates, PUBLIC_PAGES } from '@/lib/seo'
import { siteUrl } from '@/lib/site'

// Sitemap multilingue (story 4.3) : chaque page dans chaque langue, avec ses alternances fr, en et
// x-default. Sans `/demo`. Aucune date de modification : nous n'en avons pas de fiable.

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl()
  return PUBLIC_PAGES.flatMap((page) => {
    const languages = Object.fromEntries(
      Object.entries(languageAlternates(page)).map(([lang, path]) => [lang, `${base}${path}`]),
    )
    return LOCALES.map((locale) => ({
      url: `${base}${localizedPath(page, locale)}`,
      alternates: { languages },
    }))
  })
}
