import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  autorisationCron,
  CRON_SECRET_MIN,
  secretCron,
  verifierCronAuBuild,
} from '../../src/lib/security/cron.ts'

// Secret des tâches planifiées (conservation, story 3.2 D ; boîte d'envoi, story 3.3) :
// `Authorization: Bearer <CRON_SECRET>`, comparé à temps constant, refusé sans secret.

const SECRET = 'a'.repeat(31) + 'Z' + '0123456789abcdef'
const ENV = { CRON_SECRET: SECRET }

describe('secret de la tâche planifiée', () => {
  it('accepte exactement « Bearer <secret> »', () => {
    assert.equal(autorisationCron(`Bearer ${SECRET}`, ENV), true)
  })

  it('refuse tout le reste : absent, autre schéma, casse, espace, préfixe, suffixe', () => {
    for (const entete of [
      null,
      undefined,
      '',
      SECRET,
      `bearer ${SECRET}`,
      `Bearer  ${SECRET}`,
      `Bearer ${SECRET} `,
      ` Bearer ${SECRET}`,
      `Basic ${SECRET}`,
      `Bearer ${SECRET.slice(0, -1)}`,
      `Bearer ${SECRET}x`,
      `Bearer ${SECRET.toUpperCase()}`,
      'Bearer ',
    ]) {
      assert.equal(autorisationCron(entete, ENV), false, String(entete))
    }
  })

  it('refuse tout appel quand le secret manque, même un en-tête « Bearer » vide', () => {
    for (const env of [{}, { CRON_SECRET: '' }, { CRON_SECRET: undefined }]) {
      assert.equal(secretCron(env), null)
      assert.equal(autorisationCron('Bearer ', env), false)
      assert.equal(autorisationCron('Bearer undefined', env), false)
      assert.equal(autorisationCron('Bearer null', env), false)
    }
  })

  it('refuse un secret trop court ou qui ne tient pas dans un en-tête', () => {
    assert.equal(CRON_SECRET_MIN, 32)
    for (const secret of [
      'x'.repeat(31),
      `${'x'.repeat(32)} `,
      `${'x'.repeat(16)} ${'x'.repeat(16)}`,
      `${'x'.repeat(32)}\n`,
      `${'é'.repeat(32)}`,
    ]) {
      assert.equal(secretCron({ CRON_SECRET: secret }), null, JSON.stringify(secret))
      assert.equal(autorisationCron(`Bearer ${secret}`, { CRON_SECRET: secret }), false)
    }
    assert.equal(secretCron({ CRON_SECRET: 'x'.repeat(32) }), 'x'.repeat(32))
  })

  it('compare à temps constant (empreintes SHA-256 et timingSafeEqual, jamais ===)', () => {
    const source = readFileSync(
      fileURLToPath(new URL('../../src/lib/security/cron.ts', import.meta.url)),
      'utf8',
    )
    assert.match(
      source,
      /timingSafeEqual\(empreinte\(entete\), empreinte\(`Bearer \$\{secret\}`\)\)/,
    )
    assert.doesNotMatch(source, /entete\s*={2,3}|={2,3}\s*`Bearer/)
  })
})

describe('planification (vercel.json)', () => {
  it('appelle la conservation une fois par jour et l’envoi toutes les 5 minutes, rien d’autre', () => {
    const config = JSON.parse(
      readFileSync(fileURLToPath(new URL('../../vercel.json', import.meta.url)), 'utf8'),
    ) as { crons?: { path: string; schedule: string }[] }
    assert.deepEqual(
      config.crons?.map((cron) => cron.path),
      ['/api/cron/retention', '/api/cron/envoi'],
    )
    // Minute et heure fixes, tous les jours (UTC chez Vercel) : une fois par jour exactement.
    assert.match(config.crons?.[0]?.schedule ?? '', /^([0-5]?\d) ([01]?\d|2[0-3]) \* \* \*$/)
    // Boîte d'envoi (story 3.3) : reprises et suivi de la livraison toutes les 5 minutes.
    assert.equal(config.crons?.[1]?.schedule, '*/5 * * * *')
  })
})

describe('garde du build', () => {
  const COFFRE = 'postgres://compte:mot-de-passe@exemple.test:5432/base'
  // Clé d'API TEM factice (story 3.3) : l'envoi des e-mails est configuré dès qu'elle est posée.
  const TEM = 'cle-tem-factice-0123456789'

  function refuse(env: Record<string, string | undefined>): void {
    assert.throws(
      () => verifierCronAuBuild(env),
      (error: unknown) =>
        error instanceof Error &&
        error.message.includes('CRON_SECRET') &&
        error.message.includes('COFFRE_DATABASE_URL') &&
        error.message.includes('TEM_SECRET_KEY') &&
        !error.message.includes('mot-de-passe') &&
        !error.message.includes(TEM) &&
        !error.message.includes('court'),
      JSON.stringify(env),
    )
  }

  it('échoue en production quand le coffre est configuré sans CRON_SECRET valable', () => {
    for (const env of [
      { VERCEL_ENV: 'production', COFFRE_DATABASE_URL: COFFRE },
      { VERCEL_ENV: 'production', COFFRE_DATABASE_URL: COFFRE, CRON_SECRET: '' },
      { VERCEL_ENV: 'production', COFFRE_DATABASE_URL: COFFRE, CRON_SECRET: 'court' },
    ]) {
      refuse(env)
    }
  })

  it('échoue en production quand les e-mails sont configurés sans CRON_SECRET valable (3.3)', () => {
    for (const env of [
      { VERCEL_ENV: 'production', TEM_SECRET_KEY: TEM },
      { VERCEL_ENV: 'production', TEM_SECRET_KEY: TEM, CRON_SECRET: '' },
      { VERCEL_ENV: 'production', TEM_SECRET_KEY: TEM, CRON_SECRET: 'court' },
      // L'ancien minimum de la story 3.3 (16 caractères) ne suffit plus.
      { VERCEL_ENV: 'production', TEM_SECRET_KEY: TEM, CRON_SECRET: 'a'.repeat(16) },
      { VERCEL_ENV: 'production', TEM_SECRET_KEY: TEM, CRON_SECRET: 'a'.repeat(31) },
      { VERCEL_ENV: 'production', TEM_SECRET_KEY: ` ${TEM} ` },
      { VERCEL_ENV: 'production', COFFRE_DATABASE_URL: COFFRE, TEM_SECRET_KEY: TEM },
    ]) {
      refuse(env)
    }
  })

  it('laisse passer tout le reste : secret valable, aperçu public sans coffre ni envoi, aperçu, poste local', () => {
    for (const env of [
      { VERCEL_ENV: 'production', COFFRE_DATABASE_URL: COFFRE, CRON_SECRET: SECRET },
      { VERCEL_ENV: 'production', TEM_SECRET_KEY: TEM, CRON_SECRET: SECRET },
      {
        VERCEL_ENV: 'production',
        COFFRE_DATABASE_URL: COFFRE,
        TEM_SECRET_KEY: TEM,
        CRON_SECRET: SECRET,
      },
      { VERCEL_ENV: 'production' },
      { VERCEL_ENV: 'production', COFFRE_DATABASE_URL: '  ' },
      { VERCEL_ENV: 'production', TEM_SECRET_KEY: '' },
      { VERCEL_ENV: 'production', TEM_SECRET_KEY: '  ', COFFRE_DATABASE_URL: '' },
      { VERCEL_ENV: 'preview', COFFRE_DATABASE_URL: COFFRE },
      { VERCEL_ENV: 'preview', TEM_SECRET_KEY: TEM },
      { COFFRE_DATABASE_URL: COFFRE },
      { TEM_SECRET_KEY: TEM },
      {},
    ]) {
      assert.doesNotThrow(() => verifierCronAuBuild(env), JSON.stringify(env))
    }
  })
})
