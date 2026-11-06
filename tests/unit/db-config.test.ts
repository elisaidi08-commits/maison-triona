import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { poolConfigFromEnv } from '../../src/lib/db/config.ts'

const URL_WITH_SECRET = 'postgres://user:motdepasse-factice@localhost:5432/base'

describe('poolConfigFromEnv', () => {
  it('refuse une DATABASE_URL absente ou vide', () => {
    assert.throws(() => poolConfigFromEnv({}), { message: 'DATABASE_URL manquante' })
    assert.throws(() => poolConfigFromEnv({ DATABASE_URL: '' }), {
      message: 'DATABASE_URL manquante',
    })
  })

  it('désactive TLS hors production sans certificat', () => {
    const config = poolConfigFromEnv({ DATABASE_URL: URL_WITH_SECRET })
    assert.equal(config.ssl, false)
    assert.equal(config.connectionString, URL_WITH_SECRET)
    assert.equal(config.max, 5)
    assert.equal(config.idleTimeoutMillis, 10_000)
    assert.equal(config.application_name, 'maison-triona')
  })

  it('active TLS strict quand le certificat est fourni', () => {
    const config = poolConfigFromEnv({ DATABASE_URL: URL_WITH_SECRET, DATABASE_CA_CERT: 'CERT' })
    assert.deepEqual(config.ssl, { ca: 'CERT', rejectUnauthorized: true })
  })

  it('exige le certificat en production, sans révéler l’URL', () => {
    assert.throws(
      () => poolConfigFromEnv({ DATABASE_URL: URL_WITH_SECRET, VERCEL_ENV: 'production' }),
      (error: Error) => {
        assert.equal(error.message, 'TLS obligatoire en production : DATABASE_CA_CERT manquant')
        assert.ok(!error.message.includes('motdepasse-factice'))
        return true
      },
    )
  })

  it('accepte la production avec certificat', () => {
    const config = poolConfigFromEnv({
      DATABASE_URL: URL_WITH_SECRET,
      DATABASE_CA_CERT: 'CERT',
      VERCEL_ENV: 'production',
    })
    assert.deepEqual(config.ssl, { ca: 'CERT', rejectUnauthorized: true })
  })
})
