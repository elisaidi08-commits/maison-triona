// Mesure d'un SMS (story 3.12, docs/sms-fournisseur.md §6.3).
// - Alphabet par défaut GSM 03.38 (3GPP TS 23.038) : table de base, un septet par caractère ;
//   table d'extension, deux septets (caractère d'échappement + caractère).
// - Un seul caractère hors de ces deux tables fait passer TOUT le message en UCS-2 : la limite
//   tombe de 160 à 70 unités. En français, les pièges sont â ê î ô û ç œ, « », ’ et les espaces
//   insécables, tous courants dans messages/fr.json.
// - Segments : 160 puis 153 unités en GSM-7 (en-tête de concaténation), 70 puis 67 en UCS-2.
//   Approximation assumée : un caractère d'extension n'est jamais coupé entre deux segments par
//   l'opérateur, ce qui peut ajouter un segment dans de rares cas. Nos gabarits tiennent en un seul.
// Imports relatifs seulement : testé par node --test.

const GSM7_BASE = new Set(
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡' +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà',
)
const GSM7_EXTENSION = new Set('^{}\\[~]|€\f')

export type SmsEncoding = 'gsm7' | 'ucs2'

export interface SmsMeasure {
  encoding: SmsEncoding
  /** Septets en GSM-7, unités UTF-16 en UCS-2. */
  units: number
  segments: number
}

function gsm7Units(text: string): number | null {
  let units = 0
  for (const char of text) {
    if (GSM7_BASE.has(char)) units += 1
    else if (GSM7_EXTENSION.has(char)) units += 2
    else return null
  }
  return units
}

export function measureSms(text: string): SmsMeasure {
  const septets = gsm7Units(text)
  if (septets !== null) {
    return {
      encoding: 'gsm7',
      units: septets,
      segments: septets <= 160 ? 1 : Math.ceil(septets / 153),
    }
  }
  const units = text.length
  return { encoding: 'ucs2', units, segments: units <= 70 ? 1 : Math.ceil(units / 67) }
}
