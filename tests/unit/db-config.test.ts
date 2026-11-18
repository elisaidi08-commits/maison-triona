import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  coffrePoolConfigFromEnv,
  envoiPoolConfigFromEnv,
  poolConfigFromEnv,
} from '../../src/lib/db/config.ts'

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

describe('envoiPoolConfigFromEnv', () => {
  const ENVOI = 'postgres://envoi:motdepasse-envoi-factice@localhost:5432/base'
  const COFFRE = 'postgres://coffre:motdepasse-coffre-factice@localhost:5432/base'

  it('refuse une ENVOI_DATABASE_URL absente ou vide', () => {
    assert.throws(() => envoiPoolConfigFromEnv({ DATABASE_URL: URL_WITH_SECRET }), {
      message: 'ENVOI_DATABASE_URL manquante',
    })
    assert.throws(() => envoiPoolConfigFromEnv({ ENVOI_DATABASE_URL: '' }), {
      message: 'ENVOI_DATABASE_URL manquante',
    })
  })

  it('lit ENVOI_DATABASE_URL avec les mêmes délais que les autres comptes', () => {
    const config = envoiPoolConfigFromEnv({ ENVOI_DATABASE_URL: ENVOI })
    assert.equal(config.connectionString, ENVOI)
    assert.equal(config.application_name, 'maison-triona-envoi')
    assert.equal(config.ssl, false)
    assert.equal(config.max, 5)
    assert.equal(config.connectionTimeoutMillis, 5_000)
    assert.equal(config.statement_timeout, 5_000)
    assert.deepEqual(
      envoiPoolConfigFromEnv({ ENVOI_DATABASE_URL: ENVOI, DATABASE_CA_CERT: 'CERT' }).ssl,
      { ca: 'CERT', rejectUnauthorized: true },
    )
  })

  it('refuse sur Vercel le compte du site public ou du coffre, sans citer les URL', () => {
    for (const autre of [{ DATABASE_URL: ENVOI }, { COFFRE_DATABASE_URL: ENVOI }]) {
      assert.throws(
        () =>
          envoiPoolConfigFromEnv({
            ENVOI_DATABASE_URL: ENVOI,
            ...autre,
            DATABASE_CA_CERT: 'CERT',
            VERCEL_ENV: 'production',
          }),
        (error: Error) => {
          assert.equal(error.message, 'ENVOI_DATABASE_URL doit différer des autres comptes')
          assert.ok(!error.message.includes('motdepasse'))
          return true
        },
      )
    }
    const config = envoiPoolConfigFromEnv({
      ENVOI_DATABASE_URL: ENVOI,
      DATABASE_URL: URL_WITH_SECRET,
      COFFRE_DATABASE_URL: COFFRE,
      DATABASE_CA_CERT: 'CERT',
      VERCEL_ENV: 'production',
    })
    assert.equal(config.connectionString, ENVOI)
  })
})
