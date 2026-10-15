import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { MiniMenu } from '@/components/layout/MiniMenu'
import { ContactBlock, SceneMaison, SceneTerritoires } from '@/components/sections/HomeScenes'
import { SceneService } from '@/components/sections/SceneService'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { ScrubVideo } from '@/components/media/ScrubVideo'
import { Seuil } from '@/components/sections/Seuil'
import { SeuilPassage } from '@/components/sections/SeuilPassage'
import p01d from '../../../../public/media/seuil/P01-fenetre-mer.jpg'
import p01m from '../../../../public/media/seuil/P01-fenetre-mer-m.jpg'
import { SERVICES } from '@/lib/services'

// Accueil, dans l'ordre du storyboard : S1 Seuil (D19) et son passage « on entre » (M15), puis,
// sous le mini-menu collant (desktop, §7.9), S2 La maison, S3 à S5 les 3 services (destinations
// des choix 1 à 3, médias alternés), S6 Territoires. Le mini-menu se détache avant S7 Contact
// (destination du choix 4) : jamais trois « Contact » sur le même écran.

export default async function Home() {
  const locale = await rootParams.locale()
  const menu = await getTranslations('MiniMenu')
  const items = [
    ...SERVICES.map((service) => ({
      href: `#${service.anchor}`,
      anchor: service.anchor,
      label: menu(service.key),
    })),
    { href: `/${locale}/contact`, label: menu('contact') },
  ]

  return (
    <>
      <Seuil locale={locale} />
      <SeuilPassage>
        <ResponsiveImage desktop={p01d} mobile={p01m} alt="" />
        <ScrubVideo src="/media/seuil/V01-s-fenetre-mer-scrub.mp4" trackId="seuil-passage" />
      </SeuilPassage>
      <div>
        <MiniMenu label={menu('label')} items={items} />
        <SceneMaison locale={locale} />
        {SERVICES.map((service, index) => (
          <SceneService
            key={service.id}
            service={service}
            locale={locale}
            mediaRight={index % 2 === 1}
          />
        ))}
        <SceneTerritoires locale={locale} />
      </div>
      <ContactBlock locale={locale} />
    </>
  )
}
