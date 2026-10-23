import { getTranslations } from 'next-intl/server'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICE_PATHS, SERVICES } from '@/lib/services'
import { OuverturePortes } from '@/components/media/OuverturePortes'
import { ServicesVitrine } from './ServicesVitrine'
import p10d from '../../../public/media/accueil/P10-seuil-portes.jpg'
import p10m from '../../../public/media/accueil/P10-seuil-portes-m.jpg'
import p13m from '../../../public/media/accueil/P13-console-vase-m.jpg'
import p15m from '../../../public/media/accueil/P15-salon-m.jpg'
import p16m from '../../../public/media/accueil/P16-enfants-m.jpg'

// Accueil (maquette Figma D·01, retenu par Sady le 23/10/2026, D36 ; à valider par Cat) : une idée
// par section, beaucoup d'air, de grandes images, aucun texte sur l'image. Le titre validé par Cat
// et la phrase qui dit ce que fait la maison, face aux portes ; les trois services, chacun avec son
// image ; les territoires ; le contact sur pierre. Mobile (M·01) : le texte, puis l'image.

const SERVICE_IMAGES = { concierge: p13m, senior: p15m, children: p16m } as const

export async function HeroAccueil() {
  const home = await getTranslations('Home')
  return (
    <section aria-labelledby="accueil-titre" className="flex flex-col lg:h-seuil lg:flex-row">
      <div className="flex flex-col justify-center gap-32 px-margin py-48 lg:w-7/12 lg:py-0 lg:pr-96">
        <h1
          id="accueil-titre"
          className="animate-entree font-display text-display-xl text-balance text-sapin"
        >
          {home('title')}
        </h1>
        <p className="max-w-measure text-body-l">{home('intro')}</p>
      </div>
      <div className="relative aspect-portrait overflow-hidden bg-pierre lg:aspect-auto lg:w-5/12">
        <ResponsiveImage
          desktop={p10d}
          mobile={p10m}
          alt={home('imageAlt')}
          sizes="100vw"
          anchor="portes"
          priority
        />
        <OuverturePortes src="/media/accueil/V10-portes-intro.mp4" />
      </div>
    </section>
  )
}

export async function ServicesAccueil({ locale }: { locale: Locale }) {
  const t = await getTranslations('Home.services')
  const services = await getTranslations('Services')
  const alts = {
    concierge: t('alt.concierge'),
    senior: t('alt.senior'),
    children: t('alt.children'),
  }
  const image = (key: keyof typeof SERVICE_IMAGES, sizes: string) => (
    <ResponsiveImage
      desktop={SERVICE_IMAGES[key]}
      mobile={SERVICE_IMAGES[key]}
      alt={alts[key]}
      sizes={sizes}
    />
  )

  return (
    <section aria-labelledby="services-titre" className="conteneur py-section">
      <ServicesVitrine
        images={SERVICES.map((service) => image(service.key, '(min-width: 64rem) 34vw, 100vw'))}
      >
        <div className="flex flex-col gap-24">
          <p className="text-label text-encre uppercase">{t('label')}</p>
          <h2 id="services-titre" className="font-display text-title-h2 text-balance text-sapin">
            {t('title')}
          </h2>
        </div>
        <ol className="mt-64 flex flex-col gap-96 lg:mt-96 lg:gap-128">
          {SERVICES.map((service, index) => (
            <li
              key={service.id}
              id={service.anchor}
              data-vitrine={index}
              className="flex flex-col gap-16"
            >
              <div className="relative -mx-margin mb-16 aspect-portrait overflow-hidden bg-pierre lg:hidden">
                {image(service.key, '100vw')}
              </div>
              <p aria-hidden="true" className="text-label text-cypres">
                {service.number}
              </p>
              <h3 className="text-title-h3 text-sapin">{services(`${service.key}.name`)}</h3>
              <p className="max-w-measure">{t(`text.${service.key}`)}</p>
              <p>
                <TextLink href={localizedPath(SERVICE_PATHS[service.id], locale)}>
                  {services(`${service.key}.link`)}
                </TextLink>
              </p>
            </li>
          ))}
        </ol>
      </ServicesVitrine>
    </section>
  )
}

export async function TerritoiresAccueil({ locale }: { locale: Locale }) {
  const t = await getTranslations('Scenes.territories')
  return (
    <section aria-labelledby="territoires-titre" className="py-section">
      <div className="conteneur flex flex-col gap-24">
        <p className="text-label text-encre uppercase">{t('label')}</p>
        <h2
          id="territoires-titre"
          className="max-w-titre font-display text-display-l text-balance text-sapin"
        >
          {t('countries')}
        </h2>
        <p className="text-body-l">{t('title')}</p>
        <p>
          <TextLink href={localizedPath('/territoires', locale)}>{t('link')}</TextLink>
        </p>
      </div>
    </section>
  )
}

export async function ContactAccueil({ locale }: { locale: Locale }) {
  const t = await getTranslations('Scenes.contact')
  return (
    <section aria-labelledby="contact-titre" className="bg-pierre py-section">
      <div className="conteneur flex flex-col items-start gap-24">
        <p className="text-label text-encre uppercase">{t('label')}</p>
        <h2
          id="contact-titre"
          className="max-w-titre font-display text-title-h2 text-balance text-sapin"
        >
          {t('title')}
        </h2>
        <p className="max-w-measure">{t('reassurance')}</p>
        <TextLink href={localizedPath('/contact', locale)} onStone>
          {t('button')}
        </TextLink>
      </div>
    </section>
  )
}
