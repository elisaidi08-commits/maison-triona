/**
 * Empreintes pour la limitation de débit (story 3.5, docs/architecture.md §6.7) : l'adresse IP et
 * l'adresse e-mail ne sont jamais gardées en clair. HMAC-SHA256 avec un sel du jour, lui-même dérivé
 * du secret du formulaire : deux jours différents donnent deux empreintes sans lien, et sans le
 * secret on ne remonte pas à l'adresse. Fonctions pures, testées par node --test.
 */
import { createHmac } from 'node:crypto'

/** Jour UTC, « 2026-11-18 ». */
export function jourUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function selDuJour(secret: string, date: Date): string {
  return createHmac('sha256', secret)
    .update(`sel:${jourUtc(date)}`)
    .digest('hex')
}

export function empreinte(valeur: string, secret: string, date: Date): string {
  return createHmac('sha256', selDuJour(secret, date))
    .update(valeur.trim().toLowerCase())
    .digest('base64url')
}

/**
 * Réseau d'une adresse IP, pour la limitation de débit : IPv4 telle quelle ; IPv6 réduite à son
 * préfixe /64 (un même abonné en reçoit des milliers, une limite par adresse serait contournée).
 * IPv4 encapsulée (`::ffff:203.0.113.7`) : l'IPv4. Forme illisible : rendue telle quelle.
 */
export function reseauIp(ip: string): string {
  const adresse =
    ip
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, '')
      .split('%')[0] ?? ''
  if (!adresse.includes(':')) return adresse
  const encapsulee = adresse.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (encapsulee?.[1]) return encapsulee[1]

  const morceaux = adresse.split('::')
  if (morceaux.length > 2) return adresse
  const groupes = (partie: string | undefined) => (partie ? partie.split(':') : [])
  // Une IPv4 en fin d'adresse (64:ff9b::192.0.2.1) compte pour deux groupes.
  const taille = (liste: string[]) => liste.reduce((n, g) => n + (g.includes('.') ? 2 : 1), 0)
  const avant = groupes(morceaux[0])
  const apres = groupes(morceaux[1])
  const complets =
    morceaux.length === 2
      ? [
          ...avant,
          ...Array<string>(Math.max(0, 8 - taille(avant) - taille(apres))).fill('0'),
          ...apres,
        ]
      : avant
  const prefixe = complets.slice(0, 4)
  if (prefixe.length < 4 || prefixe.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return adresse
  return `${prefixe.map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`
}
