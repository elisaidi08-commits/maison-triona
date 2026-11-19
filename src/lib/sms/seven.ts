// Transport de SMS par l'API de seven (story 3.12, D71 ; doc lue le 19/11/2026 :
// docs.seven.io/en/rest-api/endpoints/sms).
// - `SmsTransport` est l'interface que le reste du code utilise : un autre fournisseur reste
//   possible sans toucher aux appelants, comme pour `EmailTransport`.
// - Pas de SDK : un `fetch` suffit, et aucune dépendance de plus à auditer.
// - Un destinataire par appel. Aucune option : ni `performance_tracking` (suivi des liens, D71), ni
//   `debug` (il n'évite plus l'envoi depuis décembre 2023 : les essais se font avec une clé de bac à
//   sable), ni `delay` (la boîte d'envoi programme elle-même les messages).
// - `foreign_id` : l'identifiant de notre message dans la boîte d'envoi, jamais une donnée de la
//   personne. seven bloque le même SMS renvoyé dans les 180 s (code 402) : une reprise rapide
//   ne crée pas de doublon.
// - Belgique : l'opérateur remplace le nom d'expéditeur par un numéro court, ou bloque le message
//   `[À VÉRIFIER : question 5 à seven, docs/sms-fournisseur.md §9]`.
// - Aucune journalisation, et rien du corps de la réponse n'est renvoyé, hors l'identifiant validé,
//   le nombre de segments et un code d'une liste fermée : ni numéro, ni texte, ni secret.
// Imports relatifs seulement : testé par node --test.
import { SENDER } from './config.ts'

export interface OutgoingSms {
  /** Numéro au format E.164 (« +32470123456 »). */
  to: string
  text: string
  from: string
  /** Identifiant du message dans notre boîte d'envoi. */
  foreignId: string
}

export type SmsSendResult =
  { ok: true; providerId: string; parts: number } | { ok: false; retryable: boolean; code: string }

export interface SmsTransport {
  send(message: OutgoingSms): Promise<SmsSendResult>
}

const ENDPOINT = 'https://gateway.seven.io/api/sms'
const DEFAULT_TIMEOUT_MS = 10_000
const E164 = /^\+[1-9]\d{6,14}$/
const FOREIGN_ID = /^[A-Za-z0-9.\-_@]{1,64}$/
const PROVIDER_ID = /^\d{1,30}$/

// Codes de retour documentés. Seule l'erreur d'envoi (600) se reprend : les autres demandent une
// action de Sady (crédit, clé, expéditeur) ou concernent le destinataire.
const KNOWN_CODES = new Set([
  '101',
  '201',
  '202',
  '301',
  '305',
  '308',
  '309',
  '401',
  '402',
  '403',
  '407001',
  '407002',
  '407003',
  '407004',
  '407005',
  '500',
  '501',
  '600',
  '603',
  '802',
  '900',
  '901',
  '902',
  '903',
])
const RETRYABLE_CODES = new Set(['600'])

type Failure = { kind: 'http'; status: number } | { kind: 'timeout' | 'network' | 'bad_response' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function refuse(code: string): SmsSendResult {
  return { ok: false, retryable: false, code }
}

/** Appelle seven et renvoie le JSON, ou la cause de l'échec (jamais le corps). */
async function call(
  fetchImpl: typeof fetch,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ ok: true; body: unknown } | { ok: false; failure: Failure }> {
  let response: Response
  try {
    response = await fetchImpl(ENDPOINT, {
      ...init,
      cache: 'no-store',
      // Une redirection refusée est une erreur réseau : la clé ne part jamais ailleurs.
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    return { ok: false, failure: { kind: timedOut ? 'timeout' : 'network' } }
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {})
    return { ok: false, failure: { kind: 'http', status: response.status } }
  }
  // Un 2xx illisible n'est pas repris : seven a peut-être déjà accepté le SMS.
  try {
    return { ok: true, body: await response.json() }
  } catch {
    return { ok: false, failure: { kind: 'bad_response' } }
  }
}

function fromFailure(failure: Failure): SmsSendResult {
  if (failure.kind === 'http') {
    const retryable = failure.status === 429 || failure.status >= 500
    return { ok: false, retryable, code: `http_${failure.status}` }
  }
  return { ok: false, retryable: failure.kind !== 'bad_response', code: failure.kind }
}

function fromBody(body: unknown): SmsSendResult {
  if (!isRecord(body)) return refuse('bad_response')
  const code =
    typeof body.success === 'string' || typeof body.success === 'number' ? String(body.success) : ''
  if (code !== '100') {
    if (code === '407004') return refuse('unsubscribed')
    if (!KNOWN_CODES.has(code)) return refuse('seven_unknown')
    return { ok: false, retryable: RETRYABLE_CODES.has(code), code: `seven_${code}` }
  }
  const messages = body.messages
  const first: unknown = Array.isArray(messages) ? messages[0] : undefined
  if (!isRecord(first)) return refuse('bad_response')
  if (first.success !== true) return refuse('seven_101')
  const id = typeof first.id === 'string' || typeof first.id === 'number' ? String(first.id) : ''
  const parts = first.parts
  if (!PROVIDER_ID.test(id) || typeof parts !== 'number' || !Number.isInteger(parts) || parts < 1) {
    return refuse('bad_response')
  }
  return { ok: true, providerId: id, parts }
}

export function createSevenTransport(options: {
  apiKey: string
  fetch?: typeof fetch
  timeoutMs?: number
}): SmsTransport {
  const fetchImpl = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return {
    async send(message) {
      if (typeof message.to !== 'string' || !E164.test(message.to)) return refuse('bad_number')
      if (typeof message.from !== 'string' || !SENDER.test(message.from))
        return refuse('bad_sender')
      if (typeof message.foreignId !== 'string' || !FOREIGN_ID.test(message.foreignId)) {
        return refuse('bad_foreign_id')
      }
      if (typeof message.text !== 'string' || message.text === '') return refuse('bad_text')

      const result = await call(
        fetchImpl,
        {
          method: 'POST',
          headers: {
            'X-Api-Key': options.apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          // Numéro en chiffres internationaux, sans « + », comme dans les exemples de seven.
          body: JSON.stringify({
            to: message.to.slice(1),
            text: message.text,
            from: message.from,
            foreign_id: message.foreignId,
          }),
        },
        timeoutMs,
      )
      return result.ok ? fromBody(result.body) : fromFailure(result.failure)
    },
  }
}
