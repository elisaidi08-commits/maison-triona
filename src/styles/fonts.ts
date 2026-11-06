import localFont from 'next/font/local'

// Polices du kit de Cat (D43, D50), auto-hébergées par next/font (aucune requête du navigateur vers
// un tiers). Polices variables réduites à leur plage de graisses et au latin du français par
// scripts/polices-kit.py : 24 ko + 32 ko préchargés, pour un budget de 80 ko. Licences OFL dans
// src/fonts/. Repli Times New Roman ajusté pour limiter le décalage au chargement.

// Titres et nom : Cormorant Garamond, Light et Regular.
export const cormorant = localFont({
  src: '../fonts/cormorant-garamond.woff2',
  weight: '300 400',
  style: 'normal',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
  variable: '--font-cormorant',
})

// Texte : EB Garamond, Regular et Medium.
export const ebGaramond = localFont({
  src: '../fonts/eb-garamond.woff2',
  weight: '400 500',
  style: 'normal',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
  variable: '--font-eb-garamond',
})
