import { getTranslations } from 'next-intl/server'
import { ViewTransition } from 'react'
import { LoopVideo } from '@/components/media/LoopVideo'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath } from '@/i18n/pathnames'
import type { Locale } from '@/i18n/routing'
import { SERVICE_MEDIA, SERVICE_PATHS, type Service } from '@/lib/services'

// Scène de service, structure identique × 3 (docs/art-direction.md §7.8, refonte V3 D26). Desktop :
// média à hauteur d'écran, collant pendant que le texte défile, côté alterné d'une scène à l'autre ;
// la vidéo du service y joue en boucle (desktop seulement, bouton pause posé sur l'image). La scène
// se lit en deux temps : la promesse face à l'image, puis, un intervalle de section plus bas, trois
// situations, une phrase sur le fonctionnement, une réassurance et le CTA. Le texte garde la marge
// de page côté extérieur. L'image est la version portrait (Pxx-m), faite pour une demi-largeur.
// Sans visuel, aucune colonne vide : la promesse et les détails se répondent sur deux colonnes.
// En mobile, le texte vient d'abord : après un choix d'entrée, le visiteur arrive sur la promesse,
// pas sur l'image (parcours « choisir → service → contacter ») ; l'image suit son texte de près,
// l'air de section la sépare de la scène suivante.
// Aucun tarif, aucune liste de prestataires, aucune promesse médicale.
// Prototype MT-03 (P02, passage de pièce) : sur la conciergerie, l'image porte le même nom que
// l'image collante de l'accueil ; elle s'y déplace sur un lien « vers-piece », jamais au retour.

type SceneServiceProps = {
  service: Service
  locale: Locale
  heading?: 'h1' | 'h2'
  mediaRight?: boolean
  // Sur l'accueil : lien vers la page du service, sous le CTA.
  pageLink?: boolean
}

export async function SceneService({
  service,
  locale,
  heading = 'h2',
  mediaRight = false,
  pageLink = false,
}: SceneServiceProps) {
  const t = await getTranslations('Services')
  const video = await getTranslations('Video')
  const situations = t.raw(`${service.key}.situations`) as string[]
  const image = SERVICE_MEDIA[service.id]
  const Heading = heading
  const titleId = `${service.anchor}-titre`

  const intro = (
    <div className="flex flex-col gap-16">
      <Rule short />
      <p className="text-label text-encre uppercase">
        <span aria-hidden="true" className="text-cypres">
          {service.number}
        </span>
        <span aria-hidden="true"> · </span>
        {t(`${service.key}.name`)}
      </p>
      <Heading
        id={titleId}
        tabIndex={-1}
        className="font-display text-display-l text-balance text-sapin"
      >
        {t(`${service.key}.promise`)}
      </Heading>
    </div>
  )

  // Réassurance : pour le grand âge, la précision « une présence, pas des soins » ; sinon le modèle
  // de la maison (des personnes qu'elle connaît personnellement).
  const details = (
    <>
      <div className="flex flex-col gap-16">
        <h3 className="text-label text-encre uppercase">{t('situationsLabel')}</h3>
        <ul className="flex flex-col">
          {situations.map((situation) => (
            <li key={situation} className="border-b border-sapin-20 py-12 first:border-t">
              {situation}
            </li>
          ))}
        </ul>
      </div>

      <p>{t('process')}</p>
      <p>{service.key === 'senior' ? t('senior.precision') : t('model')}</p>

      <div className="flex flex-col items-start gap-8">
        <TextLink href={`/${locale}/contact?service=${service.id}`}>{t('cta')}</TextLink>
        {pageLink ? (
          <TextLink href={localizedPath(SERVICE_PATHS[service.id], locale)}>
            {t(`${service.key}.link`)}
          </TextLink>
        ) : null}
      </div>
    </>
  )

  if (!image) {
    return (
      <section
        id={service.anchor}
        aria-labelledby={titleId}
        className="px-margin py-section lg:grid lg:grid-cols-12 lg:gap-gutter"
      >
        <div className="max-w-measure lg:col-span-5">{intro}</div>
        <div className="mt-48 flex max-w-measure flex-col gap-48 lg:col-span-6 lg:col-start-7 lg:mt-0">
          {details}
        </div>
      </section>
    )
  }

  return (
    <section
      id={service.anchor}
      aria-labelledby={titleId}
      className="flex flex-col lg:grid lg:grid-cols-12"
    >
      <div
        className={`relative order-last aspect-portrait overflow-hidden lg:sticky lg:top-mini-menu lg:col-span-6 lg:h-scene lg:self-start lg:aspect-auto ${
          mediaRight ? 'lg:order-last' : 'lg:order-first'
        }`}
      >
        {service.id === 'conciergerie' ? (
          <ViewTransition
            name="piece-conciergerie"
            share={{ 'vers-piece': 'piece', default: 'none' }}
            default="none"
          >
            <div className="absolute inset-0">
              <ResponsiveImage
                desktop={image.mobile}
                mobile={image.mobile}
                alt={t(`${service.key}.imageAlt`)}
                sizes="(min-width: 64rem) 50vw, 100vw"
              />
            </div>
          </ViewTransition>
        ) : (
          <ResponsiveImage
            desktop={image.mobile}
            mobile={image.mobile}
            alt={t(`${service.key}.imageAlt`)}
            sizes="(min-width: 64rem) 50vw, 100vw"
          />
        )}
        {image.video ? (
          <LoopVideo
            mp4={image.video.mp4}
            webm={image.video.webm}
            pause={{ visible: video('pauseShort'), full: video('pause') }}
            play={{ visible: video('playShort'), full: video('play') }}
          />
        ) : null}
      </div>

      <div
        className={`flex flex-col px-margin pt-section pb-48 lg:col-span-6 lg:py-0 ${
          mediaRight ? 'lg:pr-64' : 'lg:pl-64'
        }`}
      >
        <div className="flex max-w-measure flex-col justify-end lg:min-h-scene-intro">{intro}</div>
        <div className="mt-48 flex max-w-measure flex-col gap-48 lg:mt-section lg:pb-section">
          {details}
        </div>
      </div>
    </section>
  )
}
