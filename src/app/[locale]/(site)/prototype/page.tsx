import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'
import { FilmEntree } from '@/components/prototype/FilmEntree'
import { SceneTrust } from '@/components/prototype/PrototypeScenes'
import { ContactBlock, ScenePromise, SceneTerritoires } from '@/components/sections/HomeScenes'
import type { Locale } from '@/i18n/pathnames'

// Prototype V5 de l'accueil : le film d'entrée (référence de Sady, 22/10/2026) ouvre la page, une
// pièce par service, puis la promesse, la confiance, les territoires, le contact. À côté de
// l'accueil actuel, pour les comparer ; rien ne change sur /fr tant que Sady puis Cat ne l'ont pas
// validé. Comme le banc d'essai /demo : jamais indexé, absent de la production, du plan du site et
// de la navigation. Médias de prévisualisation dans public/media/prototype/, non validés par Cat.

export const metadata: Metadata = {
  title: 'Prototype · Maison Triona',
  robots: { index: false, follow: false },
}

export default async function Prototype() {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const locale = (await rootParams.locale()) as Locale
  return (
    <>
      <FilmEntree locale={locale} />
      <ScenePromise />
      <SceneTrust />
      <SceneTerritoires locale={locale} />
      <ContactBlock locale={locale} />
    </>
  )
}
