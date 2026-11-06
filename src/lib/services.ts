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
// Vidéos (D60) : le geste de chaque service, recadré en 4:5 sur son image (864 × 1080, 24 i/s, 8 s,
// deux passes, sans son) : V12 la main qui pose les fleurs sur la console, G3 la page qui tourne
// au salon, G4 le romarin posé dans le verre. Desktop seulement, jouées une fois.

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
  // Vidéo desktop ; absente en mobile et en mouvement réduit.
  video?: { mp4: string; webm: string }
}

export const SERVICE_MEDIA: Partial<Record<ServiceId, ServiceMedia>> = {
  conciergerie: {
    desktop: p13m,
    mobile: p13m,
    video: {
      mp4: '/media/services/V12-geste-console-m.mp4',
      webm: '/media/services/V12-geste-console-m.webm',
    },
  },
  'grand-age': {
    desktop: p15m,
    mobile: p15m,
    video: {
      mp4: '/media/services/G3-salon-page-m.mp4',
      webm: '/media/services/G3-salon-page-m.webm',
    },
  },
  enfants: {
    desktop: p16m,
    mobile: p16m,
    video: {
      mp4: '/media/services/G4-enfants-romarin-m.mp4',
      webm: '/media/services/G4-enfants-romarin-m.webm',
    },
  },
}

export const SERVICE_PATHS = {
  conciergerie: '/services/conciergerie',
  'grand-age': '/services/grand-age',
  enfants: '/services/enfants',
} as const
