import { Manrope } from 'next/font/google'
import localFont from 'next/font/local'

// Polices du site, auto-hébergées par next/font (aucune requête du navigateur vers Google).

export const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-manrope',
})

// Serif display PROVISOIRE (D22) : Newsreader instanciée en local, tailles optiques 32 à 72,
// Light et Regular (60 ko ; licence OFL dans src/fonts/OFL.txt). Recommandée par le directeur
// artistique ; 84 ko préchargés avec Manrope, pour un budget de 80 ko : à trancher par Sady.
export const newsreader = localFont({
  src: '../fonts/newsreader-display.woff2',
  weight: '300 400',
  style: 'normal',
  display: 'swap',
  variable: '--font-newsreader',
})
