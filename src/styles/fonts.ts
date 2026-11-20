import localFont from 'next/font/local'

// Polices du site, auto-hébergées par next/font (aucune requête du navigateur vers un tiers).
// Prototype D72 : la typographie de la maquette Figma, Plus Jakarta Sans (titres) et Manrope (texte),
// à la place du kit Garamond de D50 (en attente de l'accord de Cat). Polices variables réduites à
// leur plage de graisses et au latin du français par scripts/polices-kit.py : 15 ko + 20 ko
// préchargés, pour un budget de 80 ko. Licences OFL dans src/fonts/. Repli Arial ajusté pour
// limiter le décalage au chargement. Kit Garamond gardé dans src/fonts/ pour revenir en arrière.

// Titres, nom et cachet : Plus Jakarta Sans, Regular et Medium.
export const fontDisplay = localFont({
  src: '../fonts/plus-jakarta-sans.woff2',
  weight: '400 500',
  style: 'normal',
  display: 'swap',
  adjustFontFallback: 'Arial',
  variable: '--font-display-face',
})

// Texte, libellés et navigation : Manrope, Regular à SemiBold.
export const fontText = localFont({
  src: '../fonts/manrope.woff2',
  weight: '400 600',
  style: 'normal',
  display: 'swap',
  adjustFontFallback: 'Arial',
  variable: '--font-text-face',
})
