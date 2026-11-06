import * as rootParams from 'next/root-params'
import {
  ContactAccueil,
  HeroAccueil,
  ServicesAccueil,
  TerritoiresAccueil,
} from '@/components/sections/Accueil'
import type { Locale } from '@/i18n/pathnames'

// Accueil en quatre sections (maquette Figma D·01, D36) : le titre et ce que fait la maison face
// aux portes, les trois services, les territoires, le contact. Il remplace l'accueil en neuf
// séquences de D26 ; le contact reste accessible à tout moment (navigation, barre mobile).

export default async function Home() {
  const locale = (await rootParams.locale()) as Locale
  return (
    <>
      <HeroAccueil locale={locale} />
      <ServicesAccueil locale={locale} />
      <TerritoiresAccueil locale={locale} />
      <ContactAccueil locale={locale} />
    </>
  )
}
