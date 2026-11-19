import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTemTransport, TEM_FLAGS } from '../../src/lib/email/tem.ts'

const ENDPOINT = 'https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails'
const SECRET = 'secret-key-value'
const PROJECT = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const LEAK = 'fuite@example.com'

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

const message = {
  from: { email: 'no-reply@maisontriona.com', name: 'Maison Triona' },
  to: 'cat@example.com',
  subject: 'Sujet',
  text: 'Corps',
}

function transport(fetch: typeof globalThis.fetch) {
  return createTemTransport({ secretKey: SECRET, projectId: PROJECT, fetch })
}

describe('TEM send', () => {
  it('envoie la requête attendue et renvoie le providerId', async () => {
    const { fetch, calls } = fakeFetch(() => json({ emails: [{ id: 'abc-123', status: 'new' }] }))
    const result = await transport(fetch).send(message)
    assert.deepEqual(result, { ok: true, providerId: 'abc-123' })
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.url, ENDPOINT)
    assert.equal(calls[0]?.init.method, 'POST')
    const headers = calls[0]?.init.headers as Record<string, string>
    assert.equal(headers['X-Auth-Token'], SECRET)
    assert.equal(headers['Content-Type'], 'application/json')
    assert.ok(calls[0]?.init.signal)
    // Jamais de cache : chaque envoi part, chaque état est relu (Next.js peut mettre fetch en cache).
    assert.equal(calls[0]?.init.cache, 'no-store')
    assert.deepEqual(JSON.parse(calls[0]?.init.body as string), {
      from: { email: 'no-reply@maisontriona.com', name: 'Maison Triona' },
      to: [{ email: 'cat@example.com' }],
      subject: 'Sujet',
      text: 'Corps',
      project_id: PROJECT,
    })
  })

  it('omet from.name quand il est absent', async () => {
    const { fetch, calls } = fakeFetch(() => json({ emails: [{ id: 'x1' }] }))
    await transport(fetch).send({ ...message, from: { email: 'a@b.com' } })
    assert.deepEqual(JSON.parse(calls[0]?.init.body as string).from, { email: 'a@b.com' })
  })

  it('refuse une réponse 2xx sans identifiant valide', async () => {
    for (const body of [{}, { emails: [] }, { emails: [{ id: 5 }] }, { emails: [{ id: 'a b' }] }]) {
      const { fetch } = fakeFetch(() => json(body))
      assert.deepEqual(await transport(fetch).send(message), {
        ok: false,
        retryable: false,
        code: 'bad_response',
      })
    }
    const { fetch } = fakeFetch(() => new Response('pas du json', { status: 200 }))
    assert.deepEqual(await transport(fetch).send(message), {
      ok: false,
      retryable: false,
      code: 'bad_response',
    })
  })

  it('classe les erreurs HTTP', async () => {
    for (const [status, retryable] of [
      [429, true],
      [500, true],
      [503, true],
      [400, false],
      [401, false],
      [403, false],
      [404, false],
    ] as const) {
      const { fetch } = fakeFetch(() => json({ message: LEAK }, status))
      assert.deepEqual(await transport(fetch).send(message), {
        ok: false,
        retryable,
        code: `http_${status}`,
      })
    }
  })

  it('classe le délai dépassé et les erreurs réseau', async () => {
    const timeout = fakeFetch(() => {
      throw new DOMException(`délai ${LEAK}`, 'TimeoutError')
    })
    assert.deepEqual(await transport(timeout.fetch).send(message), {
      ok: false,
      retryable: true,
      code: 'timeout',
    })
    const network = fakeFetch(() => {
      throw new TypeError(`fetch failed ${LEAK}`)
    })
    assert.deepEqual(await transport(network.fetch).send(message), {
      ok: false,
      retryable: true,
      code: 'network',
    })
  })

  it('ne renvoie jamais le corps de la réponse', async () => {
    const bodies = [
      json({ emails: [{ id: 'ok-1', to: LEAK }] }),
      json({ emails: [{ id: LEAK }] }),
      json({ message: LEAK }, 400),
      json({ message: LEAK }, 500),
      new Response(LEAK, { status: 200 }),
    ]
    for (const body of bodies) {
      const { fetch } = fakeFetch(() => body)
      const text = JSON.stringify(await transport(fetch).send(message))
      assert.ok(!text.includes(LEAK), text)
      assert.ok(!text.includes(SECRET), text)
    }
  })
})

