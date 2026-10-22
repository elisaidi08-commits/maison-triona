import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { ScrubVideo } from '@/components/media/ScrubVideo'
import { AnchorFocus } from '@/components/sections/AnchorFocus'
import { Button } from '@/components/ui/Button'
import { ChoiceList } from '@/components/ui/ChoiceList'
import { Rule } from '@/components/ui/Rule'
import { Stamp } from '@/components/ui/Stamp'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICE_PATHS, SERVICES, type Service } from '@/lib/services'
import { FilmProgress } from './FilmProgress'
import { Apparition } from './Apparition'
import { ParallaxForeground } from './ParallaxForeground'
import { RaccordFilm } from './RaccordFilm'
import p06d from '../../../public/media/prototype/P06-mains-romarin.jpg'
import p06m from '../../../public/media/prototype/P06-mains-romarin-m.jpg'
import p10d from '../../../public/media/prototype/P10-seuil-portes.jpg'
import p10m from '../../../public/media/prototype/P10-seuil-portes-m.jpg'
import p13d from '../../../public/media/prototype/P13-console.jpg'
import p13m from '../../../public/media/prototype/P13-console-m.jpg'
import p15m from '../../../public/media/prototype/P15-salon-m.jpg'
import salonEnd from '../../../public/media/prototype/salon-fin.jpg'
import curtain from '../../../public/media/prototype/P14-voilage.webp'
import gestureEnd from '../../../public/media/prototype/V12-geste-fin.jpg'

// Prototype V5, le film d'entrée (référence de Sady : un film qui fait entrer dans la maison, une
// pièce par service). Desktop : chaque chapitre garde son image collée sur un écran pendant que sa
// légende, sur un aplat sapin, défile puis reste en place ; le chapitre suivant glisse par-dessus.
// L'ouverture : P10, le titre sur le mur sombre, la barre des choix ; les portes s'ouvrent seules
// trois secondes après le chargement, puis suivent le défilement, et la caméra glisse jusqu'à la
// console (plan de liaison) : la pièce de la conciergerie s'enchaîne sans coupure. Les pièces : le geste d'accueil
// (il suit le défilement), le salon, la table, puis la demande particulière. Aucun texte courant sur
// l'image (aplats). Mobile, mouvement réduit, économie de données, sans JavaScript : la même suite
// en images fixes, chaque légende sous son image. Les quatre choix mènent à leur chapitre. En
// desktop, « Faites défiler pour entrer », un filet or qui suit la progression du film, et un
// voilage au premier plan qui s'écarte en défilant (parallaxe par calques).

const CHOICES = [
  { key: 'concierge', href: '#conciergerie', number: '01' },
  { key: 'senior', href: '#grand-age', number: '02' },
  { key: 'children', href: '#enfants', number: '03' },
  { key: 'unsure', href: '#demande-particuliere', number: undefined },
] as const

// Ouverture (section 2, plan de liaison) : les portes s'ouvrent (8 s), puis la caméra quitte les
// portes et glisse jusqu'à la console où commence le geste (8 s, plus rapide) ; la courbe donne plus
// de défilement à la liaison. `node scripts/scrub-timeline.mjs
// media-incoming/lot3/proto/ouverture-master-1080p.mp4` (33 points, part linéaire 0,35).
const OUVERTURE = [
  0, 0.051, 0.1, 0.146, 0.193, 0.242, 0.289, 0.331, 0.374, 0.417, 0.459, 0.501, 0.548, 0.58, 0.605,
  0.629, 0.655, 0.674, 0.691, 0.708, 0.724, 0.743, 0.762, 0.781, 0.8, 0.818, 0.836, 0.853, 0.87,
  0.891, 0.917, 0.953, 1,
] as const

// Conciergerie (section 3) : le geste (8 s), puis la liaison vers le salon (8 s, plus rapide).
// `node scripts/scrub-timeline.mjs media-incoming/lot4-openart/salon/conciergerie-master.mp4`.
const CONCIERGERIE = [
  0, 0.028, 0.056, 0.084, 0.112, 0.14, 0.17, 0.203, 0.236, 0.269, 0.302, 0.335, 0.366, 0.391, 0.413,
  0.436, 0.468, 0.509, 0.553, 0.598, 0.637, 0.663, 0.684, 0.702, 0.721, 0.739, 0.759, 0.781, 0.808,
  0.837, 0.873, 0.925, 1,
] as const

