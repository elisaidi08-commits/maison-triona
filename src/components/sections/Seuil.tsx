import { getTranslations } from 'next-intl/server'
import { LoopVideo } from '@/components/media/LoopVideo'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { ChoiceList } from '@/components/ui/ChoiceList'
import { Rule } from '@/components/ui/Rule'
import { Stamp } from '@/components/ui/Stamp'
import { AnchorFocus } from './AnchorFocus'
import desktop from '../../../public/media/seuil/P01-fenetre-mer.jpg'
import mobile from '../../../public/media/seuil/P01-fenetre-mer-m.jpg'

// Écran 1 de l'accueil, « Seuil plein écran » (D19, docs/art-direction.md §7.2).
// Image plein cadre et vidéo V01 (desktop), titre display sur un voile sapin à 60 % (seul texte
// autorisé sur image). Le voile n'est pas un cartouche : il part du bord gauche et du bas de l'image,
// dans le prolongement de la bande ivoire, et le titre s'aligne sur la marge, comme la question.
// Bande ivoire : la question, les 4 choix (en ligne en desktop), puis le « K. » de fin de hero.
// Mobile : image recadrée, puis la liste ; le premier choix reste visible sans défiler sur 390 × 844.

const CHOICES = [
  { key: 'concierge', href: '#conciergerie', number: '01' },
  { key: 'senior', href: '#grand-age', number: '02' },
  { key: 'children', href: '#enfants', number: '03' },
  { key: 'unsure', href: 'contact', number: undefined },
] as const

function HeroStamp() {
  return (
    <span aria-hidden="true" className="flex items-center gap-16">
      <Rule short />
      <Stamp />
    </span>
  )
}

export async function Seuil({ locale }: { locale: string }) {
  const t = await getTranslations('Home')
  const video = await getTranslations('Video')
  const choices = CHOICES.map(({ key, href, number }) => ({
    href: href === 'contact' ? `/${locale}/contact` : href,
    number,
    label: t(`choices.${key}.label`),
    category: key === 'unsure' ? undefined : t(`choices.${key}.category`),
    note: key === 'unsure' ? t('choices.unsure.note') : undefined,
  }))

  return (
    <section aria-labelledby="seuil-titre" className="flex flex-col lg:h-seuil">
      <div className="relative h-seuil-image overflow-hidden bg-sapin lg:h-auto lg:flex-1">
        <ResponsiveImage
          desktop={desktop}
          mobile={mobile}
          alt={t('imageAlt')}
          anchor="seuil"
          priority
        />
        <LoopVideo
          mp4="/media/seuil/V01-fenetre-mer.mp4"
          webm="/media/seuil/V01-fenetre-mer.webm"
          pause={{ visible: video('pauseShort'), full: video('pause') }}
          play={{ visible: video('playShort'), full: video('play') }}
          anchor="seuil"
        />
        <div className="absolute bottom-0 left-0 max-w-titre bg-voile pt-24 pr-24 pb-24 pl-margin lg:pt-32 lg:pr-48 lg:pb-32">
          <h1
            id="seuil-titre"
            className="animate-entree font-display text-display-xl text-balance text-ivoire"
          >
            {t('title')}
          </h1>
        </div>
      </div>
      <div className="bg-ivoire px-margin pt-32 pb-24">
        <div className="mb-16 flex items-center justify-between gap-24">
          <h2 className="text-title-h3 text-encre">{t('question')}</h2>
          <span className="hidden lg:block">
            <HeroStamp />
          </span>
        </div>
        <ChoiceList choices={choices} rowOnDesktop />
        <span className="mt-24 block lg:hidden">
          <HeroStamp />
        </span>
        <AnchorFocus />
      </div>
    </section>
  )
}
