import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { ContactBlock } from '@/components/sections/ContactBlock'
import { Modele, RangeeConfidentialite } from '@/components/sections/Fonctionnement'
import { ServicesImmersion, type PlanService } from '@/components/sections/ServicesImmersion'
import { Rule } from '@/components/ui/Rule'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICES, SERVICE_MEDIA, SERVICE_PATHS } from '@/lib/services'

// Page Services (stories 2.13 puis 2.14, docs/art-direction.md §7.3) : la vue d'ensemble, qui
// donne envie d'entrer dans chaque service ; le détail (situations, déroulé, ce qu'il faut savoir)
// est sur les pages de service.
// 1. l'en-tête : trois services, une seule interlocutrice (Cat, D40) ;
// 2. les trois services en une scène immersive (M23, D56 : images dévoilées par bandes, texte sur
//    aplat sapin, vignettes sur la jointure), empilés hors desktop avec souris ;
// 3. le modèle en trois temps, puis la confidentialité ;
// 4. le bloc Contact.
// Aucun tarif, aucune carte, aucune icône.

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Pages')
  return { title: t('services') }
}

export default async function Page() {
  const locale = (await rootParams.locale()) as Locale
  const pages = await getTranslations('Pages')
  const t = await getTranslations('Services')
  const index = await getTranslations('ServicesIndex')
  const video = await getTranslations('Video')

  const plans: PlanService[] = SERVICES.flatMap((service) => {
    const media = SERVICE_MEDIA[service.id]
    if (!media) return []
    return [
      {
        anchor: service.anchor,
        number: service.number,
        name: t(`${service.key}.name`),
        promise: t(`${service.key}.promise`),
        need: t(`${service.key}.need`),
        link: t(`${service.key}.link`),
        href: localizedPath(SERVICE_PATHS[service.id], locale),
        image: media.mobile,
        alt: t(`${service.key}.imageAlt`),
        video: media.video,
      },
    ]
  })

  return (
    <>
      <header className="conteneur flex flex-col gap-24 pt-section">
        <Rule short />
        <p className="text-label text-encre uppercase">{pages('services')}</p>
        <h1 className="max-w-titre font-display text-display-l text-balance text-sapin">
          {index('title')}
        </h1>
        <p className="max-w-measure text-body-l">{index('intro')}</p>
      </header>

      <ServicesImmersion
        plans={plans}
        thumbnailsLabel={index('thumbnails')}
        pause={{ visible: video('pauseShort'), full: video('pause') }}
        play={{ visible: video('playShort'), full: video('play') }}
      />

      <div className="conteneur">
        <Modele />
        <div className="pb-section">
          <RangeeConfidentialite locale={locale} />
        </div>
      </div>

      <ContactBlock locale={locale} />
    </>
  )
}
