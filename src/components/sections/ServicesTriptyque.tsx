import { getTranslations } from 'next-intl/server'
import { LoopVideo } from '@/components/media/LoopVideo'
import { PauseVideosButton } from '@/components/media/PauseVideosButton'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICE_MEDIA, SERVICE_PATHS, SERVICES } from '@/lib/services'

// « Nos services » (D25) : les trois services côte à côte, chacun dans sa fenêtre (boucle vidéo en
// desktop, photo portrait en mobile), puis son nom, sa promesse et le lien vers sa page. Destinations
// des choix 1 à 3 du premier écran (#conciergerie…, focus sur le titre, M12). Les trois vidéos jouent
// ensemble, calmes ; un seul bouton les met en pause (WCAG 2.2.2). Texte toujours sur l'ivoire.

export async function ServicesTriptyque({ locale }: { locale: Locale }) {
  const t = await getTranslations('Services')
  const video = await getTranslations('Video')
  const pause = { visible: video('pauseShort'), full: video('pause') }
  const play = { visible: video('playShort'), full: video('play') }
  const hasVideo = SERVICES.some((service) => SERVICE_MEDIA[service.id]?.video)

  return (
    <section aria-labelledby="services-titre" className="py-section">
      <div className="mb-48 flex items-end justify-between gap-24 px-margin">
        <div className="flex flex-col gap-16">
          <Rule short />
          <h2 id="services-titre" className="font-display text-display-l text-sapin">
            {t('title')}
          </h2>
        </div>
        {hasVideo ? <PauseVideosButton pause={pause} play={play} /> : null}
      </div>
      <div className="grid gap-64 px-margin lg:grid-cols-3 lg:gap-gutter">
        {SERVICES.map((service) => {
          const media = SERVICE_MEDIA[service.id]
          const titleId = `${service.anchor}-titre`
          return (
            <article
              key={service.id}
              id={service.anchor}
              aria-labelledby={titleId}
              className="flex flex-col gap-24"
            >
              {media ? (
                <div className="relative aspect-portrait overflow-hidden bg-sapin">
                  <ResponsiveImage
                    desktop={media.mobile}
                    mobile={media.mobile}
                    alt={t(`${service.key}.imageAlt`)}
                    sizes="(min-width: 64rem) 33vw, 100vw"
                  />
                  {media.video ? (
                    <LoopVideo
                      mp4={media.video.mp4}
                      webm={media.video.webm}
                      pause={pause}
                      play={play}
                      controls="none"
                    />
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-col gap-12">
                <p className="text-label text-encre uppercase">
                  <span aria-hidden="true" className="text-cypres">
                    {service.number}
                  </span>
                  <span aria-hidden="true"> · </span>
                  {t(`${service.key}.name`)}
                </p>
                <h3
                  id={titleId}
                  tabIndex={-1}
                  className="font-display text-title-h2 text-balance text-sapin"
                >
                  {t(`${service.key}.promise`)}
                </h3>
                <p>
                  <TextLink href={localizedPath(SERVICE_PATHS[service.id], locale)}>
                    {t(`${service.key}.link`)}
                  </TextLink>
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
