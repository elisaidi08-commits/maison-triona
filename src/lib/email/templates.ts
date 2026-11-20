// Gabarits des deux e-mails INTERNES : la notification à Cat et l'alerte technique à Sady.
//
// D06 : la notification est « très minimaliste » : la date et le lien vers le coffre, RIEN
// de la demande (ni nom, ni contact, ni service, ni pays, ni message). Ces fonctions ne
// reçoivent d'ailleurs aucun champ de la demande : la fuite est impossible par construction.
// Seul le sujet porte « Prioritaire » si la demande est urgente.
//
// Le sujet reste neutre : Scaleway TEM conserve le sujet et le destinataire tant que le
// domaine est actif.
//
// Textes internes (Cat, Sady) : français seulement, en texte brut, en constantes ici et non
// dans messages/*.json. Typographie : apostrophe ’, espace insécable avant « : ».
import type { AlertEvent } from '../outbox/repository.ts'

export interface RenderedEmail {
  subject: string
  text: string
}

// Espace insécable (U+00A0), comme dans messages/fr.json.
const NBSP = ' '

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NOTIFICATION_SUBJECT = 'Nouvelle demande · Maison Triona'
const PRIORITY_SUFFIX = ' · Prioritaire'
const ALERT_SUBJECT = 'Alerte technique · Maison Triona'

const ALERT_LINES: Record<AlertEvent, string> = {
  send_failed: 'Échec définitif de l’envoi.',
  undelivered: 'Message non délivré au destinataire.',
  tracking_expired: 'Livraison non confirmée après 72 heures.',
  notify_cap: `Plafond de notifications atteint${NBSP}: les demandes suivantes de la journée sont enregistrées dans le coffre, sans e-mail.`,
  link_cap: `Plafond des demandes de lien atteint${NBSP}: jusqu’à minuit UTC, plus aucun lien de réservation n’est créé ni envoyé, mais la page annonce l’envoi au visiteur.`,
}

// Seules les alertes de plafond ne portent pas d'identifiant : elles ne concernent aucun message.
const WITHOUT_SUBJECT: readonly AlertEvent[] = ['notify_cap', 'link_cap']

const DATE_FORMAT = new Intl.DateTimeFormat('fr-BE', {
  timeZone: 'Europe/Brussels',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
})

// « mercredi 18 novembre 2026 à 22 h 14 » (heure de Bruxelles, minutes sur 2 chiffres).
function formatDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new RangeError('Date invalide.')
  }
  const parts: Record<string, string> = {}
  for (const part of DATE_FORMAT.formatToParts(date)) parts[part.type] = part.value
  const hour = String(Number(parts.hour))
  return `${parts.weekday} ${parts.day} ${parts.month} ${parts.year} à ${hour}${NBSP}h${NBSP}${parts.minute}`
}

function assertUuid(value: string, name: string): void {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new RangeError(`${name} doit être un UUID.`)
  }
}

export function renderNotification(input: {
  requestId: string
  priority: boolean
  createdAt: Date
  siteUrl: string
}): RenderedEmail {
  assertUuid(input.requestId, 'requestId')
  if (typeof input.siteUrl !== 'string' || input.siteUrl === '' || input.siteUrl.endsWith('/')) {
    throw new RangeError('siteUrl ne doit pas être vide ni finir par « / ».')
  }
  const subject = input.priority ? NOTIFICATION_SUBJECT + PRIORITY_SUFFIX : NOTIFICATION_SUBJECT
  const text = [
    `Une demande est arrivée le ${formatDate(input.createdAt)}.`,
    '',
    `Pour la lire, ouvrez le coffre${NBSP}:`,
    `${input.siteUrl}/coffre/demandes/${input.requestId}`,
    '',
    'Ce message ne contient rien de la demande.',
  ].join('\n')
  return { subject, text }
}

// `subjectId` : identifiant du message en cause, obligatoire sauf pour les alertes de plafond
// (`notify_cap`, `link_cap`), qui n'en ont aucun (et n'en acceptent aucun).
export function renderAlert(input: {
  event: AlertEvent
  subjectId: string | null
  createdAt: Date
}): RenderedEmail {
  if (!Object.hasOwn(ALERT_LINES, input.event)) {
    throw new RangeError('Événement d’alerte inconnu.')
  }
  const lines = [ALERT_LINES[input.event], '']
  if (WITHOUT_SUBJECT.includes(input.event)) {
    if (input.subjectId !== null) throw new RangeError('subjectId doit être nul.')
  } else {
    assertUuid(input.subjectId as string, 'subjectId')
    lines.push(`Identifiant du message${NBSP}: ${input.subjectId}`)
  }
  lines.push(
    `Date${NBSP}: ${formatDate(input.createdAt)}`,
    '',
    'Aucune donnée de demande dans ce message.',
  )
  return { subject: ALERT_SUBJECT, text: lines.join('\n') }
}
