import * as rootParams from 'next/root-params'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { ScrubVideo } from '@/components/media/ScrubVideo'
import {
  ContactBlock,
  SceneMaison,
  ScenePromise,
  SceneTerritoires,
} from '@/components/sections/HomeScenes'
import { SceneService } from '@/components/sections/SceneService'
import { Seuil } from '@/components/sections/Seuil'
import { SeuilPassage } from '@/components/sections/SeuilPassage'
import type { Locale } from '@/i18n/pathnames'
import { SERVICES } from '@/lib/services'
import p01d from '../../../../public/media/seuil/P01-fenetre-mer.jpg'
import p01m from '../../../../public/media/seuil/P01-fenetre-mer-m.jpg'

// Accueil en neuf séquences (refonte V3, D26) : 01 le seuil, le nom de la maison sur la vidéo et
// l'entrée par besoin ; 02 le passage V01-s lié au défilement (desktop seulement, M15) ; 03 la
// promesse ; 04 à 06 les trois services, destinations des choix 1 à 3, médias alternés ; 07 La
// Maison ; 08 Territoires ; 09 Contact, destination du choix 4. Une idée par séquence ; le contact
// reste accessible à tout moment (navigation, barre mobile).

export default async function Home() {
  const locale = (await rootParams.locale()) as Locale
  return (
    <>
      <Seuil locale={locale} />
      <SeuilPassage>
        <ResponsiveImage desktop={p01d} mobile={p01m} alt="" />
        <ScrubVideo src="/media/seuil/V01-s-fenetre-mer-scrub.mp4" trackId="seuil-passage" />
      </SeuilPassage>
      <ScenePromise />
      {SERVICES.map((service, index) => (
        <SceneService
          key={service.id}
          service={service}
          locale={locale}
          mediaRight={index % 2 === 1}
          pageLink
        />
      ))}
      <SceneMaison locale={locale} />
      <SceneTerritoires locale={locale} />
      <ContactBlock locale={locale} />
    </>
  )
}
