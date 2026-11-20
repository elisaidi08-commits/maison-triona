import { ViewTransition } from 'react'
import { getTranslations } from 'next-intl/server'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { ChoiceList } from '@/components/ui/ChoiceList'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICE_PATHS, SERVICES } from '@/lib/services'
import { OuverturePortes } from '@/components/media/OuverturePortes'
import { AnchorFocus } from './AnchorFocus'
import { ContactBlock } from './ContactBlock'
import { Revelation } from './Revelation'
import p10d from '../../../public/media/accueil/P10-seuil-portes.jpg'
import p10m from '../../../public/media/accueil/P10-seuil-portes-m.jpg'
import p13m from '../../../public/media/accueil/P13-console-vase-m.jpg'
import p15m from '../../../public/media/accueil/P15-salon-m.jpg'
import p16m from '../../../public/media/accueil/P16-enfants-m.jpg'

// Accueil (maquette Figma D·01, retenu par Sady le 23/10/2026, D36 ; à valider par Cat) : une idée
// par section, beaucoup d'air, de grandes images, aucun texte sur l'image. Le titre validé par Cat
// et la phrase qui dit ce que fait la maison, face aux portes ; les trois services, chacun avec son
// image ; les territoires ; le contact sur aplat sapin (D64). Mobile (M·01) : le texte, puis l'image.
// Prototype MT-03 : P01 remet les quatre entrées par besoin sous la phrase (spec d'entrée,
// variante B) ; P02 partage l'image de la conciergerie avec sa page (passage de pièce, M20).
// Services : trois scènes alternées, image et texte, sur le modèle de la page Conciergerie ; elles
// remplacent la file de cartes M21 (D52), retirée par D64 (3).

const SERVICE_IMAGES = { concierge: p13m, senior: p15m, children: p16m } as const

export async function HeroAccueil({ locale }: { locale: Locale }) {
  const home = await getTranslations('Home')
  // Les trois services mènent directement à leur page (Sady, 06/11/2026 : un clic au lieu de
  // deux, sans repasser par la file de cartes) ; la demande particulière, au contact. Brouillons de
  // D26, en attente de Cat. Chaque choix retient son besoin pour le formulaire (`data-besoin`, D26).
  const choices = [
    ...SERVICES.map((service) => ({
      href: localizedPath(SERVICE_PATHS[service.id], locale),
      number: service.number,
      label: home(`choices.${service.key}.label`),
      category: home(`choices.${service.key}.category`),
      besoin: service.id,
      mesure: `entree:${service.id}`,
    })),
    {
      href: localizedPath('/contact', locale),
      label: home('choices.unsure.label'),
      note: home('choices.unsure.note'),
      besoin: 'indecis',
      mesure: 'entree:indecis',
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
      <div className="relative aspect-portrait overflow-hidden bg-sapin-20 lg:aspect-auto lg:w-5/12">
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

// Les trois services en scènes alternées (D64 (3)) : chaque scène, son image 4:5 (P13, P15, P16),
// son numéro, son nom en `title-h2`, sa phrase et le lien vers sa page. Rien ne bouge.
// - Desktop (≥ 1024) : grille de 12 colonnes, l'image sur 5 colonnes, le texte sur 5 autres, deux
//   colonnes d'air entre eux ; l'image à gauche pour la conciergerie et les enfants, à droite pour le
//   grand âge ; texte centré sur la hauteur de l'image.
// - Tablette et mobile : le texte, puis l'image en pleine largeur, jusqu'aux bords de l'écran (M·01).
// Le texte précède l'image dans le code : c'est l'ordre de lecture partout. La conciergerie garde le
// passage de pièce vers sa page (M20) : son image porte le nom partagé avec l'image de sa page, et son
// lien marque la navigation « vers-piece ».
export async function ServicesAccueil({ locale }: { locale: Locale }) {
  const t = await getTranslations('Home.services')
  const services = await getTranslations('Services')
  const alts = {
    concierge: t('alt.concierge'),
    senior: t('alt.senior'),
    children: t('alt.children'),
  }
  return (
    <section aria-labelledby="services-titre" className="conteneur py-section">
      <div className="flex flex-col gap-24">
        <p className="text-label text-encre uppercase">{t('label')}</p>
        <h2
          id="services-titre"
          className="max-w-titre font-display text-display-l text-balance text-sapin"
        >
          {t('title')}
        </h2>
      </div>
      <ol className="mt-64 flex flex-col gap-section lg:mt-96">
        {SERVICES.map((service, index) => {
          // Deux colonnes dès 768 px (revue DA du point ③) : en 834, l'image 4:5 en pleine largeur
          // dépassait la hauteur de l'écran (environ 1 040 px).
          const imageADroite = index % 2 === 1
          const versPiece = service.key === 'concierge' ? ['vers-piece'] : undefined
          const image = (
            <ResponsiveImage
              desktop={SERVICE_IMAGES[service.key]}
              mobile={SERVICE_IMAGES[service.key]}
              alt={alts[service.key]}
              sizes="(min-width: 48rem) 45vw, 100vw"
            />
          )
          return (
            <li
              key={service.id}
              id={service.anchor}
              className="grid grid-cols-1 gap-y-32 md:grid-cols-12 md:items-center md:gap-x-gutter"
            >
              <div
                className={`flex flex-col items-start gap-16 md:row-start-1 md:col-span-6 lg:col-span-5 ${
                  imageADroite ? 'md:col-start-1' : 'md:col-start-7 lg:col-start-8'
                }`}
              >
                <p aria-hidden="true" className="text-label text-sapin">
                  {service.number}
                </p>
                <h3
                  id={`${service.anchor}-titre`}
                  tabIndex={-1}
                  className="font-display text-title-h2 text-balance text-sapin"
                >
                  {services(`${service.key}.name`)}
                </h3>
                <p className="max-w-measure">{t(`text.${service.key}`)}</p>
                <TextLink
                  href={localizedPath(SERVICE_PATHS[service.id], locale)}
                  transitionTypes={versPiece}
                >
                  {services(`${service.key}.link`)}
                </TextLink>
              </div>
              <div
                className={`relative -mx-margin aspect-portrait overflow-hidden bg-sapin-20 md:row-start-1 md:mx-0 md:col-span-6 lg:col-span-5 ${
                  imageADroite ? 'md:col-start-7 lg:col-start-8' : 'md:col-start-1'
                }`}
              >
                {versPiece ? (
                  // P02 : l'image de la conciergerie porte le même nom que l'image de sa page.
                  <ViewTransition
                    name="piece-conciergerie"
                    share={{ 'vers-piece': 'piece', default: 'none' }}
                    default="none"
                  >
                    <div className="absolute inset-0">{image}</div>
                  </ViewTransition>
                ) : (
                  image
                )}
              </div>
            </li>
          )
        })}
      </ol>
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

// Bloc Contact de fin d'accueil (D64 (4), DA §7.5) : le même que sur les autres pages, aplat sapin,
// label champagne, titre ivoire, réassurance en ivoire 80 %, bouton « Nous écrire » à bordure or.
export async function ContactAccueil({ locale }: { locale: Locale }) {
  return <ContactBlock locale={locale} />
}
