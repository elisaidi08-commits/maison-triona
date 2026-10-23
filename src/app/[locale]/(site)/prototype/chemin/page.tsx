import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'
import {
  ContactCalme,
  FilmEntreeAccueil,
  HeroCalme,
  ServicesCalmes,
  TerritoiresCalmes,
} from '@/components/prototype/AccueilCalme'
import type { Locale } from '@/i18n/pathnames'

// Prototype V5, variante « le chemin » (D31, 23/10/2026) : l'accueil calme de /prototype, précédé
// en desktop du film d'entrée (les trois services, puis la maison, dont les portes rejoignent leur
// place dans l'accueil), avec le menu plein écran à aplats dans l'en-tête (`data-entete-menu`).
// Gardée pour comparaison depuis que Sady a demandé de revenir à l'accueil calme seul. Comme le
// banc d'essai /demo : jamais indexé, absent de la production, du plan du site et de la
// navigation. Médias de prévisualisation dans public/media/prototype/, non validés par Cat.

export const metadata: Metadata = {
  title: 'Prototype, le chemin · Maison Triona',
  robots: { index: false, follow: false },
}

export default async function PrototypeChemin() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const locale = (await rootParams.locale()) as Locale
  return (
    <>
      <span data-entete-menu hidden />
      <FilmEntreeAccueil />
      <HeroCalme />
      <ServicesCalmes locale={locale} />
      <TerritoiresCalmes locale={locale} />
      <ContactCalme locale={locale} />
    </>
  )
}
