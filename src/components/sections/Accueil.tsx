import { getTranslations } from 'next-intl/server'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { ChoiceList } from '@/components/ui/ChoiceList'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICE_PATHS, SERVICES } from '@/lib/services'
import { OuverturePortes } from '@/components/media/OuverturePortes'
import { AnchorFocus } from './AnchorFocus'
import { Revelation } from './Revelation'
import { ServicesZoom } from './ServicesZoom'
import p10d from '../../../public/media/accueil/P10-seuil-portes.jpg'
import p10m from '../../../public/media/accueil/P10-seuil-portes-m.jpg'
import p13m from '../../../public/media/accueil/P13-console-vase-m.jpg'
import p15m from '../../../public/media/accueil/P15-salon-m.jpg'
import p16m from '../../../public/media/accueil/P16-enfants-m.jpg'

// Accueil (maquette Figma D·01, retenu par Sady le 23/10/2026, D36 ; à valider par Cat) : une idée
// par section, beaucoup d'air, de grandes images, aucun texte sur l'image. Le titre validé par Cat
// et la phrase qui dit ce que fait la maison, face aux portes ; les trois services, chacun avec son
// image ; les territoires ; le contact sur pierre. Mobile (M·01) : le texte, puis l'image.
// Prototype MT-03 : P01 remet les quatre entrées par besoin sous la phrase (spec d'entrée,
// variante B) ; P02 partage l'image de la conciergerie avec sa page (passage de pièce, M20) ;
// les services avancent en file de cartes qui grandissent (M21, D52, idée du « Zoom Slider »).

const SERVICE_IMAGES = { concierge: p13m, senior: p15m, children: p16m } as const

export async function HeroAccueil({ locale }: { locale: Locale }) {
  const home = await getTranslations('Home')
  // Les trois services mènent à leur pièce sur l'accueil (le focus suit, M12) ; la demande
  // particulière, au contact. Brouillons de D26, en attente de Cat.
  const choices = [
    ...SERVICES.map((service) => ({
      href: `#${service.anchor}`,
      number: service.number,
      label: home(`choices.${service.key}.label`),
      category: home(`choices.${service.key}.category`),
    })),
    {
      href: localizedPath('/contact', locale),
      label: home('choices.unsure.label'),
      note: home('choices.unsure.note'),
    },
  ]
  return (
    <section aria-labelledby="accueil-titre" className="flex flex-col lg:min-h-seuil lg:flex-row">
      <AnchorFocus />
      <div className="flex flex-col justify-center gap-32 px-margin py-48 lg:w-7/12 lg:pr-96">
        <h1
          id="accueil-titre"
          tabIndex={-1}
          className="animate-entree font-display text-display-xl text-balance text-sapin"
        >
          {home('title')}
        </h1>
        <p className="max-w-measure text-body-l">{home('intro')}</p>
        <div className="max-w-measure">
          <ChoiceList choices={choices} />
        </div>
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
  // M21 : les services en file de cartes qui avancent et grandissent avec le défilement en desktop,
  // empilés ailleurs (ServicesZoom). Les copies de la boucle réutilisent les mêmes images.
  return (
    <section aria-labelledby="services-titre" className="conteneur py-section">
      <ServicesZoom
        label={t('label')}
        title={t('title')}
        services={SERVICES.map((service) => ({
          key: service.key,
          anchor: service.anchor,
          number: service.number,
          name: services(`${service.key}.name`),
          text: t(`text.${service.key}`),
          link: services(`${service.key}.link`),
          href: localizedPath(SERVICE_PATHS[service.id], locale),
          image: (
            <ResponsiveImage
              desktop={SERVICE_IMAGES[service.key]}
              mobile={SERVICE_IMAGES[service.key]}
              alt={alts[service.key]}
              sizes="(min-width: 64rem) 50vw, 100vw"
            />
          ),
        }))}
      />
    </section>
  )
}

export async function TerritoiresAccueil({ locale }: { locale: Locale }) {
  const t = await getTranslations('Scenes.territories')
  return (
    <section aria-labelledby="territoires-titre" className="py-section">
      <div className="conteneur flex flex-col gap-24">
        {/* M3 à l'essai sur cette seule section (D37) : le label et les pays apparaissent. */}
        <Revelation>
          <p className="text-label text-encre uppercase">{t('label')}</p>
          <h2
            id="territoires-titre"
            className="max-w-titre font-display text-display-l text-balance text-sapin"
          >
            {t('countries')}
          </h2>
        </Revelation>
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
