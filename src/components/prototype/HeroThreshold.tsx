import { getTranslations } from 'next-intl/server'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { AnchorFocus } from '@/components/sections/AnchorFocus'
import { ChoiceList } from '@/components/ui/ChoiceList'
import { Stamp } from '@/components/ui/Stamp'
import desktop from '../../../public/media/prototype/P10-seuil-portes.jpg'
import mobile from '../../../public/media/prototype/P10-seuil-portes-m.jpg'

// Prototype V5, l'invitation (concept A+B « Le Seuil + Les Gestes Invisibles ») : P10, le vestibule
// et ses portes encore closes, en image fixe prioritaire (élément LCP, jamais animée). Seul le
// titre se pose sur l'image, sur le mur sombre, sous un voile sapin mesuré (tokens.css). Bande
// ivoire : la phrase métier, la question, puis les quatre entrées, vrais liens vers la composition
// des services.
// Le premier choix reste visible sans défiler en 1440 × 900, 834 × 1194 et 390 × 844.

const CHOICES = [
  { key: 'concierge', href: '#conciergerie', number: '01' },
  { key: 'senior', href: '#grand-age', number: '02' },
  { key: 'children', href: '#enfants', number: '03' },
  { key: 'unsure', href: '#demande-particuliere', number: undefined },
] as const

export async function HeroThreshold() {
  const t = await getTranslations('Prototype')
  const home = await getTranslations('Home')
  const choices = CHOICES.map(({ key, href, number }) => ({
    href,
    number,
    label: home(`choices.${key}.label`),
    category: key === 'unsure' ? undefined : home(`choices.${key}.category`),
    note: key === 'unsure' ? home('choices.unsure.note') : undefined,
  }))
  // Une phrase par ligne (« Une maison. » / « Mille attentions. »), sans coupure au milieu.
  const lines = t('title').split(/(?<=\.)\s+/)

  return (
    <section aria-labelledby="seuil-titre" className="flex flex-col lg:h-seuil">
      <div className="relative h-invitation-image overflow-hidden bg-sapin lg:h-auto lg:flex-1">
        <ResponsiveImage desktop={desktop} mobile={mobile} alt={t('imageAlt')} priority />
        <div aria-hidden="true" className="absolute inset-0 bg-voile lg:bg-voile-portes" />
        <div className="absolute inset-0 flex flex-col justify-center gap-24 px-margin">
          <h1
            id="seuil-titre"
            tabIndex={-1}
            className="animate-entree self-start font-display text-display-xl text-ivoire"
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
      </div>
      <div className="bg-ivoire px-margin pt-24 pb-24 lg:pt-32">
        <div className="mb-16 flex max-w-titre flex-col gap-8 lg:mb-24">
          <p className="text-body text-balance text-encre">{t('metier')}</p>
          <h2 className="text-title-h3 text-sapin">{t('question')}</h2>
        </div>
        <ChoiceList choices={choices} rowOnDesktop />
        <AnchorFocus />
      </div>
    </section>
  )
}
