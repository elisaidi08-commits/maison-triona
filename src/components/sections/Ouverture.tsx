import { getImageProps, type StaticImageData } from 'next/image'
import { getTranslations } from 'next-intl/server'
import { OUVERTURE_PLANS, OUVERTURE_VIDEO, PLAN_SECONDS, type Caption } from '@/lib/ouverture'
import { OuvertureFilm, type FilmPlan } from './OuvertureFilm'

// Ouverture de l'accueil (D25), côté serveur : textes traduits et sources d'images optimisées
// (AVIF puis WebP), passés au film. Sans JavaScript, la règle <noscript> la masque : l'accueil
// s'affiche directement, rien n'est perdu.

function source(image: StaticImageData, first: boolean) {
  const { props } = getImageProps({
    src: image,
    alt: '',
    sizes: '100vw',
    quality: 75,
    ...(first ? { loading: 'eager', fetchPriority: 'high' } : {}),
  })
  return { src: props.src, srcSet: props.srcSet, width: props.width, height: props.height }
}

export async function Ouverture() {
  const t = await getTranslations('Ouverture')
  const meta = await getTranslations('Meta')
  const services = await getTranslations('Services')
  const scenes = await getTranslations('Scenes')
  const home = await getTranslations('Home')
  const video = await getTranslations('Video')

  const text: Record<Caption, string> = {
    brand: meta('siteName'),
    concierge: services('concierge.name'),
    senior: services('senior.name'),
    children: services('children.name'),
    territories: scenes('territories.countries'),
    tagline: home('title'),
  }

  const plans: FilmPlan[] = OUVERTURE_PLANS.map(({ caption, desktop, mobile }, index) => ({
    kind: caption === 'brand' ? 'brand' : 'line',
    text: text[caption],
    desktop: source(desktop, index === 0),
    mobile: source(mobile, index === 0),
  }))

  return (
    <>
      <noscript>
        <style>{'[data-ouverture]{display:none}'}</style>
      </noscript>
      <OuvertureFilm
        plans={plans}
        brand={meta('siteName')}
        mp4={OUVERTURE_VIDEO.mp4}
        webm={OUVERTURE_VIDEO.webm}
        planSeconds={PLAN_SECONDS}
        labels={{
          dialog: t('label'),
          summary: t('summary'),
          skip: t('skip'),
          enter: t('enter'),
          pause: video('pauseShort'),
          play: video('playShort'),
        }}
      />
    </>
  )
}
