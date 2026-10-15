import { getTranslations } from 'next-intl/server'
import { LoopVideo } from '@/components/media/LoopVideo'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Button } from '@/components/ui/Button'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import p02d from '../../../public/media/maison/P02-porte-ocre.jpg'
import p02m from '../../../public/media/maison/P02-porte-ocre-m.jpg'

// Scènes de l'accueil hors services (D25) : La maison, Comment ça se passe, Territoires, Contact.
// Texte jamais posé sur l'image ; une idée par écran.

// La maison : le titre sur aplat, puis l'image en pleine largeur (16:9 en desktop, la vidéo V02 n'y
// est presque pas agrandie). En desktop, un intervalle de section sépare l'image de la section
// suivante et accueille le bouton pause, sous l'image.
export async function SceneMaison({ locale }: { locale: string }) {
  const t = await getTranslations('Scenes.house')
  const video = await getTranslations('Video')
  return (
    <section aria-labelledby="maison-titre" className="lg:pb-section">
      <div className="flex flex-col gap-24 px-margin py-section">
        <Rule short />
        <p className="text-label text-encre uppercase">{t('label')}</p>
        <h2 id="maison-titre" className="max-w-titre font-display text-display-l text-sapin">
          {t('title')}
        </h2>
        <p>
          <TextLink href={`/${locale}/la-maison`}>{t('link')}</TextLink>
        </p>
      </div>
      <div className="relative aspect-portrait lg:aspect-hero">
        <ResponsiveImage desktop={p02d} mobile={p02m} alt={t('imageAlt')} />
        <LoopVideo
          mp4="/media/maison/V02-porte-ocre.mp4"
          webm="/media/maison/V02-porte-ocre.webm"
          pause={{ visible: video('pauseShort'), full: video('pause') }}
          play={{ visible: video('playShort'), full: video('play') }}
          controls="below"
        />
      </div>
    </section>
  )
}

// Comment ça se passe : le modèle de la maison, une seule fois pour les trois services (les pages
// de service le reprennent). Trois étapes numérotées, en grand corps, filets entre les lignes.
export async function HowItWorks() {
  const t = await getTranslations('Services')
  const steps = t.raw('steps') as string[]
  return (
    <section aria-labelledby="etapes-titre" className="py-section">
      <div className="conteneur grid gap-48 lg:grid-cols-12 lg:gap-gutter">
        <div className="flex flex-col gap-24 lg:col-span-5">
          <Rule short />
          <h2 id="etapes-titre" className="font-display text-display-l text-sapin">
            {t('howItWorks')}
          </h2>
          <p className="max-w-measure">{t('model')}</p>
        </div>
        <ol className="flex flex-col lg:col-span-6 lg:col-start-7">
          {steps.map((step, index) => (
            <li
              key={step}
              className="flex items-baseline gap-24 border-b border-sapin-20 py-24 first:border-t"
            >
              <span aria-hidden="true" className="w-32 shrink-0 text-label text-cypres">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-title-h3 text-encre">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// S6 : texte seul tant que le visuel P07 (lot 2) n'existe pas ; aucun aplat vide.
export async function SceneTerritoires({ locale }: { locale: string }) {
  const t = await getTranslations('Scenes.territories')
  return (
    <section aria-labelledby="territoires-titre" className="py-section">
      <div className="conteneur flex flex-col gap-24">
        <Rule short />
        <p className="text-label text-encre uppercase">{t('label')}</p>
        <h2 id="territoires-titre" className="font-display text-title-h2 text-sapin">
          {t('title')}
        </h2>
        <p className="text-label-l text-encre uppercase">{t('countries')}</p>
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
