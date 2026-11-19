import { getTranslations } from 'next-intl/server'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'

// Lien de réservation qui ne vaut plus, ou réservation momentanément indisponible (story 3.10 ;
// docs/reservation-appel.md §5) : une page sobre qui invite à écrire. Rien n'y dit pourquoi : un lien
// inconnu, mal formé, expiré, annulé ou déjà utilisé reçoit exactement la même page. Même colonne que
// le contact.

type BookingNoticeProps = {
  locale: Locale
  kind: 'invalid' | 'unavailable'
}

export async function BookingNotice({ locale, kind }: BookingNoticeProps) {
  const t = await getTranslations({ locale, namespace: 'Booking' })
  return (
    <div className="conteneur py-section">
      <div className="mx-auto flex max-w-measure flex-col gap-24">
        <Rule short />
        <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
          {t(`${kind}.title`)}
        </h1>
        <p className="text-body-l">{t(`${kind}.body`)}</p>
        <p>
          <TextLink href={localizedPath('/contact', locale)}>{t('invalid.write')}</TextLink>
        </p>
      </div>
    </div>
  )
}
