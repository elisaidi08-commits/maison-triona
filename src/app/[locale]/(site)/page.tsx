import * as rootParams from 'next/root-params'
import { ContactBlock, SceneMaison, SceneTerritoires } from '@/components/sections/HomeScenes'
import { SceneService } from '@/components/sections/SceneService'
import { Seuil } from '@/components/sections/Seuil'
import { SERVICES } from '@/lib/services'

// Accueil, dans l'ordre du storyboard : S1 Seuil (D19), S2 La maison, S3 à S5 les 3 services
// (destinations des choix 1 à 3), S6 Territoires, S7 Contact (destination du choix 4).

export default async function Home() {
  const locale = await rootParams.locale()
  return (
    <>
      <Seuil locale={locale} />
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
      <ContactBlock locale={locale} />
    </>
  )
}
