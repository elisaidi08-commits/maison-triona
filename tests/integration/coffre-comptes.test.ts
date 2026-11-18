import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { creerAuth } from '../../src/lib/auth/auth.ts'
import type { AuthCoffre } from '../../src/lib/auth/auth.ts'
import { CompteRefuse, compterComptes, creerCompte } from '../../src/lib/auth/comptes.ts'
import { migrate } from '../../src/lib/db/migrate.ts'
import { resetDatabase, TEST_DATABASE_URL, testPool } from './helpers.ts'

// Comptes du coffre (story 3.2, partie C) : deux au plus, créés à la main. Comptes factices.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const MOT_DE_PASSE = 'phrase-factice-tres-longue'
const pool = testPool()
const scriptPool = testPool()
let auth: AuthCoffre

function compte(email: string, motDePasse = MOT_DE_PASSE) {
  return { nom: 'Compte factice', email, motDePasse }
}

describe('comptes du coffre', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
    auth = creerAuth(pool, { BETTER_AUTH_SECRET: 'secret-factice-comptes-0123456789-abcdefgh' })
  })
  beforeEach(() => pool.query('TRUNCATE "user" CASCADE'))
  after(() => pool.end())

  it('crée deux comptes au plus', async () => {
    const premier = await creerCompte(auth, pool, compte('Un@Exemple.test'))
    assert.deepEqual(
      { email: premier.email, rang: premier.rang },
      { email: 'un@exemple.test', rang: 1 },
    )
    assert.equal((await creerCompte(auth, pool, compte('deux@exemple.test'))).rang, 2)
    await assert.rejects(creerCompte(auth, pool, compte('trois@exemple.test')), {
      name: 'CompteRefuse',
      message: 'Deux comptes au plus : création refusée',
    })
    assert.equal(await compterComptes(pool), 2)
  })

  it('refuse un troisième compte au niveau de la base, quel que soit le chemin', async () => {
    await creerCompte(auth, pool, compte('un@exemple.test'))
    await creerCompte(auth, pool, compte('deux@exemple.test'))
    await assert.rejects(
      pool.query(
        `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('x', 'X', 'x@exemple.test', false)`,
      ),
      { code: '23514', message: 'Coffre : deux comptes au plus' },
    )
  })

  it('stocke une empreinte du mot de passe, jamais le mot de passe', async () => {
    await creerCompte(auth, pool, compte('empreinte@exemple.test'))
    const { rows } = await pool.query<{ password: string; providerId: string }>(
      'SELECT password, "providerId" FROM account',
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.providerId, 'credential')
    assert.ok(rows[0]?.password && !rows[0].password.includes(MOT_DE_PASSE))
  })

  it('refuse un mot de passe trop court, une adresse invalide ou déjà prise', async () => {
    await assert.rejects(
      creerCompte(auth, pool, compte('court@exemple.test', 'court')),
      (error) => {
        assert.ok(error instanceof CompteRefuse)
        assert.ok(!error.message.includes('court@'))
        return true
      },
    )
    await assert.rejects(creerCompte(auth, pool, compte('pas-une-adresse')), CompteRefuse)
    await creerCompte(auth, pool, compte('pris@exemple.test'))
    await assert.rejects(creerCompte(auth, pool, compte('PRIS@exemple.test')), {
      message: 'Un compte existe déjà pour cette adresse',
    })
    assert.equal(await compterComptes(pool), 1)
  })
})

// Script de création, lancé comme à la main : mot de passe sur l'entrée standard, jamais en argument.
describe('scripts/coffre-compte.mjs', () => {
  const SCRIPT = fileURLToPath(new URL('../../scripts/coffre-compte.mjs', import.meta.url))

  function lancer(args: string[], entree: string) {
    const resultat = spawnSync(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', SCRIPT, ...args],
      {
        input: entree,
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      },
    )
    return { code: resultat.status, sortie: resultat.stdout, erreur: resultat.stderr }
  }

  before(async () => {
    await resetDatabase(scriptPool)
    await migrate(scriptPool, MIGRATIONS)
  })
  after(() => scriptPool.end())

  it('crée deux comptes, puis refuse le troisième', async () => {
    const premier = lancer(
      ['--nom', 'Compte un', '--email', 'un@exemple.test'],
      `${MOT_DE_PASSE}\n`,
    )
    assert.equal(premier.code, 0, premier.erreur)
    assert.match(premier.sortie, /Compte créé : un@exemple\.test \(1 sur 2\)/)
    assert.equal(
      lancer(['--nom', 'Compte deux', '--email', 'deux@exemple.test'], MOT_DE_PASSE).code,
      0,
    )
    const troisieme = lancer(['--nom', 'Trois', '--email', 'trois@exemple.test'], MOT_DE_PASSE)
    assert.equal(troisieme.code, 1)
    assert.match(troisieme.erreur, /Deux comptes au plus/)
    assert.equal(await compterComptes(scriptPool), 2)
  })

  it('refuse un mot de passe passé en argument, sans le recopier', async () => {
    await scriptPool.query('TRUNCATE "user" CASCADE')
    for (const args of [
      ['--nom', 'X', '--email', 'x@exemple.test', '--mot-de-passe', 'secret-factice-en-argument'],
      ['--nom', 'X', '--email', 'x@exemple.test', 'secret-factice-en-argument'],
    ]) {
      const refus = lancer(args, MOT_DE_PASSE)
      assert.equal(refus.code, 1)
      assert.ok(!`${refus.sortie}${refus.erreur}`.includes('secret-factice-en-argument'))
    }
    const court = lancer(['--nom', 'X', '--email', 'x@exemple.test'], 'court\n')
    assert.equal(court.code, 1)
    assert.match(court.erreur, /Mot de passe refusé/)
    assert.equal(await compterComptes(scriptPool), 0)
  })
})
