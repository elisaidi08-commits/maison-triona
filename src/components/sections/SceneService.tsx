import { getTranslations } from 'next-intl/server'
import { MediaPlaceholder } from '@/components/media/MediaPlaceholder'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { SERVICE_IMAGES, type Service } from '@/lib/services'

// Scène de service, structure identique × 3 (docs/art-direction.md §7.8) : média plein cadre,
// texte sur aplat ivoire à côté. Nom du service en label, promesse en titre display, 3 points de
// réassurance, 3 étapes, la phrase du modèle, un seul CTA vers le contact prérempli.
// Aucun tarif, aucune liste de prestataires, aucune promesse médicale.

type SceneServiceProps = {
  service: Service
  locale: string
  heading?: 'h1' | 'h2'
  mediaRight?: boolean
}

export async function SceneService({
  service,
  locale,
  heading = 'h2',
  mediaRight = false,
}: SceneServiceProps) {
  const t = await getTranslations('Services')
  const reassurance = t.raw('reassurance') as string[]
  const steps = t.raw('steps') as string[]
  const image = SERVICE_IMAGES[service.id]
  const Heading = heading
  const titleId = `${service.anchor}-titre`

  return (
    <section
      id={service.anchor}
      aria-labelledby={titleId}
      className="flex flex-col lg:grid lg:min-h-svh lg:grid-cols-12"
    >
      <div
        className={`relative aspect-portrait lg:col-span-7 lg:aspect-auto ${mediaRight ? 'lg:order-2' : ''}`}
      >
        {image ? (
          <ResponsiveImage
            desktop={image.desktop}
            mobile={image.mobile}
            alt={t(`${service.key}.imageAlt`)}
            sizes="(min-width: 64rem) 58vw, 100vw"
          />
        ) : (
          <MediaPlaceholder />
        )}
      </div>

      <div className="flex flex-col justify-center gap-48 px-margin py-section lg:col-span-5">
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

        <ul className="flex flex-col">
          {reassurance.map((item) => (
            <li key={item} className="border-b border-sapin-20 py-12 first:border-t">
              {item}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-16">
          <h3 className="text-label text-encre uppercase">{t('howItWorks')}</h3>
          <ol className="flex flex-col gap-12">
            {steps.map((step, index) => (
              <li key={step} className="flex items-baseline gap-16">
                <span aria-hidden="true" className="w-32 shrink-0 text-label text-cypres">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <p>{t('model')}</p>
        {service.key === 'senior' ? <p className="text-body-s">{t('senior.precision')}</p> : null}

        <p>
          <TextLink href={`/${locale}/contact?service=${service.id}`}>{t('cta')}</TextLink>
        </p>
      </div>
    </section>
  )
}
