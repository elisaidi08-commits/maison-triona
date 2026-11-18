import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/Button'
import { Rule } from '@/components/ui/Rule'

// Bloc Contact de fin de page (docs/art-direction.md §7.5) : aplat sapin, label champagne, titre
// ivoire, une phrase de réassurance et le bouton « Nous écrire ». Partagé par l'accueil, la page
// Services et les pages de service (un seul par page : l'identifiant du titre est fixe).
// `besoin` (pages de service) : le bouton présélectionne ce service dans le formulaire (D26).

export async function ContactBlock({ locale, besoin }: { locale: string; besoin?: string }) {
  const t = await getTranslations('Scenes.contact')
  return (
    <section
      aria-labelledby="contact-titre"
      data-surface="sapin"
      className="px-margin py-section print:hidden"
    >
      <div className="mx-auto flex max-w-measure flex-col items-center gap-24 text-center">
        <Rule short />
        <p className="text-label text-champagne uppercase">{t('label')}</p>
        <h2 id="contact-titre" className="font-display text-title-h2 text-balance text-ivoire">
          {t('title')}
        </h2>
        <p className="text-ivoire-80">{t('reassurance')}</p>
        <Button href={`/${locale}/contact`} besoin={besoin}>
          {t('button')}
        </Button>
      </div>
    </section>
  )
}
