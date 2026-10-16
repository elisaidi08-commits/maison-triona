import { getTranslations } from 'next-intl/server'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { Rule } from '@/components/ui/Rule'
import { GesturePlay } from './GesturePlay'
import gestureEnd from '../../../public/media/prototype/V12-geste-fin.jpg'

// Prototype V5 : l'attention et la confiance, avec les textes existants (aucun texte nouveau).

// L'attention : la promesse face au geste d'accueil. Desktop : le texte sur 5 colonnes, le geste
// sur 7 ; l'intervalle sous l'image accueille le bouton de la vidéo. En mobile, le texte d'abord.
export async function SceneAttention() {
  const t = await getTranslations('Promise')
  const home = await getTranslations('Home')
  const p = await getTranslations('Prototype')
  const video = await getTranslations('Video')
  const points = t.raw('points') as string[]
  return (
    <section aria-labelledby="promesse-titre" className="py-section">
      <div className="conteneur grid gap-48 lg:grid-cols-12 lg:gap-gutter">
        <div className="flex flex-col gap-24 lg:col-span-5 lg:self-center">
          <Rule short />
          <p className="text-label text-encre uppercase">{t('label')}</p>
          <h2 id="promesse-titre" className="font-display text-title-h2 text-balance text-sapin">
            {home('title')}
          </h2>
          <ul className="flex flex-col">
            {points.map((point) => (
              <li key={point} className="border-b border-sapin-20 py-12 first:border-t">
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="mb-48 lg:col-span-7 lg:mb-0 lg:self-center">
          <GesturePlay
            src="/media/prototype/V12-geste.mp4"
            poster="/media/prototype/V12-geste-debut.jpg"
            pause={{ visible: video('pauseShort'), full: video('pause') }}
            play={{ visible: video('playShort'), full: video('play') }}
            replay={{ visible: p('replayShort'), full: p('replay') }}
          >
            <ResponsiveImage
              desktop={gestureEnd}
              mobile={gestureEnd}
              alt={p('gestureAlt')}
              sizes="(min-width: 64rem) 58vw, 100vw"
            />
          </GesturePlay>
        </div>
      </div>
    </section>
  )
}

// La confiance : comment ça se passe, en trois temps, sous la phrase du modèle de la maison.
export async function SceneTrust() {
  const t = await getTranslations('Services')
  const steps = t.raw('steps') as string[]
  return (
    <section aria-labelledby="confiance-titre" className="py-section">
      <div className="conteneur grid gap-48 lg:grid-cols-12 lg:gap-gutter">
        <div className="flex flex-col gap-24 lg:col-span-5">
          <Rule short />
          <p className="text-label text-encre uppercase">{t('howItWorks')}</p>
          <h2 id="confiance-titre" className="font-display text-title-h2 text-balance text-sapin">
            {t('model')}
          </h2>
        </div>
        <ol className="flex flex-col lg:col-span-6 lg:col-start-7 lg:self-end">
          {steps.map((step, index) => (
            <li
              key={step}
              className="flex items-baseline gap-24 border-b border-sapin-20 py-24 text-title-h3 text-encre first:border-t"
            >
              <span aria-hidden="true" className="w-32 shrink-0 text-label text-cypres">
                {String(index + 1).padStart(2, '0')}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
