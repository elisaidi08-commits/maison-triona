import type { StaticImageData } from 'next/image'
import p03d from '../../public/media/conciergerie/P03-bateau-quai.jpg'
import p03m from '../../public/media/conciergerie/P03-bateau-quai-m.jpg'

// Les 3 services (docs/ux-entry-i18n-a11y.md) : identifiant neutre (`?service=`), ancre de la scène
// sur l'accueil, page dédiée, visuel. Grand âge et enfants attendent le lot 2 (aplat en attendant).

export const SERVICES = [
  { id: 'conciergerie', key: 'concierge', anchor: 'conciergerie', number: '01' },
  { id: 'grand-age', key: 'senior', anchor: 'grand-age', number: '02' },
  { id: 'enfants', key: 'children', anchor: 'enfants', number: '03' },
] as const

export type Service = (typeof SERVICES)[number]
export type ServiceId = Service['id']

export const SERVICE_IMAGES: Partial<
  Record<ServiceId, { desktop: StaticImageData; mobile: StaticImageData }>
> = {
  conciergerie: { desktop: p03d, mobile: p03m },
}

export const SERVICE_PATHS = {
  conciergerie: '/services/conciergerie',
  'grand-age': '/services/grand-age',
  enfants: '/services/enfants',
} as const
