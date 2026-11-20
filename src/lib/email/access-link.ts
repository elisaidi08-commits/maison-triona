// E-mail d'accès de la réservation d'appel (story 3.9 ; docs/reservation-appel.md §2, étape 2) : le
// seul e-mail du site qui part vers un visiteur. Minimal : un lien personnel, sa durée, et rien
// d'autre ; ni nom, ni service, ni situation (la personne n'en a encore rien dit), aucun pixel, aucun
// lien traqué, texte brut seulement.
// - Le sujet reste neutre : Scaleway TEM le garde, avec le destinataire, tant que le domaine est actif,
//   et une boîte partagée en famille l'affiche (D69).
// - Le lien porte le jeton en clair : il ne sort d'ici que vers le transport ; jamais journalisé.
// - Textes en constantes FR et EN (pas dans messages/*.json : rendus hors de Next, par la boîte
//   d'envoi). Typographie : apostrophe ’, espace insécable avant « : » en français.
// [BROUILLON] Textes proposés par Claude (story 3.9), relus par i18n-copy-editor, à valider par Cat :
// check:content les signale tant que cette mention reste.
// Imports relatifs seulement : testé par node --test.
import type { RenderedEmail } from './templates.ts'

export type LangueLien = 'fr' | 'en'

// Espace insécable (U+00A0), comme dans messages/fr.json.
const NBSP = '\u00a0'

// Lien d'une page de réservation, et rien d'autre : origine http(s) sans chemin, puis
// `/<langue>/contact/appel/<jeton de 43 caractères>`.
const CHEMIN_LIEN = /^\/(fr|en)\/contact\/appel\/[A-Za-z0-9_-]{43}$/

const TEXTES: Record<LangueLien, { subject: string; lines: (link: string) => string[] }> = {
  fr: {
    subject: 'Votre lien personnel · Maison Triona',
    lines: (link) => [
      'Bonjour,',
      '',
      `Voici votre lien personnel pour choisir le moment de notre appel${NBSP}:`,
      link,
      '',
      'Il est valable 48 heures. Si vous demandez un nouveau lien, celui-ci ne fonctionnera plus.',
      '',
      `Ce lien vous est réservé${NBSP}: merci de ne pas transférer ce message. Si vous n’avez rien demandé, vous pouvez simplement l’ignorer.`,
      '',
      'Maison Triona',
    ],
  },
  en: {
    subject: 'Your personal link · Maison Triona',
    lines: (link) => [
      'Hello,',
      '',
      'Here is your personal link to choose a time for our call:',
      link,
      '',
      'It is valid for 48 hours. If you ask for a new link, this one will stop working.',
      '',
      'This link is for you alone: please do not forward this message. If you did not ask for it, you can simply ignore it.',
      '',
      'Maison Triona',
    ],
  },
}

/** Vérifie que le lien mène bien à une page de réservation de cette langue. */
export function lienValide(link: string, langue: LangueLien): boolean {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  if (url.username || url.password || url.search || url.hash) return false
  const chemin = CHEMIN_LIEN.exec(url.pathname)
  return chemin !== null && chemin[1] === langue && link === `${url.origin}${url.pathname}`
}

export function renderAccessLink(input: { locale: LangueLien; link: string }): RenderedEmail {
  if (!Object.hasOwn(TEXTES, input.locale)) throw new RangeError('Langue inconnue.')
  if (!lienValide(input.link, input.locale)) throw new RangeError('Lien de réservation invalide.')
  const textes = TEXTES[input.locale]
  return { subject: textes.subject, text: textes.lines(input.link).join('\n') }
}
