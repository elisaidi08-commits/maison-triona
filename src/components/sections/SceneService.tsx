import { getTranslations } from 'next-intl/server'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { SERVICE_IMAGES, type Service } from '@/lib/services'

// Scène de service, structure identique × 3 (docs/art-direction.md §7.8). Desktop : média à hauteur
// d'écran, collant pendant que le texte défile, côté alterné d'une scène à l'autre ; la scène se lit
// en deux temps (la promesse face à l'image, puis, un intervalle de section plus bas, réassurance,
// étapes, modèle et CTA). Le texte garde la marge de page côté extérieur. L'image est
// la version portrait (Pxx-m), faite pour une demi-largeur. Sans visuel (lot 2 à venir), aucune
// colonne vide : la promesse et les détails se répondent sur deux colonnes de texte.
// En mobile, le texte vient d'abord : après un choix d'entrée, le visiteur arrive sur la promesse,
// pas sur l'image (parcours « choisir → service → contacter ») ; l'image suit son texte de près,
// l'air de section la sépare de la scène suivante.
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

  const details = (
    <>
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
      {service.key === 'senior' ? <p>{t('senior.precision')}</p> : null}

      <p>
        <TextLink href={`/${locale}/contact?service=${service.id}`}>{t('cta')}</TextLink>
      </p>
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
        <ResponsiveImage
          desktop={image.mobile}
          mobile={image.mobile}
          alt={t(`${service.key}.imageAlt`)}
          sizes="(min-width: 64rem) 50vw, 100vw"
        />
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
