// Configuration des SMS lue dans l'environnement (story 3.12, D71 : seven, expéditeur « Triona »).
// Les SMS ne s'allument que si les deux variables sont posées ; sinon `null` : aucun SMS ne part,
// et la case « Me prévenir aussi par SMS » reste masquée (`BOOKING_SMS_OPT_IN`).
// Une configuration à moitié posée est une erreur franche, qui nomme la variable et jamais une
// valeur (aucun secret dans un message ni dans un journal).
// Imports relatifs seulement : testé par node --test.

export interface SmsConfig {
  /** Clé d'API de seven (en-tête `X-Api-Key`). */
  apiKey: string
  /** Nom d'expéditeur. En Belgique, l'opérateur le remplace par un numéro court. */
  sender: string
}

const VARIABLES = ['SEVEN_API_KEY', 'SMS_SENDER'] as const

// Charte af2m (France) : lettres latines et chiffres, 11 au plus, sans espace ni caractère spécial ;
// au moins une lettre et 3 caractères (règle courante des fournisseurs, docs/sms-fournisseur.md §3).
const SENDER = /^(?=.*[A-Za-z])[A-Za-z0-9]{3,11}$/
const API_KEY = /^[^\s\p{Cc}]+$/u

function read(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[name]?.trim()
  return value ? value : undefined
}

export function readSmsConfig(env: Record<string, string | undefined>): SmsConfig | null {
  const values = VARIABLES.map((name) => read(env, name))
  if (values.every((value) => value === undefined)) return null
  const missing = VARIABLES.filter((_, index) => values[index] === undefined)
  if (missing.length > 0) {
    throw new Error(`Configuration des SMS incomplète : ${missing.join(', ')} manquante.`)
  }
  const [apiKey, sender] = values as [string, string]
  if (!API_KEY.test(apiKey)) throw new Error('Valeur invalide : SEVEN_API_KEY')
  if (!SENDER.test(sender)) {
    throw new Error('Valeur invalide : SMS_SENDER (3 à 11 lettres ou chiffres, dont une lettre)')
  }
  return { apiKey, sender }
}
