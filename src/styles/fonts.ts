import { Manrope, Newsreader } from 'next/font/google'

// Polices du site, auto-hébergées par next/font (aucune requête du navigateur vers Google).
// Deux fichiers préchargés au plus (docs/design-tokens.md §3.1).

export const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-manrope',
})

// Serif display PROVISOIRE : Newsreader (recommandée) tant que le banc d'essai n'a pas tranché.
// Light et Regular sans l'axe de taille optique : 56 ko, contre 128 ko avec l'axe `opsz`
// (budget : 80 ko pour les deux fichiers préchargés, Manrope compris).
export const newsreader = Newsreader({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-newsreader',
})
