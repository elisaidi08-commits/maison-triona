// Configuration des e-mails lue dans l'environnement (story 3.3). L'envoi ne s'allume que si les
// cinq variables sont posées ; sinon `null` : l'envoi est coupé et la demande reste dans le coffre.
// Une configuration à moitié posée est une erreur franche, qui nomme les variables et jamais une
// valeur (aucun secret, aucune adresse dans un message ni dans un journal).
// Imports relatifs seulement : testé par node --test.
import { z } from 'zod'

export interface Mailbox {
  email: string
  name?: string
}

export interface EmailConfig {
  temSecretKey: string
  temProjectId: string
  from: Mailbox
  /** Cat : reçoit la notification minimale. */
  notifyTo: string
  /** Sady : reçoit les alertes techniques. */
  alertTo: string
  /** Origine du site, sans barre finale (lien vers le coffre). */
  siteUrl: string
}

const SENDING_VARIABLES = [
  'TEM_SECRET_KEY',
  'TEM_PROJECT_ID',
  'EMAIL_FROM',
  'EMAIL_NOTIFY_TO',
  'EMAIL_ALERT_TO',
] as const

const emailSchema = z.email()
const uuidSchema = z.uuid()
const FORBIDDEN_IN_NAME = /[<>"\r\n]/
const NAMED_MAILBOX = /^([\s\S]*)<([^<>]*)>\s*$/

function read(env: Record<string, string | undefined>, name: string): string | undefined {
  const value = env[name]?.trim()
  return value ? value : undefined
}

function address(value: string, name: string): string {
  if (!emailSchema.safeParse(value).success) throw new Error(`Adresse e-mail invalide : ${name}`)
  return value
}

function parseFrom(value: string): Mailbox {
  const named = NAMED_MAILBOX.exec(value)
  if (!named) return { email: address(value, 'EMAIL_FROM') }
  const name = (named[1] ?? '').trim()
  const email = address((named[2] ?? '').trim(), 'EMAIL_FROM')
  if (FORBIDDEN_IN_NAME.test(name)) throw new Error('Adresse e-mail invalide : EMAIL_FROM')
  return name ? { email, name } : { email }
}

function parseSiteUrl(value: string, env: Record<string, string | undefined>): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('SITE_URL invalide')
  }
  if (env.VERCEL_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('SITE_URL doit être en https en production')
  }
  return url.origin
}

/** Configuration d'envoi, ou `null` quand aucune variable d'envoi n'est posée. */
export function emailConfigFromEnv(env: Record<string, string | undefined>): EmailConfig | null {
  const values = SENDING_VARIABLES.map((name) => read(env, name))
  if (values.every((value) => value === undefined)) return null

  const missing: string[] = SENDING_VARIABLES.filter((_, index) => values[index] === undefined)
  const siteUrl = read(env, 'SITE_URL')
  if (siteUrl === undefined) missing.push('SITE_URL')
  if (missing.length > 0) {
    throw new Error(`Configuration e-mail incomplète : ${missing.join(', ')}`)
  }

  const [secretKey, projectId, from, notifyTo, alertTo] = values as string[]
  if (!uuidSchema.safeParse(projectId).success) throw new Error('TEM_PROJECT_ID invalide')
  if (!secretKey || /\s/.test(secretKey) || secretKey.length > 200) {
    throw new Error('TEM_SECRET_KEY invalide')
  }
  return {
    temSecretKey: secretKey,
    temProjectId: projectId as string,
    from: parseFrom(from as string),
    notifyTo: address(notifyTo as string, 'EMAIL_NOTIFY_TO'),
    alertTo: address(alertTo as string, 'EMAIL_ALERT_TO'),
    siteUrl: parseSiteUrl(siteUrl as string, env),
  }
}
