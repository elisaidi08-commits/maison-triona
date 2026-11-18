import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { localizedPath, type InternalPath, type Locale } from '@/i18n/pathnames'
import { siteUrl } from './site'

// SEO technique (story 4.3, docs/seo-strategy.md §G) : métadonnées par page et par langue,
// alternances réciproques, données structurées. Jamais le nom de Cat (D45).

/** Pages publiques, dans l'ordre du sitemap. `/demo` n'y figure jamais (banc d'essai, noindex). */
export const PUBLIC_PAGES = [
  '/',
  '/services',
  '/services/conciergerie',
  '/services/grand-age',
  '/services/enfants',
  '/la-maison',
  '/territoires',
  '/faq',
  '/comment-ca-se-passe',
  '/comment-ca-se-passe/langage-simple',
  '/notre-independance',
  '/contact',
  '/mentions-legales',
  '/confidentialite',
  '/accessibilite',
] as const satisfies readonly InternalPath[]

export type PublicPage = (typeof PUBLIC_PAGES)[number]

// Clé des textes dans `Meta.pages` (brouillons, audit du 06/11/2026 annexe B), nom affiché de la page
// (`Pages`, ou le nom du service dans `Services`) et page parente (pour un futur fil d'Ariane).
const PAGES: Record<PublicPage, { meta: string; crumb: string; parent?: PublicPage }> = {
  '/': { meta: 'home', crumb: 'Pages.home' },
  '/services': { meta: 'services', crumb: 'Pages.services', parent: '/' },
  '/services/conciergerie': {
    meta: 'concierge',
    crumb: 'Services.concierge.name',
    parent: '/services',
  },
  '/services/grand-age': { meta: 'senior', crumb: 'Services.senior.name', parent: '/services' },
  '/services/enfants': { meta: 'children', crumb: 'Services.children.name', parent: '/services' },
  '/la-maison': { meta: 'house', crumb: 'Pages.house', parent: '/' },
  '/territoires': { meta: 'territories', crumb: 'Pages.territories', parent: '/' },
  '/faq': { meta: 'faq', crumb: 'Pages.faq', parent: '/' },
  '/comment-ca-se-passe': { meta: 'howItWorks', crumb: 'Pages.howItWorks', parent: '/' },
  '/comment-ca-se-passe/langage-simple': {
    meta: 'easyRead',
    crumb: 'Pages.easyRead',
    parent: '/comment-ca-se-passe',
  },
  '/notre-independance': { meta: 'independence', crumb: 'Pages.independence', parent: '/' },
  '/contact': { meta: 'contact', crumb: 'Pages.contact', parent: '/' },
  '/mentions-legales': { meta: 'legal', crumb: 'Pages.legal', parent: '/' },
  '/confidentialite': { meta: 'privacy', crumb: 'Pages.privacy', parent: '/' },
  '/accessibilite': { meta: 'accessibility', crumb: 'Pages.accessibility', parent: '/' },
}

/** Clé des textes d'une page dans `Meta.pages` (titre et description). */
export const pageMetaKey = (page: PublicPage): string => PAGES[page].meta

/** Alternances : la page elle-même, son équivalent dans l'autre langue, `x-default` vers le français. */
export function languageAlternates(page: InternalPath) {
  return {
    fr: localizedPath(page, 'fr'),
    en: localizedPath(page, 'en'),
    'x-default': localizedPath(page, 'fr'),
  }
}

/** Open Graph commun (le layout et chaque page : Next.js ne fusionne pas `openGraph` en profondeur). */
export function openGraphBase(locale: Locale, alt = 'Maison Triona') {
  return {
    siteName: 'Maison Triona',
    locale: locale === 'fr' ? 'fr_FR' : 'en_GB',
    type: 'website' as const,
    images: [{ url: '/brand/og.png', width: 1200, height: 630, alt }],
  }
}

/** Titre, description, canonical, alternances et Open Graph d'une page publique. */
export async function pageMetadata(page: PublicPage): Promise<Metadata> {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations({ locale, namespace: 'Meta.pages' })
  // Le sceau, sans texte, sert aux deux langues ; son texte alternatif suit la page.
  const ogAlt = (await getTranslations({ locale, namespace: 'Meta' }))('ogAlt')
  const { meta } = PAGES[page]
  const title = t(`${meta}.title`)
  const description = t(`${meta}.description`)
  const path = localizedPath(page, locale)
  return {
    title,
    description,
    alternates: { canonical: path, languages: languageAlternates(page) },
    openGraph: { ...openGraphBase(locale, ogAlt), title, description, url: path },
  }
}

// Données structurées (JSON-LD), seulement ce que la page montre (règles de Google, consultées le
// 18/11/2026) : Organization et WebSite sur l'accueil, FAQPage sur la FAQ, Service sur les pages de
// service. Organization :
// nom, URL (racine du domaine), logo ; ni adresse, ni personne, ni `sameAs`, ni description (la meta
// description n'est pas affichée). Ni `areaServed` (pays encore en brouillon, Suisse en attente du
// juriste), ni BreadcrumbList tant qu'aucun fil d'Ariane n'est visible. Jamais LocalBusiness ni
// EmploymentAgency.

type JsonLd = Record<string, unknown>

const organisationId = () => `${siteUrl()}/#organisation`

const organisation = (): JsonLd => ({
  '@type': 'Organization',
  '@id': organisationId(),
  name: 'Maison Triona',
  url: `${siteUrl()}/`,
  logo: `${siteUrl()}/brand/sceau.png`,
})

/** JSON-LD d'une page, ou `null` quand elle n'a rien à baliser. */
export async function pageJsonLd(page: PublicPage): Promise<JsonLd | null> {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations({ locale })
  const base = siteUrl()
  const graph: JsonLd[] = []

  if (page === '/') {
    graph.push(organisation(), {
      '@type': 'WebSite',
      name: 'Maison Triona',
      url: `${base}/`,
      inLanguage: locale,
      publisher: { '@id': organisationId() },
    })
  }

  // FAQ : les questions et réponses affichées sur la page, telles quelles (pas de résultat enrichi
  // Google depuis mai 2026 ; utile aux autres moteurs, docs/seo-strategy.md §G).
  if (page === '/faq') {
    const items = t.raw('Faq.items') as { question: string; answer: string }[]
    graph.push({
      '@type': 'FAQPage',
      mainEntity: items.map(({ question, answer }) => ({
        '@type': 'Question',
        name: question,
        acceptedAnswer: { '@type': 'Answer', text: answer },
      })),
    })
  }

  if (page.startsWith('/services/')) {
    // Le prestataire du service est décrit dans la page même : la référence ne reste pas en l'air.
    graph.push(organisation(), {
      '@type': 'Service',
      name: t(PAGES[page].crumb),
      provider: { '@id': organisationId() },
      url: `${base}${localizedPath(page, locale)}`,
    })
  }

  return graph.length > 0 ? { '@context': 'https://schema.org', '@graph': graph } : null
}
