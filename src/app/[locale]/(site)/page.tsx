import * as rootParams from 'next/root-params'
import { Seuil } from '@/components/sections/Seuil'

// Accueil : premier écran « Seuil plein écran » (D19). Les scènes suivent en stories 2.2 et 2.3.

export default async function Home() {
  const locale = await rootParams.locale()
  return <Seuil locale={locale} />
}
