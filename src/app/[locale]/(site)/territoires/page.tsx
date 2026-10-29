import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { GlobeTerritoires } from '@/components/sections/GlobeTerritoires'
import { Rule } from '@/components/ui/Rule'
import type { CodePaysGlobe } from '@/lib/globe-territoires'

// Territoires (story 2.7, PRD §7) : les cinq pays, évoqués avec élégance. Une page par pays
// seulement en phase 2, avec un contenu local réel (docs/seo-strategy.md §E). Entre l'en-tête et les
// pays, le globe en points (M23, D55), à la place prévue pour le visuel P07.

type Country = { name: string; text: string }

// Codes des pays, dans l'ordre des messages (Territories.countries).
const CODES: CodePaysGlobe[] = ['BE', 'FR', 'LU', 'MC', 'CH']

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
        <h1 tabIndex={-1} className="font-display text-display-l text-sapin">
          {pages('territories')}
        </h1>
        <p className="text-label text-encre uppercase">{t('intro')}</p>
      </header>
      <div className="conteneur pb-section">
        <GlobeTerritoires
          indication={t('globeHint')}
          legende={t('globeLabel')}
          ensemble={t('globeAll')}
          pays={countries.map(({ name }, index) => ({ code: CODES[index]!, nom: name }))}
        />
      </div>
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
