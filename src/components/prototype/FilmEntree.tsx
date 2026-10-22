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
import { GesturePlay } from './GesturePlay'
import { ParallaxForeground } from './ParallaxForeground'
import p04d from '../../../public/media/prototype/P04-mains-livre.jpg'
import p04m from '../../../public/media/prototype/P04-mains-livre-m.jpg'
import p06d from '../../../public/media/prototype/P06-mains-romarin.jpg'
import p06m from '../../../public/media/prototype/P06-mains-romarin-m.jpg'
import p10d from '../../../public/media/prototype/P10-seuil-portes.jpg'
import p10m from '../../../public/media/prototype/P10-seuil-portes-m.jpg'
import p13d from '../../../public/media/prototype/P13-console.jpg'
import p13m from '../../../public/media/prototype/P13-console-m.jpg'
import curtain from '../../../public/media/prototype/P14-voilage.webp'
import gestureEnd from '../../../public/media/prototype/V12-geste-fin.jpg'

// Prototype V5, le film d'entrée (référence de Sady : un film qui fait entrer dans la maison, une
// pièce par service). Desktop : chaque chapitre garde son image collée sur un écran pendant que sa
// légende, sur un aplat sapin, défile puis reste en place ; le chapitre suivant glisse par-dessus.
// L'ouverture : P10, le titre sur le mur sombre, la barre des choix ; les portes s'ouvrent seules
// trois secondes après le chargement, puis suivent le défilement. Les pièces : le geste d'accueil
// (lu quand on y arrive), le salon, la table, puis la demande particulière. Aucun texte courant sur
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

type Room = {
  // Légende à gauche ou à droite de l'image, selon le sujet de la pièce.
  side: 'start' | 'end'
  // Format en mobile (l'image suit son cadre ; plein écran en desktop).
  frame: string
  media: ReactNode
}

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
    <section id={id} aria-labelledby={titleId} className="grid lg:h-chapitre">
      <div
        className={`relative overflow-hidden bg-sapin ${room.frame} lg:pile lg:sticky lg:top-0 lg:h-svh lg:self-start lg:aspect-auto`}
      >
        {room.media}
      </div>
      <div
        data-surface="sapin"
        className={`flex flex-col gap-24 px-margin py-48 lg:pile lg:sticky lg:top-96 lg:mt-96 lg:max-w-panneau lg:self-start lg:p-48 ${
          room.side === 'end'
            ? 'lg:mr-margin lg:justify-self-end'
            : 'lg:ml-margin lg:justify-self-start'
        }`}
      >
        {children}
      </div>
    </section>
  )
}

export async function FilmEntree({ locale }: { locale: Locale }) {
  const t = await getTranslations('Prototype')
  const home = await getTranslations('Home')
  const services = await getTranslations('Services')
  const video = await getTranslations('Video')
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
      media: (
        <GesturePlay
          fill
          src="/media/prototype/V12-geste.mp4"
          poster="/media/prototype/V12-geste-debut.jpg"
          pause={{ visible: video('pauseShort'), full: video('pause') }}
          play={{ visible: video('playShort'), full: video('play') }}
          replay={{ visible: t('replayShort'), full: t('replay') }}
        >
          <ResponsiveImage desktop={gestureEnd} mobile={gestureEnd} alt={t('gestureAlt')} />
        </GesturePlay>
      ),
    },
    'grand-age': {
      side: 'end',
      frame: 'aspect-portrait',
      media: <ResponsiveImage desktop={p04d} mobile={p04m} alt={t('seniorAlt')} />,
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
          <ScrubVideo src="/media/prototype/V10-portes-scrub.mp4" trackId="ouverture" intro={3} />
          <ParallaxForeground trackId="ouverture" curtain={curtain} />
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
        return (
          <Chapter key={service.id} id={service.anchor} titleId={titleId} room={rooms[service.id]}>
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
            <div className="flex flex-col items-start gap-16">
              <Button href={`/${locale}/contact?service=${service.id}`}>{services('cta')}</Button>
              <TextLink onDark href={localizedPath(SERVICE_PATHS[service.id], locale)}>
                {services(`${service.key}.link`)}
              </TextLink>
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
