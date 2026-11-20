import { getTranslations } from 'next-intl/server'
import { connection } from 'next/server'

import { LOCALES, type Locale } from '@/i18n/pathnames'
import { bookingUid, buildIcs } from '@/lib/booking/ics'
import { lirePageGestion } from '@/lib/booking/link-page'

// Fichier .ics d'un appel, par le lien de gestion (story 3.11 ; docs/reservation-appel.md §4.5) :
// produit ici, sur le serveur, à chaque demande, sans rien écrire. UID stable (`<id>-guest@`), titre
// et phrase fixes de messages/*.json : ni nom de service, ni nom, ni numéro, ni lien. Appel à venir ou
// commencé : `METHOD:PUBLISH` avec la séquence de la base (+1 à chaque déplacement : le nouveau fichier
// remplace l'ancien dans l'agenda) ; appel annulé : `METHOD:CANCEL`, `STATUS:CANCELLED`, même UID,
// séquence de l'annulation (il retire l'événement). Lien qui ne vaut plus : 404, sans dire pourquoi.
// Le chemin porte le jeton : no-store, référent réduit à l'origine, noindex.

const ENTETES_PRIVES = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'strict-origin',
  'X-Robots-Tag': 'noindex, nofollow',
}

function introuvable(): Response {
  return new Response(null, { status: 404, headers: ENTETES_PRIVES })
}

export async function GET(
  _request: Request,
  { params }: RouteContext<'/[locale]/contact/appel/gerer/[jeton]/agenda'>,
): Promise<Response> {
  await connection()
  const { locale, jeton } = await params
  if (!(LOCALES as readonly string[]).includes(locale)) return introuvable()
  const lu = await lirePageGestion(jeton, locale as Locale)
  if (lu.etat === 'indisponible') {
    return new Response(null, { status: 503, headers: ENTETES_PRIVES })
  }
  if (lu.etat !== 'valide') return introuvable()

  const t = await getTranslations({ locale: locale as Locale, namespace: 'Booking.ics' })
  const ics = buildIcs({
    uid: bookingUid(lu.appel.id, 'guest'),
    start: lu.appel.start,
    end: lu.appel.end,
    stamp: new Date(),
    summary: t('summary'),
    description: t('description'),
    sequence: lu.appel.sequence,
    method: lu.phase === 'cancelled' ? 'CANCEL' : 'PUBLISH',
  })
  return new Response(ics, {
    status: 200,
    headers: {
      ...ENTETES_PRIVES,
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="maison-triona-appel.ics"',
    },
  })
}
