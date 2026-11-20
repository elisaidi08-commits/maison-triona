import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createSevenTransport } from '../../src/lib/sms/seven.ts'

const ENDPOINT = 'https://gateway.seven.io/api/sms'
const KEY = 'cle-de-bac-a-sable-0123456789'
const NUMBER = '+32470123456'
const TEXT = "Maison Triona : rappel, nous vous appelons aujourd'hui à 16 h 30."
const FOREIGN_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'

interface Call {
  url: string
  init: RequestInit
}

function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = []
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return respond()
  }) as typeof globalThis.fetch
  return { fetch, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// Réponse de succès recopiée de la doc de seven (docs.seven.io/en/rest-api/endpoints/sms, 19/11/2026).
const accepted = (overrides: Record<string, unknown> = {}) =>
  json({
    success: '100',
    total_price: 0.075,
    balance: 593.994,
    debug: 'false',
    sms_type: 'direct',
    messages: [
      {
        id: '77229318510',
        sender: 'Triona',
        recipient: '32470123456',
        text: TEXT,
        encoding: 'gsm',
        label: null,
        parts: 1,
        udh: null,
        is_binary: false,
        price: 0.075,
        success: true,
        error: null,
        error_text: null,
        ...overrides,
      },
    ],
  })

const message = { to: NUMBER, text: TEXT, from: 'Triona', foreignId: FOREIGN_ID }

function transport(fetch: typeof globalThis.fetch) {
  return createSevenTransport({ apiKey: KEY, fetch })
}

describe('seven send : requête', () => {
  it('envoie un POST JSON authentifié par X-Api-Key, sans cache ni redirection', async () => {
    const { fetch, calls } = fakeFetch(() => accepted())
    await transport(fetch).send(message)
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.url, ENDPOINT)
    const init = calls[0]?.init ?? {}
    assert.equal(init.method, 'POST')
    const headers = init.headers as Record<string, string>
    assert.equal(headers['X-Api-Key'], KEY)
    assert.equal(headers['Content-Type'], 'application/json')
    assert.equal(headers.Accept, 'application/json')
    assert.equal(init.cache, 'no-store')
    assert.equal(init.redirect, 'error')
    assert.ok(init.signal)
  })

  it('envoie le numéro en chiffres internationaux, le texte, l’expéditeur et notre identifiant', async () => {
    const { fetch, calls } = fakeFetch(() => accepted())
    await transport(fetch).send(message)
    assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
      to: '32470123456',
      text: TEXT,
      from: 'Triona',
      foreign_id: FOREIGN_ID,
    })
  })

  it('n’active jamais le suivi des liens ni aucune option (D71)', async () => {
    const { fetch, calls } = fakeFetch(() => accepted())
    await transport(fetch).send(message)
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>
    for (const option of [
      'performance_tracking',
      'debug',
      'flash',
      'get_replies',
      'label',
      'delay',
    ]) {
      assert.ok(!(option in body), option)
    }
  })
})

describe('seven send : durée de validité', () => {
  it('passe la durée de validité en minutes quand elle est donnée (rappel du jour)', async () => {
    const { fetch, calls } = fakeFetch(() => accepted())
    await transport(fetch).send({ ...message, validForMinutes: 120 })
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>
    assert.equal(body.ttl, 120)
  })
})

