/**
 * Invitations d'agenda (story 3.10 ; docs/reservation-appel.md §4.5) : sous-ensemble de RFC 5545,
 * écrit à la main, sans dépendance. Ici, le fichier « Ajouter à mon agenda » de la personne, produit
 * sur le serveur après la réservation : `METHOD:PUBLISH` (un fichier importé, pas une invitation
 * envoyée), heures en UTC (lues par tous les agendas, sans bloc VTIMEZONE), `UID` stable par
 * réservation et par destinataire (`<id>-guest@`, `<id>-host@` pour Cat). Contenu neutre : un titre
 * et une phrase fixes, tirés de messages/*.json ; ni nom de service, ni nom, ni numéro, ni lien (le
 * lien porte un jeton).
 * Story 3.11 : un appel déplacé garde son UID et porte une `SEQUENCE` plus grande (celle de la base,
 * `bookings.sequence`, +1 à chaque déplacement) : l'agenda remplace l'événement au lieu d'en ajouter
 * un. Un appel annulé donne un fichier `METHOD:CANCEL`, `STATUS:CANCELLED`, même UID, séquence de
 * l'annulation : il retire l'événement (RFC 5546 §3.2.5). Toujours un fichier téléchargé, jamais
 * envoyé.
 * Les invitations envoyées par e-mail (`METHOD:REQUEST`, VTIMEZONE Europe/Brussels, ATTENDEE)
 * viendront avec l'envoi (stories 3.3 et 3.12).
 * Imports relatifs seulement : testé par node --test.
 */

/** Domaine des UID (D65). */
export const ICS_DOMAIN = 'maisontriona.com'

/**
 * Organisateur générique de la maison (RFC 5546 : `ORGANIZER` est exigé pour `PUBLISH` et `CANCEL`) :
 * aucune donnée de la personne, aucun nom de Cat. Aucune adresse de la maison n'est encore choisie
 * (D47) : `contact@` [À CONFIRMER par Sady : adresse de la messagerie de la maison].
 */
export const ICS_ORGANIZER = `contact@${ICS_DOMAIN}`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LIGNE_MAX = 75

export interface IcsEvent {
  uid: string
  start: Date
  end: Date
  /** Date de production du fichier (DTSTAMP). */
  stamp: Date
  summary: string
  description: string
  sequence?: number
  /** `PUBLISH` (par défaut) : ajouter ou mettre à jour ; `CANCEL` : retirer l'appel annulé. */
  method?: 'PUBLISH' | 'CANCEL'
}

/** UID stable : une réservation, un destinataire. */
export function bookingUid(bookingId: string, recipient: 'guest' | 'host'): string {
  if (!UUID.test(bookingId)) throw new RangeError('Identifiant de réservation invalide')
  return `${bookingId.toLowerCase()}-${recipient}@${ICS_DOMAIN}`
}

function horodatage(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new RangeError('Date invalide')
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '')
}

// TEXT (RFC 5545 §3.3.11) : antislash, point-virgule, virgule échappés ; retours à la ligne en « \n ».
function texte(valeur: string): string {
  return valeur
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

// Repliement (§3.1) : 75 octets au plus par ligne, suite précédée d'une espace ; jamais au milieu
// d'un caractère UTF-8.
function replier(ligne: string): string {
  const morceaux: string[] = []
  let courant = ''
  let octets = 0
  for (const caractere of ligne) {
    const taille = Buffer.byteLength(caractere, 'utf8')
    const max = morceaux.length === 0 ? LIGNE_MAX : LIGNE_MAX - 1
    if (octets + taille > max) {
      morceaux.push(courant)
      courant = ''
      octets = 0
    }
    courant += caractere
    octets += taille
  }
  morceaux.push(courant)
  return morceaux.join('\r\n ')
}

/** Le fichier .ics d'un appel, lignes terminées par CRLF. */
export function buildIcs(event: IcsEvent): string {
  const debut = horodatage(event.start)
  const fin = horodatage(event.end)
  if (event.end.getTime() <= event.start.getTime()) {
    throw new RangeError('La fin d’un appel suit son début')
  }
  const sequence = event.sequence ?? 0
  if (!Number.isInteger(sequence) || sequence < 0) throw new RangeError('Séquence invalide')
  const method = event.method ?? 'PUBLISH'
  if (method !== 'PUBLISH' && method !== 'CANCEL') throw new RangeError('Méthode invalide')
  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maison Triona//Appel//FR',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `ORGANIZER;CN=Maison Triona:mailto:${ICS_ORGANIZER}`,
    `DTSTAMP:${horodatage(event.stamp)}`,
    `DTSTART:${debut}`,
    `DTEND:${fin}`,
    `SEQUENCE:${sequence}`,
    method === 'CANCEL' ? 'STATUS:CANCELLED' : 'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    `SUMMARY:${texte(event.summary)}`,
    `DESCRIPTION:${texte(event.description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lignes.map(replier).join('\r\n')}\r\n`
}
