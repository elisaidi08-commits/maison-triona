import * as rootParams from 'next/root-params'
import {
  ContactBlock,
  HowItWorks,
  SceneMaison,
  SceneTerritoires,
} from '@/components/sections/HomeScenes'
import { Ouverture } from '@/components/sections/Ouverture'
import { ServicesTriptyque } from '@/components/sections/ServicesTriptyque'
import { Seuil } from '@/components/sections/Seuil'
import type { Locale } from '@/i18n/pathnames'

// Accueil (D25, « la marque d'abord ») : l'ouverture filmée, une fois par visite, puis le nom de la
// maison sur la vidéo plein écran et l'entrée par besoin, les trois services côte à côte (destinations
// des choix 1 à 3), la maison, comment ça se passe, les territoires et le contact (choix 4).

export default async function Home() {
  const locale = (await rootParams.locale()) as Locale
  return (
    <>
      <Ouverture />
      <Seuil locale={locale} />
      <ServicesTriptyque locale={locale} />
      <SceneMaison locale={locale} />
      <HowItWorks />
      <SceneTerritoires locale={locale} />
      <ContactBlock locale={locale} />
    </>
  )
}
