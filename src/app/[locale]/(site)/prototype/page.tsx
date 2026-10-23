import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'
import {
  ContactCalme,
  HeroCalme,
  ServicesCalmes,
  TerritoiresCalmes,
} from '@/components/prototype/AccueilCalme'
import type { Locale } from '@/i18n/pathnames'

// Prototype V5 de l'accueil, retour à la maquette Figma D·01 (demande de Sady, 22/10/2026) :
// minimaliste, calme, de grandes images, et tout de suite ce que propose la maison (seule variante
// gardée, D34). À côté de l'accueil actuel ; rien ne
// change sur /fr tant que Sady puis Cat ne l'ont pas validé. Comme le banc d'essai /demo : jamais
// indexé, absent de la production, du plan du site et de la navigation. Médias de prévisualisation
// dans public/media/prototype/, non validés par Cat.

export const metadata: Metadata = {
  title: 'Prototype · Maison Triona',
  robots: { index: false, follow: false },
}

export default async function Prototype() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const locale = (await rootParams.locale()) as Locale
  return (
    <>
      <HeroCalme />
      <ServicesCalmes locale={locale} />
      <TerritoiresCalmes locale={locale} />
      <ContactCalme locale={locale} />
    </>
  )
}
