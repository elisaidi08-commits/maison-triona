import { getTranslations } from 'next-intl/server'
import { LoopVideo } from '@/components/media/LoopVideo'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { ChoiceList } from '@/components/ui/ChoiceList'
import { Rule } from '@/components/ui/Rule'
import { Stamp } from '@/components/ui/Stamp'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICE_PATHS } from '@/lib/services'
import { AnchorFocus } from './AnchorFocus'
import desktop from '../../../public/media/seuil/P01-fenetre-mer.jpg'
import mobile from '../../../public/media/seuil/P01-fenetre-mer-m.jpg'

// Premier écran de l'accueil (D25, gardé par D26) : la vidéo V01 en plein cadre (photo P01 en
// mobile), sous un voile sapin à 50 % mesuré sur ces images, et le nom de la maison en grand,
// centré, signé du « K. ». Seul texte posé sur l'image. Bande ivoire (D26) : l'accroche, une phrase
// qui dit ce que fait la maison, puis l'entrée par besoin (les 3 services et « Évoquer une demande
// particulière »), vrais liens. Un seul titre display à l'écran : l'accroche est en Manrope.
// D59 (Sady, 06/11/2026) : chaque service mène directement à sa page, sans repasser par une ancre
// de l'accueil ni par la page Services (un seul clic pour découvrir un service).
// Le premier choix reste visible sans défiler sur 390 × 844.

const CHOICES = [
  { key: 'concierge', service: 'conciergerie', number: '01' },
  { key: 'senior', service: 'grand-age', number: '02' },
  { key: 'children', service: 'enfants', number: '03' },
  { key: 'unsure', service: undefined, number: undefined },
] as const

export async function Seuil({ locale }: { locale: string }) {
  const t = await getTranslations('Home')
  const meta = await getTranslations('Meta')
  const video = await getTranslations('Video')
  const choices = CHOICES.map(({ key, service, number }) => ({
    href: service
      ? localizedPath(SERVICE_PATHS[service], locale as Locale)
      : localizedPath('/contact', locale as Locale),
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
        <div aria-hidden="true" className="absolute inset-0 bg-voile-leger" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-24 px-margin text-center">
          <h1
            id="seuil-titre"
            tabIndex={-1}
            className="animate-entree font-display text-marque text-ivoire"
          >
            {meta('siteName')}
          </h1>
          <span aria-hidden="true" className="flex items-center gap-16">
            <Rule short />
            <Stamp onDark />
            <Rule short />
          </span>
        </div>
      </div>
      <div className="bg-ivoire px-margin pt-24 pb-24 lg:pt-32">
        <div className="mb-16 flex max-w-titre flex-col gap-4 lg:mb-24">
          <p className="text-title-h3 text-balance text-sapin">{t('accroche')}</p>
          <p className="text-body text-balance text-encre">{t('intro')}</p>
        </div>
        <ChoiceList choices={choices} rowOnDesktop />
        <AnchorFocus />
      </div>
    </section>
  )
}
