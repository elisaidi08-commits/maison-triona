import { Cormorant_Garamond, Instrument_Serif, Newsreader } from 'next/font/google'
import localFont from 'next/font/local'

// Candidates du banc d'essai (docs/art-direction.md §5.1), chargées seulement sur /demo.
// Satoshi (statu quo Figma) n'est pas testée : sans-serif, et sa licence FFL exige que Cat
// accepte elle-même la licence avant tout usage (docs/design-tokens.md §3.1).

export const benchNewsreader = Newsreader({
  subsets: ['latin'],
  weight: 'variable',
  axes: ['opsz'],
  style: ['normal', 'italic'],
  display: 'swap',
  preload: false,
})

// Newsreader instanciée en local (fontTools, licence OFL sans Reserved Font Name) :
// tailles optiques 32 à 72, graisses 300 à 400, romain, sous-ensemble latin. 60 ko.
// Recette : docs/design-tokens.md §3.1.
export const benchNewsreaderDisplay = localFont({
  src: '../../fonts/newsreader-display.woff2',
  weight: '300 400',
  style: 'normal',
  display: 'swap',
  preload: false,
})

export const benchNewsreaderStatic = Newsreader({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  display: 'swap',
  preload: false,
})

export const benchCormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400'],
  style: ['normal', 'italic'],
  display: 'swap',
  preload: false,
})

export const benchInstrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  preload: false,
})
