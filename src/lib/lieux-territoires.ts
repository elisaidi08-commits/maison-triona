import type { CodePays } from './carte-territoires'

// Lieux cités par les textes des pays (Territories.countries, brouillons à valider par Cat) :
// placés sur la carte quand leur pays est lu (D56). Rien de plus que ce que les textes disent ;
// aucune adresse. Coordonnées des centres-villes, en degrés ; la Côte d'Azur est posée à Cannes,
// à l'écart du repère de Monaco. `cote` : côté du nom par rapport au point.

export type CleLieu = 'brussels' | 'paris' | 'riviera' | 'geneva' | 'lausanne'

export const LIEUX: {
  cle: CleLieu
  pays: CodePays
  lon: number
  lat: number
  cote: 'gauche' | 'droite'
}[] = [
  { cle: 'brussels', pays: 'BE', lon: 4.3517, lat: 50.8503, cote: 'gauche' },
  { cle: 'paris', pays: 'FR', lon: 2.3522, lat: 48.8566, cote: 'gauche' },
  { cle: 'riviera', pays: 'FR', lon: 7.0174, lat: 43.5528, cote: 'gauche' },
  { cle: 'geneva', pays: 'CH', lon: 6.1432, lat: 46.2044, cote: 'gauche' },
  { cle: 'lausanne', pays: 'CH', lon: 6.6323, lat: 46.5197, cote: 'droite' },
]
