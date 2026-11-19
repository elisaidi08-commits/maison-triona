import { getTranslations } from 'next-intl/server'
import { connection } from 'next/server'

import { LOCALES, type Locale } from '@/i18n/pathnames'
import { bookingUid, buildIcs } from '@/lib/booking/ics'
import { lirePageConfirmation } from '@/lib/booking/link-page'

// « Ajouter à mon agenda » (story 3.10 ; docs/reservation-appel.md §4.5) : le fichier .ics de l'appel,
// produit ici, sur le serveur, à chaque demande, sans rien écrire. UID stable (`<id>-guest@`), titre et
// phrase fixes de messages/*.json : ni nom de service, ni nom, ni numéro, ni lien. Même condition que
// la confirmation (appel confirmé, pas encore passé) ; sinon 404, sans dire pourquoi. Le chemin porte
// le jeton : no-store, référent réduit à l'origine, noindex (en-têtes ci-dessous et next.config.ts).

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
  { params }: RouteContext<'/[locale]/contact/appel/[jeton]/agenda'>,
): Promise<Response> {
  await connection()
  const { locale, jeton } = await params
  if (!(LOCALES as readonly string[]).includes(locale)) return introuvable()
  const lu = await lirePageConfirmation(jeton)
  if (lu.etat === 'indisponible') {
    return new Response(null, { status: 503, headers: ENTETES_PRIVES })
  }
  if (lu.etat !== 'confirme') return introuvable()

  const t = await getTranslations({ locale: locale as Locale, namespace: 'Booking.ics' })
  const ics = buildIcs({
    uid: bookingUid(lu.confirmation.bookingId, 'guest'),
    start: lu.confirmation.start,
    end: lu.confirmation.end,
    stamp: new Date(),
    summary: t('summary'),
    description: t('description'),
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
