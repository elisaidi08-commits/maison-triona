import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { coffrePoolConfigFromEnv, poolConfigFromEnv } from '../../src/lib/db/config.ts'

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
    // Une base qui ne répond pas ne bloque pas l'envoi : échec en 5 s, saisie rendue au visiteur.
    assert.equal(config.connectionTimeoutMillis, 5_000)
    assert.equal(config.statement_timeout, 5_000)
    assert.equal(config.application_name, 'maison-triona')
  })

  it('active TLS strict quand le certificat est fourni', () => {
    const config = poolConfigFromEnv({ DATABASE_URL: URL_WITH_SECRET, DATABASE_CA_CERT: 'CERT' })
    assert.deepEqual(config.ssl, { ca: 'CERT', rejectUnauthorized: true })
  })

  it('exige le certificat sur tout déploiement Vercel, sans révéler l’URL', () => {
    for (const VERCEL_ENV of ['production', 'preview', 'development']) {
      assert.throws(
        () => poolConfigFromEnv({ DATABASE_URL: URL_WITH_SECRET, VERCEL_ENV }),
        (error: Error) => {
          assert.equal(error.message, 'TLS obligatoire sur Vercel : DATABASE_CA_CERT manquant')
          assert.ok(!error.message.includes('motdepasse-factice'))
          return true
        },
        VERCEL_ENV,
      )
    }
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

describe('coffrePoolConfigFromEnv', () => {
  const COFFRE = 'postgres://coffre:motdepasse-coffre-factice@localhost:5432/base'

  it('lit COFFRE_DATABASE_URL, jamais DATABASE_URL', () => {
    assert.throws(() => coffrePoolConfigFromEnv({ DATABASE_URL: URL_WITH_SECRET }), {
      message: 'COFFRE_DATABASE_URL manquante',
    })
    const config = coffrePoolConfigFromEnv({
      COFFRE_DATABASE_URL: COFFRE,
      DATABASE_URL: URL_WITH_SECRET,
    })
    assert.equal(config.connectionString, COFFRE)
    assert.equal(config.application_name, 'maison-triona-coffre')
    assert.equal(config.statement_timeout, 5_000)
  })

  it('exige TLS sur Vercel et refuse le compte du site public, sans citer les URL', () => {
    assert.throws(
      () => coffrePoolConfigFromEnv({ COFFRE_DATABASE_URL: COFFRE, VERCEL_ENV: 'preview' }),
      {
        message: 'TLS obligatoire sur Vercel : DATABASE_CA_CERT manquant',
      },
    )
    assert.throws(
      () =>
        coffrePoolConfigFromEnv({
          COFFRE_DATABASE_URL: URL_WITH_SECRET,
          DATABASE_URL: URL_WITH_SECRET,
          DATABASE_CA_CERT: 'CERT',
          VERCEL_ENV: 'production',
        }),
      (error: Error) => {
        assert.match(error.message, /doit différer de DATABASE_URL/)
        assert.ok(!error.message.includes('motdepasse-factice'))
        return true
      },
    )
  })
})
