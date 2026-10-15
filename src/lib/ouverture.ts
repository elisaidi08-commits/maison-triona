import type { StaticImageData } from 'next/image'
import p01d from '../../public/media/seuil/P01-fenetre-mer.jpg'
import p01m from '../../public/media/seuil/P01-fenetre-mer-m.jpg'
import p02d from '../../public/media/maison/P02-porte-ocre.jpg'
import p02m from '../../public/media/maison/P02-porte-ocre-m.jpg'
import p03d from '../../public/media/conciergerie/P03-bateau-quai.jpg'
import p03m from '../../public/media/conciergerie/P03-bateau-quai-m.jpg'

// Film d'ouverture de l'accueil (D25) : la maison, puis chaque service tour à tour, puis l'entrée.
// Desktop : un seul fichier monté par scripts/montage-ouverture.sh (4 s par plan, fondu d'1 s :
// le plan i commence à i × 3 s), dans l'ordre de ce tableau. Mobile et mouvement réduit : les mêmes
// plans en photos (version portrait), sans vidéo.
// Provisoire tant que le lot 2 n'est pas intégré : grand âge, enfants et territoires viendront avec
// V04, V06 et V07.

export const PLAN_SECONDS = 3

export type Caption = 'brand' | 'concierge' | 'senior' | 'children' | 'territories' | 'tagline'

type Plan = { caption: Caption; desktop: StaticImageData; mobile: StaticImageData }

export const OUVERTURE_PLANS: Plan[] = [
  { caption: 'brand', desktop: p01d, mobile: p01m },
  { caption: 'concierge', desktop: p03d, mobile: p03m },
  { caption: 'tagline', desktop: p02d, mobile: p02m },
  { caption: 'brand', desktop: p01d, mobile: p01m },
]

export const OUVERTURE_VIDEO = {
  mp4: '/media/ouverture/ouverture.mp4',
  webm: '/media/ouverture/ouverture.webm',
}
