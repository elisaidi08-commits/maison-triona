// Gabarits des SMS de la réservation d'appel (story 3.12, D57, D71 ; docs/sms-fournisseur.md §6).
//
// [BROUILLON] Textes relus par i18n-copy-editor le 19/11/2026, à valider par Cat : check:content
// bloque l'ouverture tant que ce marqueur reste.
//
// - Les textes sont des constantes de ce module, comme les e-mails internes (src/lib/email) :
//   l'appelant choisit le type de SMS, la langue et le créneau, jamais le texte. Aucune donnée de
//   la personne ne peut donc y entrer (relecture sécurité du 19/11/2026).
// - Garde-fous, vérifiés à chaque rendu et par les tests :
//   · alphabet GSM-7 seulement : apostrophe droite, espaces ordinaires, jamais « » ni espace
//     insécable, pas d'accent circonflexe ni de ç, dates en chiffres (« août » contient un û) ;
//   · 145 unités au plus : un seul segment, avec la marge d'un « STOP » qu'un opérateur ajouterait ;
//   · aucun lien (D71) : le fournisseur garde le texte dans ses journaux, et un téléphone rend
//     cliquable tout ce qui ressemble à une adresse ;
//   · le texte commence par « Maison Triona » : en Belgique, l'expéditeur est un numéro court.
// - Rien de la personne ni du service : le SMS s'affiche sur l'écran verrouillé.
// - SMS à Cat (option de la 3.13) : texte interne, en français, sans nom ni numéro (D06).
// Imports relatifs seulement : testé par node --test.
import { measureSms } from './gsm7.ts'

export type SmsLocale = 'fr' | 'en'
export type SmsKind = 'confirmation' | 'reminder'

export const SMS_MAX_UNITS = 145

export const SMS_TEMPLATES: Readonly<Record<SmsLocale, Readonly<Record<SmsKind, string>>>> = {
  fr: {
    confirmation:
      "Maison Triona : votre appel est convenu pour le {date} à {time}. Pour le déplacer ou l'annuler, suivez le lien de notre e-mail.",
    reminder:
      "Maison Triona : comme convenu, nous vous appelons aujourd'hui à {time}. Pour déplacer ou annuler l'appel, suivez le lien de notre e-mail.",
  },
  en: {
    confirmation:
      'Maison Triona: your call is arranged for {date} at {time}. To rearrange or cancel, please use the link in our email.',
    reminder:
      'Maison Triona: as arranged, we will call you today at {time}. To rearrange or cancel, please use the link in our email.',
  },
}

const REQUIRED_PREFIX = 'Maison Triona'
// Schéma (« :// »), « www », adresse (« @ ») ou point suivi d'une lettre (« bit.ly », « santé.fr ») :
// nos textes n'ont de point qu'en fin de phrase, suivi d'une espace.
const LINK = /:\/\/|www|@|\.\p{L}/iu
const TIME_ZONE = 'Europe/Brussels'

const FORMATS: Record<SmsLocale, Intl.DateTimeFormat> = {
  fr: new Intl.DateTimeFormat('fr-BE', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }),
  en: new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: 'h23',
  }),
}

// FR : « mercredi 25/11 », « 16 h 30 ». EN : « Wednesday 25/11 », « 16:30 ». Heure de Bruxelles.
function formatSlot(startsAt: Date, locale: SmsLocale): { date: string; time: string } {
  if (!Object.hasOwn(FORMATS, locale)) throw new RangeError('Langue inconnue.')
  if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) {
    throw new RangeError('Date invalide.')
  }
  const parts: Record<string, string> = {}
  for (const part of FORMATS[locale].formatToParts(startsAt)) parts[part.type] = part.value
  const hour = String(Number(parts.hour))
  return {
    date: `${parts.weekday} ${parts.day}/${parts.month}`,
    time: locale === 'fr' ? `${hour} h ${parts.minute}` : `${hour}:${parts.minute}`,
  }
}

/** Lève une RangeError si le texte ne peut pas partir tel quel. Le message ne cite jamais le texte. */
export function assertSendableSms(text: string): void {
  if (typeof text !== 'string' || !text.startsWith(REQUIRED_PREFIX)) {
    throw new RangeError(`Un SMS commence par « ${REQUIRED_PREFIX} ».`)
  }
  if (LINK.test(text)) throw new RangeError('Un SMS ne contient aucun lien (D71).')
  const { encoding, units } = measureSms(text)
  if (encoding !== 'gsm7') {
    const char = [...text].find((c) => measureSms(c).encoding !== 'gsm7') ?? ''
    const code = char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0')
    throw new RangeError(`Caractère hors GSM-7 (U+${code}).`)
  }
  if (units > SMS_MAX_UNITS) {
    throw new RangeError(`SMS trop long : ${units} unités pour ${SMS_MAX_UNITS} au plus.`)
  }
}

export function renderBookingSms(input: {
  kind: SmsKind
  locale: SmsLocale
  startsAt: Date
}): string {
  const { date, time } = formatSlot(input.startsAt, input.locale)
  const templates = SMS_TEMPLATES[input.locale]
  if (!Object.hasOwn(templates, input.kind)) throw new RangeError('Type de SMS inconnu.')
  const text = templates[input.kind].replaceAll('{date}', date).replaceAll('{time}', time)
  assertSendableSms(text)
  return text
}

export function renderCatSms(input: { startsAt: Date }): string {
  const { date, time } = formatSlot(input.startsAt, 'fr')
  const text = `${REQUIRED_PREFIX} : nouvel appel ${date} à ${time}.`
  assertSendableSms(text)
  return text
}
