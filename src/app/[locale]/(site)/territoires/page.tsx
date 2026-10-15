import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Rule } from '@/components/ui/Rule'

// Territoires (story 2.7, PRD §7) : les cinq pays, évoqués avec élégance. Une page par pays
// seulement en phase 2, avec un contenu local réel (docs/seo-strategy.md §E). Le visuel P07 (lot 2)
// prendra place entre l'en-tête et les pays ; d'ici là, aucun aplat vide.

type Country = { name: string; text: string }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Pages')
  return { title: t('territories') }
}

export default async function TerritoriesPage() {
  const pages = await getTranslations('Pages')
  const t = await getTranslations('Territories')
  const countries = t.raw('countries') as Country[]
  return (
    <article className="flex flex-col">
      <header className="conteneur flex flex-col gap-24 py-section">
        <Rule short />
        <h1 className="font-display text-display-l text-sapin">{pages('territories')}</h1>
        <p className="text-label text-encre uppercase">{t('intro')}</p>
      </header>
      <ul className="conteneur grid gap-48 pb-section md:grid-cols-2">
        {countries.map(({ name, text }) => (
          <li key={name} className="flex flex-col gap-12 border-t border-or pt-24">
            <h2 className="font-display text-title-h2 text-sapin">{name}</h2>
            <p>{text}</p>
          </li>
        ))}
      </ul>
    </article>
  )
}
