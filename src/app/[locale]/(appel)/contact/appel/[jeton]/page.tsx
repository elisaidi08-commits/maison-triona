import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import * as rootParams from 'next/root-params'
import { connection } from 'next/server'
import { BookingForm, type TextesReservation } from '@/components/forms/BookingForm'
import { BookingNotice } from '@/components/sections/BookingNotice'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { etatRetenu } from '@/lib/booking/action-state'
import { lirePageLien } from '@/lib/booking/link-page'

// Réservation d'un appel par lien personnel (story 3.10 ; docs/reservation-appel.md §2, étape 3) :
// un seul écran, sous la même colonne que le contact. Le lien vaut-il encore, quels créneaux sont
// libres : lu à chaque affichage, sans rien écrire (un GET n'engage rien, §4.4). Lien inconnu, mal
// formé, expiré, annulé ou déjà utilisé : la même page sobre. Plus aucun créneau dans l'horizon : une
// phrase d'excuse et « Nous écrire » (§5). Textes en brouillon (content/brouillons.json).

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await rootParams.locale()) as Locale
  const t = await getTranslations({ locale, namespace: 'Booking' })
  return {
    title: t('metaTitle'),
    robots: { index: false, follow: false },
    referrer: 'strict-origin',
  }
}

export default async function Page({ params }: PageProps<'/[locale]/contact/appel/[jeton]'>) {
  // À chaque requête, avant toute lecture de l'heure ou de la base (layout et page se rendent en
  // parallèle : la connexion du layout ne suffit pas).
  await connection()
  const { jeton } = await params
  const locale = (await rootParams.locale()) as Locale
  const lien = await lirePageLien(jeton, locale)
  if (lien.etat === 'invalide') return <BookingNotice locale={locale} kind="invalid" />
  if (lien.etat === 'indisponible') return <BookingNotice locale={locale} kind="unavailable" />

  // Après un envoi sans JavaScript : l'état de l'action (erreurs, saisie, créneau pris).
  const etat = await etatRetenu()
  const t = await getTranslations('Booking')
  const contact = await getTranslations('Contact')
  const textes: TextesReservation = {
    slots: t.raw('slots') as TextesReservation['slots'],
    form: t.raw('form') as TextesReservation['form'],
    origine: contact.raw('form.fields.origine') as TextesReservation['origine'],
  }
  return (
    <div className="conteneur py-section">
      <div className="mx-auto flex max-w-measure flex-col gap-64">
        <header className="flex flex-col gap-24">
          <Rule short />
          <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
            {t('title')}
          </h1>
          <p className="text-body-l">{t('intro')}</p>
        </header>
        {lien.creneaux.length === 0 ? (
          <div className="flex flex-col gap-24">
            <p className="text-body-l">{t('slots.none')}</p>
            <p>
              <TextLink href={localizedPath('/contact', locale)}>{t('slots.write')}</TextLink>
            </p>
          </div>
        ) : (
          <BookingForm
            locale={locale}
            jeton={jeton}
            creneaux={lien.creneaux}
            etatInitial={etat}
            textes={textes}
            confidentialite={`${localizedPath('/confidentialite', locale)}#appel`}
          />
        )}
      </div>
    </div>
  )
}
