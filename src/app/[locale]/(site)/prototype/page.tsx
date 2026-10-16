import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { ScrubVideo } from '@/components/media/ScrubVideo'
import { HeroThreshold } from '@/components/prototype/HeroThreshold'
import { SceneAttention, SceneTrust } from '@/components/prototype/PrototypeScenes'
import { ServicesComposition } from '@/components/prototype/ServicesComposition'
import { ThresholdScrub } from '@/components/prototype/ThresholdScrub'
import { ContactBlock, SceneTerritoires } from '@/components/sections/HomeScenes'
import type { Locale } from '@/i18n/pathnames'
import p10d from '../../../../../public/media/prototype/P10-seuil-portes.jpg'

// Prototype V5 de l'accueil (concept A+B « Le Seuil + Les Gestes Invisibles ») : invitation,
// franchissement, attention, services, confiance, contact. À côté de l'accueil actuel, pour les
// comparer ; rien ne change sur /fr tant que Sady ne l'a pas validé. Comme le banc d'essai /demo :
// jamais indexé, absent de la production, du plan du site et de la navigation. Médias de
// prévisualisation dans public/media/prototype/, non validés par Cat.

// Franchissement : le plan accélère (le mur glisse, puis on passe la porte) ; cette courbe donne plus
// de défilement à la fin. `node scripts/scrub-timeline.mjs
// public/media/prototype/V10-V11-franchissement-scrub.mp4` (33 points, part linéaire 0,35).
const FRANCHISSEMENT = [
  0, 0.054, 0.105, 0.153, 0.202, 0.251, 0.298, 0.341, 0.385, 0.43, 0.472, 0.511, 0.548, 0.585,
  0.621, 0.654, 0.683, 0.71, 0.736, 0.76, 0.784, 0.806, 0.828, 0.848, 0.866, 0.882, 0.897, 0.912,
  0.927, 0.944, 0.964, 0.982, 1,
] as const

export const metadata: Metadata = {
  title: 'Prototype · Maison Triona',
  robots: { index: false, follow: false },
}

export default async function Prototype() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const locale = (await rootParams.locale()) as Locale
  return (
    <>
      <HeroThreshold />
      <ThresholdScrub>
        <ResponsiveImage desktop={p10d} mobile={p10d} alt="" />
        <ScrubVideo
          src="/media/prototype/V10-V11-franchissement-scrub.mp4"
          trackId="franchissement"
          timeline={FRANCHISSEMENT}
        />
      </ThresholdScrub>
      <SceneAttention />
      <ServicesComposition locale={locale} />
      <SceneTrust />
      <SceneTerritoires locale={locale} />
      <ContactBlock locale={locale} />
    </>
  )
}
