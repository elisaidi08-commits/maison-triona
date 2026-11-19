import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { emailConfigFromEnv } from '../../src/lib/email/config.ts'

const UUID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
const FULL = {
  TEM_SECRET_KEY: 'secret-key-value-123',
  TEM_PROJECT_ID: UUID,
  EMAIL_FROM: 'Maison Triona <no-reply@maisontriona.com>',
  EMAIL_NOTIFY_TO: 'cat@example.com',
  EMAIL_ALERT_TO: 'sady@example.com',
  SITE_URL: 'https://maisontriona.com/fr/contact',
}

function messageOf(env: Record<string, string | undefined>): string {
  try {
    emailConfigFromEnv(env)
  } catch (error) {
    return (error as Error).message
  }
  assert.fail('une erreur était attendue')
}

describe('emailConfigFromEnv', () => {
  it("renvoie null quand rien n'est posé (envoi coupé)", () => {
    assert.equal(emailConfigFromEnv({}), null)
    assert.equal(
      emailConfigFromEnv({ ...Object.fromEntries(Object.keys(FULL).map((k) => [k, ''])) }),
      null,
    )
    assert.equal(emailConfigFromEnv({ SITE_URL: FULL.SITE_URL }), null)
  })

  it('lit une configuration complète', () => {
    assert.deepEqual(emailConfigFromEnv(FULL), {
      temSecretKey: FULL.TEM_SECRET_KEY,
      temProjectId: UUID,
      from: { email: 'no-reply@maisontriona.com', name: 'Maison Triona' },
      notifyTo: 'cat@example.com',
      alertTo: 'sady@example.com',
      siteUrl: 'https://maisontriona.com',
    })
  })

  it('accepte un expéditeur sans nom', () => {
    const config = emailConfigFromEnv({ ...FULL, EMAIL_FROM: 'no-reply@maisontriona.com' })
    assert.deepEqual(config?.from, { email: 'no-reply@maisontriona.com' })
  })

  it('liste les variables manquantes, SITE_URL en dernier', () => {
    assert.equal(
      messageOf({ TEM_SECRET_KEY: 'x' }),
      'Configuration e-mail incomplète : TEM_PROJECT_ID, EMAIL_FROM, EMAIL_NOTIFY_TO, EMAIL_ALERT_TO, SITE_URL',
    )
    assert.equal(
      messageOf({ ...FULL, EMAIL_FROM: '', SITE_URL: undefined }),
      'Configuration e-mail incomplète : EMAIL_FROM, SITE_URL',
    )
  })

  it('refuse un nom contenant des caractères dangereux', () => {
    for (const name of ['A<B', 'A>B', 'A"B', 'A\rB', 'A\nB', 'A\0B', 'A\tB', 'A\u2028B']) {
      assert.throws(
        () => emailConfigFromEnv({ ...FULL, EMAIL_FROM: `${name} <a@b.com>` }),
        /Adresse e-mail invalide : EMAIL_FROM/,
      )
    }
  })

  it('refuse une adresse invalide en nommant la variable', () => {
    assert.equal(
      messageOf({ ...FULL, EMAIL_NOTIFY_TO: 'pas-une-adresse' }),
      'Adresse e-mail invalide : EMAIL_NOTIFY_TO',
    )
    assert.equal(
      messageOf({ ...FULL, EMAIL_ALERT_TO: 'a@b' }),
      'Adresse e-mail invalide : EMAIL_ALERT_TO',
    )
    assert.equal(
      messageOf({ ...FULL, EMAIL_FROM: 'Nom <nope>' }),
      'Adresse e-mail invalide : EMAIL_FROM',
    )
  })

  it('valide TEM_PROJECT_ID et TEM_SECRET_KEY', () => {
    assert.equal(messageOf({ ...FULL, TEM_PROJECT_ID: 'abc' }), 'TEM_PROJECT_ID invalide')
    assert.equal(messageOf({ ...FULL, TEM_SECRET_KEY: 'a b' }), 'TEM_SECRET_KEY invalide')
    assert.equal(messageOf({ ...FULL, TEM_SECRET_KEY: 'a'.repeat(201) }), 'TEM_SECRET_KEY invalide')
  })

  it("exige https en production et garde l'origine", () => {
    assert.equal(
      messageOf({ ...FULL, SITE_URL: 'http://maisontriona.com', VERCEL_ENV: 'production' }),
      'SITE_URL doit être en https en production',
    )
    assert.equal(
      emailConfigFromEnv({ ...FULL, SITE_URL: 'http://localhost:3000/x/' })?.siteUrl,
      'http://localhost:3000',
    )
    assert.throws(() => emailConfigFromEnv({ ...FULL, SITE_URL: 'pas une url' }), /SITE_URL/)
    assert.equal(messageOf({ ...FULL, SITE_URL: 'ftp://maisontriona.com' }), 'SITE_URL invalide')
    assert.equal(messageOf({ ...FULL, SITE_URL: 'javascript:alert(1)' }), 'SITE_URL invalide')
  })

  it('ne met aucune valeur dans les messages', () => {
    const values = Object.values(FULL).concat(['pas-une-adresse', 'http://maisontriona.com'])
    const cases = [
      { ...FULL, EMAIL_NOTIFY_TO: 'pas-une-adresse' },
      { ...FULL, TEM_PROJECT_ID: 'abc-secret' },
      { ...FULL, TEM_SECRET_KEY: 'a b secret' },
      { ...FULL, SITE_URL: 'http://maisontriona.com', VERCEL_ENV: 'production' },
      { ...FULL, EMAIL_FROM: 'A<B <cat@example.com>' },
      { TEM_SECRET_KEY: FULL.TEM_SECRET_KEY },
    ]
    for (const env of cases) {
      const message = messageOf(env)
      for (const value of [...values, 'abc-secret', 'a b secret']) {
        assert.ok(!message.includes(value), `le message contient une valeur : ${value}`)
      }
    }
  })
})