describe('seven send : réponse', () => {
  it('renvoie l’identifiant de seven et le nombre de segments', async () => {
    const { fetch } = fakeFetch(() => accepted())
    assert.deepEqual(await transport(fetch).send(message), {
      ok: true,
      providerId: '77229318510',
      parts: 1,
    })
  })

  it('ne renvoie jamais le numéro ni le texte, même quand seven les répète', async () => {
    const results = []
    for (const respond of [() => accepted(), () => json({ success: '202', messages: [] })]) {
      const { fetch } = fakeFetch(respond)
      results.push(await transport(fetch).send(message))
    }
    const serialized = JSON.stringify(results)
    assert.ok(!serialized.includes('470123456'))
    assert.ok(!serialized.includes('rappel'))
  })

  it('refuse un identifiant de seven inattendu', async () => {
    const { fetch } = fakeFetch(() => accepted({ id: 'abc<script>' }))
    assert.deepEqual(await transport(fetch).send(message), {
      ok: false,
      retryable: false,
      code: 'bad_response',
    })
  })

  // Codes de retour de seven (même page de la doc).
  for (const [success, retryable, code] of [
    ['600', true, 'seven_600'], // erreur d'envoi
    ['500', false, 'seven_500'], // crédit insuffisant : Sady doit recharger
    ['501', false, 'seven_501'], // plafond de dépenses
    ['900', false, 'seven_900'], // authentification
    ['902', false, 'seven_902'],
    ['201', false, 'seven_201'], // expéditeur invalide
    ['202', false, 'seven_202'], // destinataire invalide
    ['401', false, 'seven_401'], // texte trop long
    ['402', false, 'duplicate'], // même SMS déjà envoyé dans les 180 s : il est parti
    ['403', false, 'seven_403'], // limite du jour pour ce destinataire
    ['407004', false, 'unsubscribed'], // la personne a répondu STOP
    ['101', false, 'seven_101'], // échec pour le destinataire
  ] as const) {
    it(`traduit le code ${success} en ${code}${retryable ? ', à reprendre' : ''}`, async () => {
      const { fetch } = fakeFetch(() => json({ success, messages: [] }))
      assert.deepEqual(await transport(fetch).send(message), { ok: false, retryable, code })
    })
  }

  it('traite un message refusé dans une réponse « 100 » comme un échec du destinataire', async () => {
    const { fetch } = fakeFetch(() => accepted({ success: false, error: '202', id: null }))
    assert.deepEqual(await transport(fetch).send(message), {
      ok: false,
      retryable: false,
      code: 'seven_101',
    })
  })

  it('lit le STOP (407004) placé dans le message d’une réponse « 100 »', async () => {
    const { fetch } = fakeFetch(() => accepted({ success: false, error: '407004', id: null }))
    assert.deepEqual(await transport(fetch).send(message), {
      ok: false,
      retryable: false,
      code: 'unsubscribed',
    })
  })

  it('ramène un code inconnu à seven_unknown, sans le recopier', async () => {
    const { fetch } = fakeFetch(() => json({ success: '<b>999</b>' }))
    assert.deepEqual(await transport(fetch).send(message), {
      ok: false,
      retryable: false,
      code: 'seven_unknown',
    })
  })
})

describe('seven send : pannes', () => {
  for (const [status, retryable] of [
    [429, true],
    [500, true],
    [503, true],
    [400, false],
    [401, false],
  ] as const) {
    it(`HTTP ${status} : ${retryable ? 'à reprendre' : 'définitif'}`, async () => {
      const { fetch } = fakeFetch(() => new Response('corps', { status }))
      assert.deepEqual(await transport(fetch).send(message), {
        ok: false,
        retryable,
        code: `http_${status}`,
      })
    })
  }

  it('erreur réseau : à reprendre', async () => {
    const fetch = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof globalThis.fetch
    assert.deepEqual(await transport(fetch).send(message), {
      ok: false,
      retryable: true,
      code: 'network',
    })
  })

  it('délai dépassé : pas de reprise (seven a peut-être reçu le SMS : pas de doublon)', async () => {
    const fetch = (async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    }) as typeof globalThis.fetch
    assert.deepEqual(await transport(fetch).send(message), {
      ok: false,
      retryable: false,
      code: 'timeout',
    })
  })

  it('corps illisible après un 200 : pas de reprise (le SMS est peut-être parti)', async () => {
    const { fetch } = fakeFetch(() => new Response('pas du json', { status: 200 }))
    assert.deepEqual(await transport(fetch).send(message), {
      ok: false,
      retryable: false,
      code: 'bad_response',
    })
  })
})

describe('seven send : entrées refusées avant tout appel', () => {
  for (const [name, overrides, code] of [
    ['numéro sans indicatif', { to: '0470123456' }, 'bad_number'],
    ['deux numéros', { to: '+32470123456,+32470654321' }, 'bad_number'],
    ['numéro trop court', { to: '+3247' }, 'bad_number'],
    ['expéditeur trop long', { from: 'MaisonTriona' }, 'bad_sender'],
    ['identifiant avec un caractère interdit', { foreignId: 'id avec espace' }, 'bad_foreign_id'],
    ['identifiant trop long', { foreignId: 'a'.repeat(65) }, 'bad_foreign_id'],
    ['texte vide', { text: '' }, 'bad_text'],
    ['texte fait d’espaces', { text: '   ' }, 'bad_text'],
    ['texte hors GSM-7', { text: 'Maison Triona : aujourd’hui.' }, 'bad_text'],
    ['texte de deux segments', { text: 'a'.repeat(161) }, 'bad_text'],
    ['validité nulle', { validForMinutes: 0 }, 'bad_validity'],
    ['validité de 4 minutes', { validForMinutes: 4 }, 'bad_validity'],
    ['validité au-delà de 48 heures', { validForMinutes: 2881 }, 'bad_validity'],
    ['validité non entière', { validForMinutes: 1.5 }, 'bad_validity'],
  ] as const) {
    it(`${name} : ${code}`, async () => {
      const { fetch, calls } = fakeFetch(() => accepted())
      assert.deepEqual(await transport(fetch).send({ ...message, ...overrides }), {
        ok: false,
        retryable: false,
        code,
      })
      assert.equal(calls.length, 0)
    })
  }
})
