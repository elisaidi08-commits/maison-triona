// Transport d'e-mail par l'API de Scaleway Transactional Email (story 3.3).
// - `EmailTransport` est l'interface que le reste du code utilise : un autre prestataire reste
//   possible sans toucher aux appelants (docs/architecture.md §6.6).
// - Pas de SDK, volontairement : un `fetch` suffit, et aucune dépendance de plus à auditer.
// - TEM n'offre pas de clé d'idempotence : un envoi dont la réponse est perdue puis repris peut
//   produire un doublon. Ce risque rare est accepté (décision du 18/11/2026).
// - Aucune journalisation, et rien du corps de la réponse n'est renvoyé, hors l'identifiant validé,
//   l'état déduit et les drapeaux connus : aucune adresse, aucun secret ne peut en sortir.
// Imports relatifs seulement : testé par node --test.
import type { Mailbox } from './config.ts'

export interface OutgoingEmail {
  from: Mailbox
  to: string
  subject: string
  text: string
}

export type SendResult =
  { ok: true; providerId: string } | { ok: false; retryable: boolean; code: string }

export type DeliveryState = 'pending' | 'delivered' | 'undelivered'

export type StatusResult =
  { ok: true; state: DeliveryState; flags: string[] } | { ok: false; code: string }

export interface EmailTransport {
  send(message: OutgoingEmail): Promise<SendResult>
  status(providerId: string): Promise<StatusResult>
}

export const TEM_FLAGS = [
  'soft_bounce',
  'hard_bounce',
  'spam',
  'mailbox_full',
  'mailbox_not_found',
  'greylisted',
  'send_before_expiration',
  'blocklisted',
] as const

const ENDPOINT = 'https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails'
const PROVIDER_ID = /^[A-Za-z0-9._:-]{1,100}$/
const DEFAULT_TIMEOUT_MS = 10_000

const STATE_BY_STATUS: Record<string, DeliveryState> = {
  new: 'pending',
  sending: 'pending',
  unknown: 'pending',
  sent: 'delivered',
  failed: 'undelivered',
  canceled: 'undelivered',
}

type Failure = { kind: 'http'; status: number } | { kind: 'timeout' | 'network' | 'bad_response' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Appelle TEM et renvoie le JSON, ou la cause de l'échec (jamais le corps). */
async function call(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ ok: true; body: unknown } | { ok: false; failure: Failure }> {
  let response: Response
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, failure: { kind: timedOut ? 'timeout' : 'network' } }
  }
  if (!response.ok) return { ok: false, failure: { kind: 'http', status: response.status } }
  try {
    return { ok: true, body: await response.json() }
  } catch {
    return { ok: false, failure: { kind: 'bad_response' } }
  }
}

function codeOf(failure: Failure): string {
  return failure.kind === 'http' ? `http_${failure.status}` : failure.kind
}

export function createTemTransport(options: {
  secretKey: string
  projectId: string
  fetch?: typeof fetch
  timeoutMs?: number
}): EmailTransport {
  const fetchImpl = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    async send(message) {
      const from: Mailbox = message.from.name
        ? { email: message.from.email, name: message.from.name }
        : { email: message.from.email }
      const result = await call(
        fetchImpl,
        ENDPOINT,
        {
          method: 'POST',
          headers: { 'X-Auth-Token': options.secretKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from,
            to: [{ email: message.to }],
            subject: message.subject,
            text: message.text,
            project_id: options.projectId,
          }),
        },
        timeoutMs,
      )
      if (!result.ok) {
        const { failure } = result
        const retryable =
          failure.kind === 'http'
            ? failure.status === 429 || failure.status >= 500
            : failure.kind !== 'bad_response'
        return { ok: false, retryable, code: codeOf(failure) }
      }
      const emails = isRecord(result.body) ? result.body.emails : undefined
      const first: unknown = Array.isArray(emails) ? emails[0] : undefined
      const id = isRecord(first) ? first.id : undefined
      if (typeof id === 'string' && PROVIDER_ID.test(id)) return { ok: true, providerId: id }
      return { ok: false, retryable: false, code: 'bad_response' }
    },

    async status(providerId) {
      if (!PROVIDER_ID.test(providerId)) return { ok: false, code: 'bad_id' }
      const result = await call(
        fetchImpl,
        `${ENDPOINT}/${encodeURIComponent(providerId)}`,
        { method: 'GET', headers: { 'X-Auth-Token': options.secretKey } },
        timeoutMs,
      )
      if (!result.ok) return { ok: false, code: codeOf(result.failure) }
      if (!isRecord(result.body)) return { ok: false, code: 'bad_response' }
      const status = result.body.status
      const state = (typeof status === 'string' ? STATE_BY_STATUS[status] : undefined) ?? 'pending'
      const rawFlags: unknown = result.body.flags
      const known: readonly string[] = TEM_FLAGS
      const flags = Array.isArray(rawFlags)
        ? rawFlags.filter(
            (flag): flag is string => typeof flag === 'string' && known.includes(flag),
          )
        : []
      return { ok: true, state, flags }
    },
  }
}
