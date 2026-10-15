import { getTranslations } from 'next-intl/server'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { ChoiceList } from '@/components/ui/ChoiceList'
import desktop from '../../../public/media/seuil/P01-fenetre-mer.jpg'
import mobile from '../../../public/media/seuil/P01-fenetre-mer-m.jpg'

// Écran 1 de l'accueil, « Seuil plein écran » (D19, docs/art-direction.md §7.2).
// Image plein cadre (la vidéo V01 la remplacera en story 2.5, avec ce poster), titre display posé
// sur un voile sapin à 60 % (seul texte autorisé sur image), question et 4 choix sur aplat ivoire.
// Desktop : l'écran 1 tient toute la hauteur visible, choix en ligne. Mobile : image 4:5 recadrée,
// puis la liste ; le premier choix reste visible sans défiler sur 390 × 844.

const CHOICES = [
  { key: 'concierge', href: '#conciergerie', number: '01' },
  { key: 'senior', href: '#grand-age', number: '02' },
  { key: 'children', href: '#enfants', number: '03' },
  { key: 'unsure', href: 'contact', number: undefined },
] as const

export async function Seuil({ locale }: { locale: string }) {
  const t = await getTranslations('Home')
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
        <ResponsiveImage desktop={desktop} mobile={mobile} alt={t('imageAlt')} priority />
        <div className="absolute inset-x-0 bottom-0 px-margin pb-32 lg:pb-48">
          <h1
            id="seuil-titre"
            className="w-fit max-w-titre bg-voile px-24 py-24 font-display text-display-xl text-balance text-ivoire lg:px-32 lg:py-32"
          >
            {t('title')}
          </h1>
        </div>
      </div>
      <div className="bg-ivoire px-margin pt-32 pb-16 lg:pt-48 lg:pb-32">
        <h2 className="mb-24 text-title-h3 text-encre">{t('question')}</h2>
        <ChoiceList choices={choices} rowOnDesktop />
      </div>
    </section>
  )
}
