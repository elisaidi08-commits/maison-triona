import { getTranslations } from 'next-intl/server'
import { LoopVideo } from '@/components/media/LoopVideo'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { MediaPlaceholder } from '@/components/media/MediaPlaceholder'
import { Button } from '@/components/ui/Button'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import p02d from '../../../public/media/maison/P02-porte-ocre.jpg'
import p02m from '../../../public/media/maison/P02-porte-ocre-m.jpg'

// Scènes de l'accueil hors services (storyboard du brief §3) : S2 La maison, S6 Territoires,
// S7 Contact. Texte jamais posé sur l'image ; une idée par écran.

export async function SceneMaison({ locale }: { locale: string }) {
  const t = await getTranslations('Scenes.house')
  const video = await getTranslations('Video')
  return (
    <section aria-labelledby="maison-titre" className="flex flex-col lg:grid lg:grid-cols-12">
      <div className="flex flex-col justify-center gap-24 px-margin py-section lg:col-span-5">
        <Rule short />
        <p className="text-label text-encre uppercase">{t('label')}</p>
        <h2 id="maison-titre" className="font-display text-display-l text-sapin">
          {t('title')}
        </h2>
        <p>
          <TextLink href={`/${locale}/la-maison`}>{t('link')}</TextLink>
        </p>
      </div>
      <div className="relative aspect-portrait lg:col-span-7 lg:aspect-hero">
        <ResponsiveImage
          desktop={p02d}
          mobile={p02m}
          alt={t('imageAlt')}
          sizes="(min-width: 64rem) 58vw, 100vw"
        />
        <LoopVideo
          mp4="/media/maison/V02-porte-ocre.mp4"
          webm="/media/maison/V02-porte-ocre.webm"
          pauseLabel={video('pause')}
          playLabel={video('play')}
        />
      </div>
    </section>
  )
}

export async function SceneTerritoires({ locale }: { locale: string }) {
  const t = await getTranslations('Scenes.territories')
  return (
    <section aria-labelledby="territoires-titre" className="flex flex-col">
      <div className="relative aspect-portrait lg:aspect-hero">
        {/* Visuel P07 (lot 2) à venir. */}
        <MediaPlaceholder />
      </div>
      <div className="mx-auto flex w-full max-w-content flex-col gap-24 px-margin py-section">
        <Rule short />
        <p className="text-label text-encre uppercase">{t('label')}</p>
        <h2 id="territoires-titre" className="font-display text-title-h2 text-sapin">
          {t('title')}
        </h2>
        <p className="text-label text-encre uppercase">{t('countries')}</p>
        <p>
          <TextLink href={`/${locale}/territoires`}>{t('link')}</TextLink>
        </p>
      </div>
    </section>
  )
}

export async function ContactBlock({ locale }: { locale: string }) {
  const t = await getTranslations('Scenes.contact')
  return (
    <section aria-labelledby="contact-titre" data-surface="sapin" className="px-margin py-section">
      <div className="mx-auto flex max-w-measure flex-col items-center gap-24 text-center">
        <Rule short />
        <p className="text-label text-champagne uppercase">{t('label')}</p>
        <h2 id="contact-titre" className="font-display text-title-h2 text-ivoire">
          {t('title')}
        </h2>
        <p className="text-ivoire-80">{t('reassurance')}</p>
        <Button href={`/${locale}/contact`}>{t('button')}</Button>
      </div>
    </section>
  )
}
