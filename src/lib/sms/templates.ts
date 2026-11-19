// Gabarits des SMS de la réservation d'appel (story 3.12, D57, D71 ; docs/sms-fournisseur.md §6).
//
// - Textes du visiteur : `Sms.confirmation` et `Sms.reminder` de messages/{fr,en}.json, en
//   brouillon tant que Cat ne les a pas validés. L'appelant passe le gabarit BRUT (`t.raw`) :
//   ce module ne remplace que `{date}` et `{time}`, et refuse tout autre champ.
// - Garde-fous, vérifiés à chaque rendu (une relecture peut glisser un « ’ » ou rallonger un texte) :
//   · alphabet GSM-7 seulement : apostrophe droite, espaces ordinaires, jamais « » ni espace
//     insécable, pas d'accent circonflexe ni de ç, dates en chiffres (« août » contient un û) ;
//   · 145 unités au plus : un seul segment, avec la marge d'un « STOP » qu'un opérateur ajouterait ;
//   · aucun lien (D71) : le fournisseur garde le texte dans ses journaux ;
//   · le texte commence par « Maison Triona » : en Belgique, l'expéditeur est un numéro court.
// - Rien de la personne : ni nom, ni numéro, ni service. Le SMS s'affiche sur l'écran verrouillé.
// - SMS à Cat (option de la 3.13) : texte interne, en français, sans nom ni numéro (D06).
// Imports relatifs seulement : testé par node --test.
import { measureSms } from './gsm7.ts'

export type SmsLocale = 'fr' | 'en'

export const SMS_MAX_UNITS = 145

const REQUIRED_PREFIX = 'Maison Triona'
const LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|be|fr|lu|mc|ch|eu|net|org)\b/i
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

function assertSendable(text: string): void {
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
  template: string
  locale: SmsLocale
  startsAt: Date
}): string {
  const { date, time } = formatSlot(input.startsAt, input.locale)
  if (typeof input.template !== 'string' || !input.template.startsWith(REQUIRED_PREFIX)) {
    throw new RangeError(`Un SMS commence par « ${REQUIRED_PREFIX} ».`)
  }
  const text = input.template.replaceAll('{date}', date).replaceAll('{time}', time)
  if (/[{}]/.test(text)) throw new RangeError('Champ inconnu dans le gabarit du SMS.')
  assertSendable(text)
  return text
}

export function renderCatSms(input: { startsAt: Date }): string {
  const { date, time } = formatSlot(input.startsAt, 'fr')
  const text = `Nouvel appel ${date} à ${time}.`
  assertSendable(text)
  return text
}
