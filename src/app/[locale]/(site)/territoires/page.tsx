import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { CarteTerritoires } from '@/components/sections/CarteTerritoires'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import type { CodePays } from '@/lib/carte-territoires'
import { LIEUX, type CleLieu } from '@/lib/lieux-territoires'
import { SERVICE_PATHS, SERVICES } from '@/lib/services'

// Territoires (story 2.7, PRD §7 ; D56) : la carte d'Europe reste à l'écran pendant qu'on lit les
// cinq pays (M24) : chacun dit pourquoi la maison y est, la carte s'approche de lui et montre les
// lieux qu'il cite. Puis ce que la maison fait, partout : les trois services, et le contact. Une page
// par pays seulement en phase 2, avec un contenu local réel (docs/seo-strategy.md §E). Aucun texte
// nouveau : textes des pays (brouillons de Cat), titre et phrase de l'accueil, promesses des services.

type Country = { name: string; text: string }

// Codes des pays, dans l'ordre des messages (Territories.countries).
const CODES: CodePays[] = ['BE', 'FR', 'LU', 'MC', 'CH']

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Pages')
  return { title: t('territories') }
}

export default async function TerritoriesPage() {
  const locale = (await rootParams.locale()) as Locale
  const pages = await getTranslations('Pages')
  const t = await getTranslations('Territories')
  const home = await getTranslations('Home')
  const services = await getTranslations('Services')
  const scenes = await getTranslations('Scenes')
  const countries = t.raw('countries') as Country[]
  const lieux = Object.fromEntries(LIEUX.map(({ cle }) => [cle, t(`places.${cle}`)])) as Record<
    CleLieu,
    string
  >

  return (
    <article className="flex flex-col">
      <header className="conteneur flex flex-col gap-24 pt-section pb-48">
        <Rule short />
        <h1 tabIndex={-1} className="font-display text-display-l text-sapin">
          {pages('territories')}
        </h1>
        <p className="text-label text-encre uppercase">{t('intro')}</p>
      </header>

      <div className="conteneur pb-section">
        <CarteTerritoires
          pays={countries.map(({ name }, index) => ({ code: CODES[index]!, nom: name }))}
          lieux={lieux}
        >
          {countries.map(({ name, text }, index) => {
            const code = CODES[index]!
            return (
              <section
                key={code}
                id={`territoire-${code.toLowerCase()}`}
                data-territoire={code}
                aria-labelledby={`territoire-${code.toLowerCase()}-titre`}
                className="flex flex-col justify-center gap-16 border-t border-or py-48"
              >
                <p aria-hidden="true" className="text-label text-encre">
                  {`0${index + 1}`}
                </p>
                <h2
                  id={`territoire-${code.toLowerCase()}-titre`}
                  className="font-display text-title-h2 text-sapin"
                >
                  {name}
                </h2>
                <p className="max-w-measure text-body-l">{text}</p>
              </section>
            )
          })}
        </CarteTerritoires>
      </div>

      <section
        aria-labelledby="territoires-services"
        className="conteneur flex flex-col gap-24 pb-section"
      >
        <Rule short />
        <p className="text-label text-encre uppercase">{home('services.label')}</p>
        <h2
          id="territoires-services"
          className="font-display text-title-h2 text-balance text-sapin"
        >
          {home('services.title')}
        </h2>
        <p className="max-w-measure text-body-l">{home('intro')}</p>
        <ul className="mt-24 grid gap-48 md:grid-cols-3">
          {SERVICES.map((service) => (
            <li key={service.id} className="flex flex-col gap-12 border-t border-or pt-24">
              <h3 className="text-title-h3 text-sapin">{services(`${service.key}.name`)}</h3>
              <p>{services(`${service.key}.promise`)}</p>
              <p>
                <TextLink href={localizedPath(SERVICE_PATHS[service.id], locale)}>
                  {services(`${service.key}.link`)}
                </TextLink>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-24">
          <TextLink href={localizedPath('/contact', locale)}>{scenes('contact.button')}</TextLink>
        </p>
      </section>
    </article>
  )
}
