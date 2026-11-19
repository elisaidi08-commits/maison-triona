import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { runCronPass } from '../../src/lib/outbox/cron.ts'
import type { OutboxDeps, OutboxRunSummary } from '../../src/lib/outbox/process.ts'

// Secret de test au format de `openssl rand -hex 32` (64 caractères, 32 au moins exigés).
const SECRET = '0123456789abcdef'.repeat(4)
const SENDING_ENV = {
  CRON_SECRET: SECRET,
  TEM_SECRET_KEY: 'cle-tem-secrete',
  TEM_PROJECT_ID: '11111111-1111-4111-8111-111111111111',
  EMAIL_FROM: 'Maison Triona <contact@example.com>',
  EMAIL_NOTIFY_TO: 'cat@example.com',
  EMAIL_ALERT_TO: 'sady@example.com',
  SITE_URL: 'https://example.com',
}
const SUMMARY: OutboxRunSummary = {
  sent: 1,
  retried: 2,
  failed: 0,
  exhausted: 0,
  delivered: 3,
  undelivered: 0,
  purged: 4,
  errors: 0,
}
const AUTH = `Bearer ${SECRET}`

function setup(over: {
  authorization?: string | null
  env?: Record<string, string | undefined>
  createDeps?: () => OutboxDeps
  run?: () => Promise<OutboxRunSummary>
}) {
  const logs: string[] = []
  let created = 0
  let ran = 0
  const input = {
    authorization: over.authorization === undefined ? AUTH : over.authorization,
    env: over.env ?? SENDING_ENV,
    createDeps: () => {
      created++
      return over.createDeps ? over.createDeps() : ({} as OutboxDeps)
    },
    run: async () => {
      ran++
      return over.run ? over.run() : SUMMARY
    },
    log: (s: string) => logs.push(s),
  }
  return { input, logs, counts: () => ({ created, ran }) }
}

describe('runCronPass', () => {
  test('non autorisé : 401, journal rejected:cron, rien d’exécuté', async () => {
    const t = setup({ authorization: 'Bearer faux' })
    assert.deepEqual(await runCronPass(t.input), { status: 401, body: null })
    assert.deepEqual(t.logs, ['rejected:cron'])
    assert.deepEqual(t.counts(), { created: 0, ran: 0 })
  })
  test('en-tête absent : 401', async () => {
    const t = setup({ authorization: null })
    assert.equal((await runCronPass(t.input)).status, 401)
  })
  test('secret absent de l’environnement : 401', async () => {
    const t = setup({ env: { ...SENDING_ENV, CRON_SECRET: undefined } })
    assert.equal((await runCronPass(t.input)).status, 401)
  })
  test('secret de moins de 32 caractères ou avec une espace : 401, même avec l’en-tête exact', async () => {
    for (const secret of ['a'.repeat(16), 'a'.repeat(31), `${'a'.repeat(16)} ${'a'.repeat(16)}`]) {
      const t = setup({
        authorization: `Bearer ${secret}`,
        env: { ...SENDING_ENV, CRON_SECRET: secret },
      })
      assert.deepEqual(await runCronPass(t.input), { status: 401, body: null }, secret)
      assert.deepEqual(t.logs, ['rejected:cron'])
      assert.deepEqual(t.counts(), { created: 0, ran: 0 })
    }
  })
  test('secret de 32 caractères exactement : accepté', async () => {
    const secret = 'a'.repeat(32)
    const t = setup({
      authorization: `Bearer ${secret}`,
      env: { ...SENDING_ENV, CRON_SECRET: secret },
    })
    assert.deepEqual(await runCronPass(t.input), { status: 200, body: SUMMARY })
  })
  test('envoi coupé : 204 sans rien exécuter', async () => {
    const t = setup({ env: { CRON_SECRET: SECRET } })
    assert.deepEqual(await runCronPass(t.input), { status: 204, body: null })
    assert.deepEqual(t.counts(), { created: 0, ran: 0 })
  })
  test('configuration partielle : 503, failed:config', async () => {
    const t = setup({ env: { CRON_SECRET: SECRET, TEM_SECRET_KEY: 'x' } })
    assert.deepEqual(await runCronPass(t.input), { status: 503, body: null })
    assert.deepEqual(t.logs, ['failed:config'])
  })
  test('createDeps lève : 503, failed:config', async () => {
    const t = setup({
      createDeps: () => {
        throw new Error('ENVOI_DATABASE_URL manquante')
      },
    })
    assert.deepEqual(await runCronPass(t.input), { status: 503, body: null })
    assert.deepEqual(t.logs, ['failed:config'])
    assert.deepEqual(t.counts(), { created: 1, ran: 0 })
  })
  test('run rejette : 500, failed:run', async () => {
    const t = setup({ run: () => Promise.reject(new Error('connexion refusée')) })
    assert.deepEqual(await runCronPass(t.input), { status: 500, body: null })
    assert.deepEqual(t.logs, ['failed:run'])
  })
  test('succès : 200 avec le résumé, aucun journal', async () => {
    const t = setup({})
    assert.deepEqual(await runCronPass(t.input), { status: 200, body: SUMMARY })
    assert.deepEqual(t.logs, [])
  })
  test('ni le secret ni un message d’erreur dans le journal', async () => {
    for (const t of [
      setup({ authorization: `Bearer ${SECRET}x` }),
      setup({ env: { CRON_SECRET: SECRET, TEM_SECRET_KEY: 'x' } }),
      setup({
        createDeps: () => {
          throw new Error(`boom ${SECRET}`)
        },
      }),
      setup({ run: () => Promise.reject(new Error(`boom ${SECRET}`)) }),
    ]) {
      await runCronPass(t.input)
      for (const l of t.logs) {
        assert.ok(!l.includes(SECRET) && !l.includes('boom') && !l.includes('Bearer'))
      }
    }
  })
})