describe('TEM status', () => {
  const statusOf = async (body: unknown, httpStatus = 200) => {
    const { fetch, calls } = fakeFetch(() => json(body, httpStatus))
    const result = await transport(fetch).status('abc-123')
    return { result, calls }
  }

  it('interroge GET <endpoint>/<id> avec le jeton', async () => {
    const { calls } = await statusOf({ status: 'sent', flags: [] })
    assert.equal(calls[0]?.url, `${ENDPOINT}/abc-123`)
    assert.equal(calls[0]?.init.method ?? 'GET', 'GET')
    assert.equal((calls[0]?.init.headers as Record<string, string>)['X-Auth-Token'], SECRET)
    assert.equal(calls[0]?.init.cache, 'no-store')
  })

  it("encode l'identifiant dans l'URL", async () => {
    const { fetch, calls } = fakeFetch(() => json({ status: 'sent' }))
    await transport(fetch).status('a:b.c_d-1')
    assert.equal(calls[0]?.url, `${ENDPOINT}/${encodeURIComponent('a:b.c_d-1')}`)
  })

  it('fait correspondre les statuts', async () => {
    const expected: Record<string, string> = {
      new: 'pending',
      sending: 'pending',
      unknown: 'pending',
      sent: 'delivered',
      failed: 'undelivered',
      canceled: 'undelivered',
      autre: 'pending',
    }
    for (const [status, state] of Object.entries(expected)) {
      const { result } = await statusOf({ status, flags: [] })
      assert.deepEqual(result, { ok: true, state, flags: [] }, status)
    }
  })

  it('ne garde que les drapeaux connus', async () => {
    const { result } = await statusOf({
      status: 'failed',
      flags: ['hard_bounce', 'spam', LEAK, 42, 'inconnu'],
    })
    assert.deepEqual(result, { ok: true, state: 'undelivered', flags: ['hard_bounce', 'spam'] })
    assert.equal(TEM_FLAGS.length, 8)
    const none = await statusOf({ status: 'sent' })
    assert.deepEqual(none.result, { ok: true, state: 'delivered', flags: [] })
  })

  it('refuse un identifiant invalide sans requête', async () => {
    const { fetch, calls } = fakeFetch(() => json({}))
    for (const id of ['', 'a/b', 'a b', '../x', 'a'.repeat(101)]) {
      assert.deepEqual(await transport(fetch).status(id), { ok: false, code: 'bad_id' })
    }
    assert.equal(calls.length, 0)
  })

  it('classe les erreurs sans fuite', async () => {
    const http = await statusOf({ message: LEAK }, 404)
    assert.deepEqual(http.result, { ok: false, code: 'http_404' })

    const timeout = fakeFetch(() => {
      throw new DOMException(LEAK, 'TimeoutError')
    })
    assert.deepEqual(await transport(timeout.fetch).status('a1'), { ok: false, code: 'timeout' })
    const network = fakeFetch(() => {
      throw new TypeError(LEAK)
    })
    assert.deepEqual(await transport(network.fetch).status('a1'), { ok: false, code: 'network' })
    const bad = fakeFetch(() => new Response(LEAK, { status: 200 }))
    assert.deepEqual(await transport(bad.fetch).status('a1'), { ok: false, code: 'bad_response' })
    const nonObject = await statusOf(null)
    assert.deepEqual(nonObject.result, { ok: false, code: 'bad_response' })
    for (const r of [http.result, nonObject.result]) {
      assert.ok(!JSON.stringify(r).includes(LEAK))
    }
  })
})

describe('TEM durcissement', () => {
  it('refuse les redirections', async () => {
    const send = fakeFetch(() => json({ emails: [{ id: 'a1' }] }))
    await transport(send.fetch).send(message)
    assert.equal(send.calls[0]?.init.redirect, 'error')
    const status = fakeFetch(() => json({ status: 'sent' }))
    await transport(status.fetch).status('a1')
    assert.equal(status.calls[0]?.init.redirect, 'error')
    const redirected = fakeFetch(() => {
      throw new TypeError('redirect mode is set to error')
    })
    assert.deepEqual(await transport(redirected.fetch).send(message), {
      ok: false,
      retryable: true,
      code: 'network',
    })
  })

  it('ne lit pas le prototype pour le statut', async () => {
    for (const status of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const { fetch } = fakeFetch(() => json({ status }))
      assert.deepEqual(await transport(fetch).status('a1'), {
        ok: true,
        state: 'pending',
        flags: [],
      })
    }
  })

  it('libère le corps des réponses en erreur', async () => {
    for (const status of [400, 500]) {
      let cancelled = 0
      const body = new ReadableStream({
        cancel() {
          cancelled += 1
        },
      })
      const { fetch } = fakeFetch(() => new Response(body, { status }))
      await transport(fetch).send(message)
      assert.equal(cancelled, 1)
      const again = new ReadableStream({
        cancel() {
          cancelled += 1
        },
      })
      const second = fakeFetch(() => new Response(again, { status }))
      await transport(second.fetch).status('a1')
      assert.equal(cancelled, 2)
    }
  })

  it("garde bad_response non repris si la lecture d'un 2xx échoue", async () => {
    const { fetch } = fakeFetch(
      () =>
        ({
          ok: true,
          status: 200,
          body: null,
          json: () => Promise.reject(new DOMException('délai', 'TimeoutError')),
        }) as unknown as Response,
    )
    assert.deepEqual(await transport(fetch).send(message), {
      ok: false,
      retryable: false,
      code: 'bad_response',
    })
  })

  it('refuse un tableau comme corps', async () => {
    const send = fakeFetch(() => json([{ id: 'a1' }]))
    assert.deepEqual(await transport(send.fetch).send(message), {
      ok: false,
      retryable: false,
      code: 'bad_response',
    })
    const status = fakeFetch(() => json([{ status: 'sent' }]))
    assert.deepEqual(await transport(status.fetch).status('a1'), {
      ok: false,
      code: 'bad_response',
    })
  })
})
