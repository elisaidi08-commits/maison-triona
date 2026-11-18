import { createHmac } from 'node:crypto'

// Codes TOTP (RFC 6238 : HMAC-SHA1, 6 chiffres, 30 secondes) calculés dans les tests à partir de
// l'URI otpauth, sans dépendance, pour vérifier le second facteur de bout en bout.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32VersOctets(texte: string): Buffer {
  let bits = ''
  for (const caractere of texte.replace(/=+$/, '').toUpperCase()) {
    const valeur = ALPHABET.indexOf(caractere)
    if (valeur < 0) throw new Error('Base32 invalide')
    bits += valeur.toString(2).padStart(5, '0')
  }
  const octets: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8)
    octets.push(Number.parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(octets)
}

export function secretDeLUri(uri: string): string {
  const secret = new URL(uri).searchParams.get('secret')
  if (!secret) throw new Error('URI otpauth sans secret')
  return secret
}

export function codeTotp(secretBase32: string, instant = Date.now()): string {
  const compteur = Buffer.alloc(8)
  compteur.writeBigUInt64BE(BigInt(Math.floor(instant / 30_000)))
  const empreinte = createHmac('sha1', base32VersOctets(secretBase32)).update(compteur).digest()
  const decalage = (empreinte.at(-1) ?? 0) & 0x0f
  const nombre = (empreinte.readUInt32BE(decalage) & 0x7fffffff) % 1_000_000
  return nombre.toString().padStart(6, '0')
}

// Code faux à coup sûr : diffère des codes acceptés (fenêtre de ±1 période chez Better Auth).
export function codeFaux(secretBase32: string): string {
  const acceptes = [-30_000, 0, 30_000].map((ecart) => codeTotp(secretBase32, Date.now() + ecart))
  for (let n = 0; ; n++) {
    const candidat = n.toString().padStart(6, '0')
    if (!acceptes.includes(candidat)) return candidat
  }
}