type Room = {
  // Légende à gauche ou à droite de l'image, selon le sujet de la pièce.
  side: 'start' | 'end'
  // Format en mobile (l'image suit son cadre ; plein écran en desktop).
  frame: string
  media: ReactNode
  // Hauteur desktop du chapitre, si la pièce demande plus de défilement (geste lié au défilement).
  height?: string
  // Légende légère (choix de Sady, section 2) : la promesse, une phrase et le bouton seulement.
  sentence?: string
  // Raccord sans couture avec la fin de l'ouverture (RaccordFilm).
  seamless?: boolean
  // Hauteur desktop pendant laquelle la légende reste en place, si elle doit partir avant la fin
  // du chapitre (pendant le plan de liaison vers la pièce suivante).
  captionSpan?: string
}

// Image d'une pièce : collée sur un écran en desktop, dans la même case que sa légende.
const backdrop =
  'relative overflow-hidden bg-sapin lg:pile lg:sticky lg:top-0 lg:h-svh lg:self-start lg:aspect-auto'

// Pièce d'un chapitre : l'image (collée en desktop), puis sa légende sur aplat sapin.
function Chapter({
  id,
  titleId,
  room,
  children,
}: {
  id: string
  titleId: string
  room: Room
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={`grid ${room.height ?? 'lg:h-chapitre'} ${room.seamless ? 'lg:raccord-film' : ''}`}
    >
      {room.seamless ? (
        <RaccordFilm sectionId={id} className={`${backdrop} ${room.frame}`}>
          {room.media}
        </RaccordFilm>
      ) : (
        <div className={`${backdrop} ${room.frame}`}>{room.media}</div>
      )}
      <div
        className={`lg:pile ${room.captionSpan ? `lg:self-start ${room.captionSpan}` : 'lg:self-stretch'}`}
      >
        <div
          data-surface="sapin"
          className={`px-margin py-48 lg:sticky lg:top-96 lg:mt-96 lg:max-w-panneau lg:p-48 ${
            room.side === 'end' ? 'lg:mr-margin lg:ml-auto' : 'lg:ml-margin'
          }`}
        >
          <Apparition className="flex flex-col gap-24">{children}</Apparition>
        </div>
      </div>
    </section>
  )
}

