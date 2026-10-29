import type { StaticImageData } from 'next/image'
import p13m from '../../public/media/accueil/P13-console-vase-m.jpg'

// Les 3 services (docs/ux-entry-i18n-a11y.md) : identifiant neutre (`?service=`), ancre sur
// l'accueil, page dédiée, visuels. Les médias du grand âge et des enfants arrivent avec le lot 2.
// Prototype MT-03 (P02) : la conciergerie montre la même console que l'accueil (P13, 4:5), pour
// que l'image passe d'une page à l'autre ; P03 et sa boucle V03 (jugée défectueuse) sont retirées
// de la page, les fichiers restent.

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
  conciergerie: {
    desktop: p13m,
    mobile: p13m,
  },
}

export const SERVICE_PATHS = {
  conciergerie: '/services/conciergerie',
  'grand-age': '/services/grand-age',
  enfants: '/services/enfants',
} as const
