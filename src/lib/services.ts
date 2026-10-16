import type { StaticImageData } from 'next/image'
import p03d from '../../public/media/conciergerie/P03-bateau-quai.jpg'
import p03m from '../../public/media/conciergerie/P03-bateau-quai-m.jpg'

// Les 3 services (docs/ux-entry-i18n-a11y.md) : identifiant neutre (`?service=`), ancre sur
// l'accueil, page dédiée, visuels. Les médias du grand âge et des enfants arrivent avec le lot 2.

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
    desktop: p03d,
    mobile: p03m,
    video: {
      mp4: '/media/conciergerie/V03-bateau-quai.mp4',
      webm: '/media/conciergerie/V03-bateau-quai.webm',
    },
  },
}

export const SERVICE_PATHS = {
  conciergerie: '/services/conciergerie',
  'grand-age': '/services/grand-age',
  enfants: '/services/enfants',
} as const