export async function FilmEntree({ locale }: { locale: Locale }) {
  const t = await getTranslations('Prototype')
  const home = await getTranslations('Home')
  const services = await getTranslations('Services')
  const choices = CHOICES.map(({ key, href, number }) => ({
    href,
    number,
    label: home(`choices.${key}.label`),
    category: key === 'unsure' ? undefined : home(`choices.${key}.category`),
    note: key === 'unsure' ? home('choices.unsure.note') : undefined,
  }))
  // Une phrase par ligne (« Une maison. » / « Mille attentions. »), sans coupure au milieu.
  const lines = t('title').split(/(?<=\.)\s+/)

  const rooms: Record<Service['id'], Room> = {
    conciergerie: {
      side: 'start',
      frame: 'aspect-hero',
      // Le geste suit le défilement (choix de Sady, section 2) : la main pose le bouquet pendant
      // que la légende reste en place ; la dernière image tient lieu de vidéo en version fixe.
      // Puis la caméra quitte la console pour le salon (plan de liaison, section 3).
      height: 'lg:h-chapitre-liaison',
      captionSpan: 'lg:h-chapitre',
      seamless: true,
      sentence: t('rooms.concierge'),
      media: (
        <>
          <ResponsiveImage desktop={gestureEnd} mobile={gestureEnd} alt={t('gestureAlt')} />
          <ScrubVideo
            src="/media/prototype/conciergerie-scrub.mp4"
            trackId="conciergerie"
            timeline={CONCIERGERIE}
          />
        </>
      ),
    },
    // Le salon (choix de Sady, section 3) : la main tourne une page au rythme du défilement ; le
    // côté droit reste calme pour la légende, qui garde la précision « une présence, pas des soins ».
    'grand-age': {
      side: 'end',
      frame: 'aspect-portrait',
      height: 'lg:h-chapitre-geste',
      seamless: true,
      sentence: services('senior.precision'),
      media: (
        <>
          <ResponsiveImage desktop={salonEnd} mobile={p15m} alt={t('seniorAlt')} />
          <ScrubVideo src="/media/prototype/salon-scrub.mp4" trackId="grand-age" />
        </>
      ),
    },
    enfants: {
      side: 'start',
      frame: 'aspect-portrait',
      media: <ResponsiveImage desktop={p06d} mobile={p06m} alt={t('childrenAlt')} />,
    },
  }

  return (
    <div id="film" className="relative">
      <FilmProgress trackId="film" />
      <section id="ouverture" aria-labelledby="seuil-titre" className="grid lg:h-ouverture">
        <div className="relative pile h-invitation-image self-start overflow-hidden bg-sapin lg:sticky lg:top-0 lg:h-svh">
          <ResponsiveImage desktop={p10d} mobile={p10m} alt={t('imageAlt')} priority />
          <ScrubVideo
            src="/media/prototype/ouverture-scrub.mp4"
            trackId="ouverture"
            intro={3}
            timeline={OUVERTURE}
          />
          <ParallaxForeground trackId="ouverture" curtain={curtain} until={0.2} />
        </div>
        <div className="relative pile flex flex-col self-start lg:h-seuil">
          {/* Positionnée pour passer au-dessus de l'image collée. Le voile (mesuré par langue,
              tokens.css) ne couvre que la zone du titre. */}
          <div
            className={`relative flex h-invitation-image flex-col justify-center gap-24 px-margin lg:h-auto lg:flex-1 ${
              locale === 'fr' ? 'bg-voile lg:bg-voile-portes-fr' : 'bg-voile lg:bg-voile-portes'
            }`}
          >
            <h1
              id="seuil-titre"
              tabIndex={-1}
              className="animate-entree titre-seuil self-start font-display text-display-xl text-ivoire"
            >
              {lines.map((line, index) => (
                <span key={line} className="block">
                  {index > 0 ? ' ' : null}
                  {line}
                </span>
              ))}
            </h1>
            <Stamp onDark />
          </div>
          <div className="surface-sapin-desktop bg-ivoire px-margin pt-24 pb-24 lg:bg-sapin lg:pt-32">
            <div className="mb-16 flex flex-col gap-8 lg:mb-24 lg:flex-row lg:items-end lg:justify-between lg:gap-48">
              <div className="flex max-w-titre flex-col gap-8">
                <p className="text-body text-balance text-encre lg:text-ivoire-80">{t('metier')}</p>
                <h2 className="text-title-h3 text-sapin lg:text-ivoire">{t('question')}</h2>
              </div>
              {/* L'invitation de la référence : le film avance avec le défilement (desktop). */}
              <p className="hidden shrink-0 text-label text-ivoire-80 uppercase lg:block">
                {t('scrollHint')}
              </p>
            </div>
            <ChoiceList choices={choices} rowOnDesktop darkOnDesktop />
            <AnchorFocus />
          </div>
        </div>
      </section>

      {SERVICES.map((service) => {
        const situations = services.raw(`${service.key}.situations`) as string[]
        const titleId = `${service.anchor}-titre`
        const room = rooms[service.id]
        return (
          <Chapter key={service.id} id={service.anchor} titleId={titleId} room={room}>
            <div className="flex flex-col gap-16">
              <Rule short />
              <p className="text-label text-champagne uppercase">
                <span aria-hidden="true">{service.number}</span>
                <span aria-hidden="true"> · </span>
                {services(`${service.key}.name`)}
              </p>
              <h2
                id={titleId}
                tabIndex={-1}
                className="font-display text-title-h2 text-balance text-ivoire"
              >
                {services(`${service.key}.promise`)}
              </h2>
            </div>
            {room.sentence ? (
              <p className="text-body-l text-ivoire-80">{room.sentence}</p>
            ) : (
              <ul className="flex flex-col">
                {situations.map((situation) => (
                  <li
                    key={situation}
                    className="border-b border-sauge py-12 text-ivoire-80 first:border-t"
                  >
                    {situation}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col items-start gap-16">
              <Button href={`/${locale}/contact?service=${service.id}`}>{services('cta')}</Button>
              {room.sentence ? null : (
                <TextLink onDark href={localizedPath(SERVICE_PATHS[service.id], locale)}>
                  {services(`${service.key}.link`)}
                </TextLink>
              )}
            </div>
          </Chapter>
        )
      })}

      <Chapter
        id="demande-particuliere"
        titleId="demande-particuliere-titre"
        room={{
          side: 'end',
          frame: 'aspect-portrait',
          media: <ResponsiveImage desktop={p13d} mobile={p13m} alt={t('conciergeAlt')} />,
        }}
      >
        <div className="flex flex-col gap-16">
          <Rule short />
          <h2
            id="demande-particuliere-titre"
            tabIndex={-1}
            className="font-display text-title-h2 text-balance text-ivoire"
          >
            {t('particular.title')}
          </h2>
        </div>
        <p className="text-body-l text-ivoire-80">{home('choices.unsure.note')}</p>
        <div>
          <Button href={`/${locale}/contact`}>{t('particular.cta')}</Button>
        </div>
      </Chapter>
    </div>
  )
}
