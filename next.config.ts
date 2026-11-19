import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

import { redirectionsVercelApp } from './src/lib/redirections'
import { verifierCronAuBuild } from './src/lib/security/cron'

// Configuration de base. En-têtes de sécurité : story 5.1 ; images : stories 1.3 et 2.5.

// Coffre ou e-mails configurés en production sans CRON_SECRET valable : le build échoue (stories
// 3.2 D et 3.3, src/lib/security/cron.ts).
verifierCronAuBuild(process.env)

const deploye = Boolean(process.env.VERCEL_ENV)
const dev = process.env.NODE_ENV === 'development'
// Ouverture : production Vercel ET SITE_INDEXABLE (story 5.5). L'aperçu public de D62 est un
// déploiement de production non indexable : il garde le noindex, fichiers compris.
const ouvert = process.env.VERCEL_ENV === 'production' && process.env.SITE_INDEXABLE === 'true'

// CSP statique (docs/architecture.md §9.1) : une CSP à nonce rendrait toutes les pages dynamiques.
// `'unsafe-inline'` reste nécessaire aux scripts en ligne de Next.js (l'option SRI ne couvre que
// les fichiers) ; risque faible, aucun texte saisi par des tiers n'est affiché sur le site public.
// Tout vient de notre domaine : `'self'` partout, aucun domaine tiers.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Seulement une fois déployé : en local (http), il ferait demander les fichiers en https.
  ...(deploye ? ['upgrade-insecure-requests'] : []),
].join('; ')

// En-têtes communs au site et au coffre (story 5.1). La CSP est à part : statique pour le site,
// à nonce pour le coffre (src/proxy.ts) ; deux CSP sur une même réponse se cumuleraient.
const commonHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
]

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  ...commonHeaders,
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
]

// Coffre (story 3.2 C, docs/architecture.md §9.1) : jamais indexé, même le site ouvert ; jamais mis
// en cache ; aucun référent envoyé. Placé en dernier : pour une même clé, la dernière règle l'emporte.
const coffreHeaders = [
  ...commonHeaders,
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Cache-Control', value: 'no-store' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
]

// Liens personnels de réservation d'appel (story 3.10, docs/reservation-appel.md §4.4) : le jeton est
// dans l'adresse. Jamais indexés, jamais mis en cache. Référent : l'origine seule (`strict-origin`),
// jamais le chemin, donc jamais le jeton ; et ces pages ne font aucune requête vers un autre site (CSP
// 'self', aucun lien externe). Pas `no-referrer` : avec lui, le navigateur envoie `Origin: null` sur
// l'envoi d'un formulaire sans JavaScript (spécification Fetch, « append a request Origin header »),
// et Next refuse alors la Server Action (contrôle d'origine contre le CSRF). Réservation,
// confirmation, fichier .ics, et les liens de gestion à venir (3.11) ; pas la page de demande de lien
// (/contact/appel, 3.9). Placé après les en-têtes du site.
const LIEN_RESERVATION = '/:locale(fr|en)/contact/appel/:chemin+'
const lienHeaders = [
  { key: 'Referrer-Policy', value: 'strict-origin' },
  { key: 'Cache-Control', value: 'no-store' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
]

// Tout sauf /coffre et ce qui est dessous.
const HORS_COFFRE = '/((?!coffre(?:/|$)).*)'

const nextConfig: NextConfig = {
  // Requis par `ensureStatic` (docs/architecture.md §2).
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Images : AVIF puis WebP, deux qualités autorisées (obligatoire depuis Next 16).
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [60, 75],
  },
  // Préproduction (story 1.5) et aperçu public (D62) : tout ce qui n'est pas le site ouvert porte
  // X-Robots-Tag noindex, y compris les images et les vidéos que la balise meta ne couvre pas, même si
  // un domaine personnalisé est attribué à une branche (docs/trust-contact-launch.md D.6).
  // En-têtes de sécurité sur toutes les routes, production comprise (story 5.1) ; ceux du coffre à
  // part (story 3.2 C).
  async headers() {
    const site = [{ source: HORS_COFFRE, headers: securityHeaders }]
    const lien = [{ source: LIEN_RESERVATION, headers: lienHeaders }]
    const coffre = [{ source: '/coffre/:path*', headers: coffreHeaders }]
    if (ouvert) return [...site, ...lien, ...coffre]
    return [
      ...site,
      { source: '/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      ...lien,
      ...coffre,
    ]
  },
  // Le jour de l'ouverture, l'adresse vercel.app redirige vers le domaine (308) : sinon elle serait
  // indexable en double (audit du 06/11/2026, §3.1 n° 7). Inactive d'ici là, jamais sur un aperçu, et
  // jamais vers une adresse vercel.app (boucle) : siteUrl() refuse alors le build. Jamais sur
  // `/api/cron/` : Vercel Cron ne suit aucune redirection, et les deux tâches planifiées
  // (`/api/cron/retention`, `/api/cron/envoi`) sont protégées par CRON_SECRET (src/lib/redirections.ts).
  async redirects() {
    return redirectionsVercelApp({ ouvert, siteUrl: process.env.SITE_URL })
  },
  experimental: {
    // Page 404 unique pour les adresses qui ne passent par aucune langue (fichiers inconnus).
    globalNotFound: true,
    // Envoi du formulaire de contact (story 3.5, docs/architecture.md §6.7) : 64 ko au plus, le
    // mot libre plafonné à 2 000 caractères compris (1 Mo par défaut).
    serverActions: {
      bodySizeLimit: '64kb',
    },
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
}

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

export default withNextIntl(nextConfig)
