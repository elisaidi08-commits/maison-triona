import { getTranslations } from 'next-intl/server'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'

// Lien de réservation qui ne vaut plus, ou réservation momentanément indisponible (story 3.10 ;
// docs/reservation-appel.md §5) : une page sobre qui invite à écrire. Rien n'y dit pourquoi : un lien
// inconnu, mal formé, expiré, annulé ou déjà utilisé reçoit exactement la même page. Même colonne que
// le contact. Pour un lien qui ne vaut plus, « Recevoir un nouveau lien » mène à la demande de lien
// (story 3.9).

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
        <ul className="flex flex-col gap-8">
          {/* Lien qui ne vaut plus : un nouveau lien se demande avec l'adresse (story 3.9), jamais
              affichée ni retrouvée ici (spec §5). */}
          {kind === 'invalid' ? (
            <li>
              <TextLink href={localizedPath('/contact/appel', locale)}>
                {t('invalid.newLink')}
              </TextLink>
            </li>
          ) : null}
          <li>
            <TextLink href={localizedPath('/contact', locale)}>{t('invalid.write')}</TextLink>
          </li>
        </ul>
      </div>
    </div>
  )
}
