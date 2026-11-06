import type { StaticImageData } from 'next/image'
import p13m from '../../public/media/accueil/P13-console-vase-m.jpg'
import p15m from '../../public/media/accueil/P15-salon-m.jpg'
import p16m from '../../public/media/accueil/P16-enfants-m.jpg'

// Les 3 services (docs/ux-entry-i18n-a11y.md) : identifiant neutre (`?service=`), ancre sur
// l'accueil, page dédiée, visuels.
// Story 2.14 : les trois services ont leur image, les 4:5 de l'accueil calme du prototype (D30,
// D36 ; retenues par Sady, à valider par Cat une par une, D44) : la console aux clés et au bouquet
// pour la conciergerie (choix de Cat, D44, à la place du bateau P03), le salon pour le grand âge,
// le romarin pour les enfants. P03 et sa boucle V03 ne sont plus affichées ; les fichiers restent.

export const SERVICES = [
  { id: 'conciergerie', key: 'concierge', anchor: 'conciergerie', number: '01' },
  { id: 'grand-age', key: 'senior', anchor: 'grand-age', number: '02' },
  { id: 'enfants', key: 'children', anchor: 'enfants', number: '03' },
] as const

export type Service = (typeof SERVICES)[number]
export type ServiceId = Service['id']

export type ServiceMedia = {
  desktop: StaticImageData
  mobile: StaticImageData
  // Boucle desktop (1280 × 720) ; absente en mobile et en mouvement réduit.
  video?: { mp4: string; webm: string }
}

export const SERVICE_MEDIA: Partial<Record<ServiceId, ServiceMedia>> = {
  conciergerie: { desktop: p13m, mobile: p13m },
  'grand-age': { desktop: p15m, mobile: p15m },
  enfants: { desktop: p16m, mobile: p16m },
}

export const SERVICE_PATHS = {
  conciergerie: '/services/conciergerie',
  'grand-age': '/services/grand-age',
  enfants: '/services/enfants',
} as const
