import type { StaticImageData } from 'next/image'
import { getTranslations } from 'next-intl/server'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICE_PATHS, SERVICES, type ServiceId } from '@/lib/services'
import p13d from '../../../public/media/prototype/P13-console.jpg'
import p04m from '../../../public/media/prototype/P04-mains-livre-m.jpg'
import p06d from '../../../public/media/prototype/P06-mains-romarin.jpg'
import p06m from '../../../public/media/prototype/P06-mains-romarin-m.jpg'

// Prototype V5, les services : les trois univers en composition asymétrique (tailles, formats et
// côtés différents), puis « Une demande particulière » ; ce sont les destinations des quatre
// entrées de l'invitation. Desktop, grille de 12 colonnes : la conciergerie en grand (7 colonnes,
// 16:9), le grand âge en portrait (4 colonnes, 4:5), les enfants en paysage (6 colonnes), chaque
// texte face à son image. En mobile, le texte d'abord (après un choix, on arrive sur la promesse),
// puis l'image. Images fixes : le mouvement de la page est porté par le franchissement et le geste.
// Aucun tarif, aucune liste de prestataires, aucune promesse médicale.

type Layout = {
  desktop: StaticImageData
  mobile: StaticImageData
  alt: 'conciergeAlt' | 'seniorAlt' | 'childrenAlt'
  // Colonnes desktop de l'image et du texte ; format de l'image par largeur.
  media: string
  text: string
  frame: string
  sizes: string
}

const LAYOUTS: Record<ServiceId, Layout> = {
  conciergerie: {
    desktop: p13d,
    mobile: p13d,
    alt: 'conciergeAlt',
    media: 'lg:col-span-7 lg:col-start-1',
    text: 'lg:col-span-4 lg:col-start-9 lg:self-center',
    frame: 'aspect-hero',
    sizes: '(min-width: 64rem) 58vw, 100vw',
  },
  'grand-age': {
    desktop: p04m,
    mobile: p04m,
    alt: 'seniorAlt',
    media: 'lg:col-span-4 lg:col-start-8',
    text: 'lg:col-span-5 lg:col-start-2 lg:self-end',
    frame: 'aspect-portrait',
    sizes: '(min-width: 64rem) 33vw, 100vw',
  },
  enfants: {
    desktop: p06d,
    mobile: p06m,
    alt: 'childrenAlt',
    media: 'lg:col-span-6 lg:col-start-2',
    text: 'lg:col-span-4 lg:col-start-9 lg:self-start',
    frame: 'aspect-portrait lg:aspect-hero',
    sizes: '(min-width: 64rem) 50vw, 100vw',
  },
}

export async function ServicesComposition({ locale }: { locale: Locale }) {
  const t = await getTranslations('Services')
  const p = await getTranslations('Prototype')
  const home = await getTranslations('Home')

  return (
    <div className="flex flex-col gap-section py-section">
      {SERVICES.map((service) => {
        const layout = LAYOUTS[service.id]
        const situations = t.raw(`${service.key}.situations`) as string[]
        const titleId = `${service.anchor}-titre`
        return (
          <section
            key={service.id}
            id={service.anchor}
            aria-labelledby={titleId}
            className="conteneur grid gap-32 lg:grid-cols-12 lg:gap-gutter"
          >
            <div className={`flex max-w-measure flex-col gap-24 lg:row-start-1 ${layout.text}`}>
              <div className="flex flex-col gap-16">
                <Rule short />
                <p className="text-label text-encre uppercase">
                  <span aria-hidden="true" className="text-cypres">
                    {service.number}
                  </span>
                  <span aria-hidden="true"> · </span>
                  {t(`${service.key}.name`)}
                </p>
                <h2
                  id={titleId}
                  tabIndex={-1}
                  className="font-display text-title-h2 text-balance text-sapin"
                >
                  {t(`${service.key}.promise`)}
                </h2>
              </div>
              <ul className="flex flex-col">
                {situations.map((situation) => (
                  <li key={situation} className="border-b border-sapin-20 py-12 first:border-t">
                    {situation}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col items-start gap-8">
                <TextLink href={`/${locale}/contact?service=${service.id}`}>{t('cta')}</TextLink>
                <TextLink href={localizedPath(SERVICE_PATHS[service.id], locale)}>
                  {t(`${service.key}.link`)}
                </TextLink>
              </div>
            </div>
            <div
              className={`relative overflow-hidden bg-sapin lg:row-start-1 ${layout.frame} ${layout.media}`}
            >
              <ResponsiveImage
                desktop={layout.desktop}
                mobile={layout.mobile}
                alt={p(layout.alt)}
                sizes={layout.sizes}
              />
            </div>
          </section>
        )
      })}

      <section
        id="demande-particuliere"
        aria-labelledby="demande-particuliere-titre"
        className="conteneur grid lg:grid-cols-12 lg:gap-gutter"
      >
        <div className="flex max-w-measure flex-col gap-16 lg:col-span-6 lg:col-start-4">
          <Rule short />
          <h2
            id="demande-particuliere-titre"
            tabIndex={-1}
            className="font-display text-title-h2 text-sapin"
          >
            {p('particular.title')}
          </h2>
          <p className="text-body-l text-encre">{home('choices.unsure.note')}</p>
          <p>
            <TextLink href={`/${locale}/contact`}>{p('particular.cta')}</TextLink>
          </p>
        </div>
      </section>
    </div>
  )
}
