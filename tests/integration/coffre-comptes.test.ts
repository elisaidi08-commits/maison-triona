import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { appelerAuth } from '../../src/lib/auth/appel.ts'
import { creerAuth } from '../../src/lib/auth/auth.ts'
import type { AuthCoffre } from '../../src/lib/auth/auth.ts'
import { CompteRefuse, compterComptes, creerCompte } from '../../src/lib/auth/comptes.ts'
import { migrate } from '../../src/lib/db/migrate.ts'
import {
  applyRoles,
  COFFRE_TEST_DATABASE_URL,
  coffrePool,
  resetDatabase,
  testPool,
} from './helpers.ts'

// Comptes du coffre (story 3.2, partie C) : deux au plus, créés à la main. Comptes factices.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const MOT_DE_PASSE = 'phrase-factice-tres-longue'
const pool = testPool()
const coffre = coffrePool()
const scriptPool = testPool()
let auth: AuthCoffre

function compte(email: string, motDePasse = MOT_DE_PASSE) {
  return { nom: 'Compte factice', email, motDePasse }
}

describe('comptes du coffre', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
    await applyRoles(pool)
    auth = creerAuth(coffre, { BETTER_AUTH_SECRET: 'secret-factice-comptes-0123456789-abcdefgh' })
  })
  beforeEach(() => pool.query('TRUNCATE "user" CASCADE'))
  after(async () => {
    await coffre.end()
    await pool.end()
  })

  it('crée deux comptes au plus', async () => {
    const premier = await creerCompte(auth, coffre, compte('Un@Exemple.test'))
    assert.deepEqual(
      { email: premier.email, rang: premier.rang },
      { email: 'un@exemple.test', rang: 1 },
    )
    assert.equal((await creerCompte(auth, coffre, compte('deux@exemple.test'))).rang, 2)
    await assert.rejects(creerCompte(auth, coffre, compte('trois@exemple.test')), {
      name: 'CompteRefuse',
      message: 'Deux comptes au plus : création refusée',
    })
    assert.equal(await compterComptes(coffre), 2)
  })

  it('refuse un troisième compte au niveau de la base, quel que soit le chemin', async () => {
    await creerCompte(auth, coffre, compte('un@exemple.test'))
    await creerCompte(auth, coffre, compte('deux@exemple.test'))
    await assert.rejects(
      coffre.query(
        `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ('x', 'X', 'x@exemple.test', false)`,
      ),
      { code: '23514', message: 'Coffre : deux comptes au plus' },
    )
  })

  it('stocke une empreinte du mot de passe, jamais le mot de passe', async () => {
    await creerCompte(auth, coffre, compte('empreinte@exemple.test'))
    const { rows } = await pool.query<{ password: string; providerId: string }>(
      'SELECT password, "providerId" FROM account',
    )
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.providerId, 'credential')
    assert.ok(rows[0]?.password && !rows[0].password.includes(MOT_DE_PASSE))
  })

  it('refuse un mot de passe trop court, une adresse invalide ou déjà prise', async () => {
    await assert.rejects(
      creerCompte(auth, coffre, compte('court@exemple.test', 'court')),
      (error) => {
        assert.ok(error instanceof CompteRefuse)
        assert.ok(!error.message.includes('court@'))
        return true
      },
    )
    await assert.rejects(creerCompte(auth, coffre, compte('pas-une-adresse')), CompteRefuse)
    await creerCompte(auth, coffre, compte('pris@exemple.test'))
    await assert.rejects(creerCompte(auth, coffre, compte('PRIS@exemple.test')), {
      message: 'Un compte existe déjà pour cette adresse',
    })
    assert.equal(await compterComptes(coffre), 1)
  })
})

// Script des comptes, lancé comme à la main : mot de passe généré, ou saisi sur l'entrée standard,
// jamais en argument ; réenrôlement.
describe('scripts/coffre-compte.mjs', () => {
  const SCRIPT = fileURLToPath(new URL('../../scripts/coffre-compte.mjs', import.meta.url))
  const coffreScript = coffrePool()
  let authScript: AuthCoffre

  function lancer(args: string[], entree = '') {
    const resultat = spawnSync(
      process.execPath,
      ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', SCRIPT, ...args],
      {
        input: entree,
        encoding: 'utf8',
        env: { ...process.env, COFFRE_DATABASE_URL: COFFRE_TEST_DATABASE_URL },
      },
    )
    return { code: resultat.status, sortie: resultat.stdout, erreur: resultat.stderr }
  }

  // Dernière ligne non vide avant la consigne : le mot de passe généré.
  function motDePasseAffiche(sortie: string): string {
    const lignes = sortie.trim().split('\n')
    return lignes.at(-2) ?? ''
  }

  async function connexion(email: string, motDePasse: string) {
    return appelerAuth(
      authScript,
      coffreScript,
      '/sign-in/email',
      { email, password: motDePasse },
      new Headers({ origin: 'http://localhost:3000', 'x-forwarded-for': '198.51.100.7' }),
    )
  }

  before(async () => {
    await resetDatabase(scriptPool)
    await migrate(scriptPool, MIGRATIONS)
    await applyRoles(scriptPool)
    authScript = creerAuth(coffreScript, {
      BETTER_AUTH_SECRET: 'secret-factice-comptes-0123456789-abcdefgh',
    })
  })
  beforeEach(() => scriptPool.query('TRUNCATE "user", "rateLimit", vault_access_log CASCADE'))
  after(async () => {
    await coffreScript.end()
    await scriptPool.end()
  })

  it('génère un mot de passe de 24 caractères au moins, affiché une fois, qui ouvre le compte', async () => {
    const premier = lancer(['--nom', 'Compte un', '--email', 'un@exemple.test'])
    assert.equal(premier.code, 0, premier.erreur)
    assert.match(premier.sortie, /Compte créé : un@exemple\.test \(1 sur 2\)/)
    const motDePasse = motDePasseAffiche(premier.sortie)
    assert.match(motDePasse, /^[a-z2-9]{5}(-[a-z2-9]{5}){5}$/)
    assert.equal((await connexion('un@exemple.test', motDePasse)).statut, 200)
    // Deux lancements, deux mots de passe différents.
    const second = lancer(['--nom', 'Compte deux', '--email', 'deux@exemple.test'])
    assert.notEqual(motDePasseAffiche(second.sortie), motDePasse)
    const troisieme = lancer(['--nom', 'Trois', '--email', 'trois@exemple.test'])
    assert.equal(troisieme.code, 1)
    assert.match(troisieme.erreur, /Deux comptes au plus/)
    assert.equal(await compterComptes(scriptPool), 2)
  })

  it('avec --saisir, lit le mot de passe sur l’entrée standard et le refuse sous 24 caractères', async () => {
    const court = lancer(
      ['--nom', 'X', '--email', 'x@exemple.test', '--saisir'],
      'vingt-trois-caracteres\n',
    )
    assert.equal(court.code, 1)
    assert.match(court.erreur, /Mot de passe refusé : 24 à 128 caractères/)
    const saisi = lancer(
      ['--nom', 'X', '--email', 'x@exemple.test', '--saisir'],
      `${MOT_DE_PASSE}\n`,
    )
    assert.equal(saisi.code, 0, saisi.erreur)
    assert.ok(!saisi.sortie.includes(MOT_DE_PASSE))
    assert.equal((await connexion('x@exemple.test', MOT_DE_PASSE)).statut, 200)
  })

  it('refuse un mot de passe passé en argument, sans le recopier', async () => {
    for (const args of [
      ['--nom', 'X', '--email', 'x@exemple.test', '--mot-de-passe', 'secret-factice-en-argument'],
      ['--nom', 'X', '--email', 'x@exemple.test', 'secret-factice-en-argument'],
    ]) {
      const refus = lancer(args)
      assert.equal(refus.code, 1)
      assert.ok(!`${refus.sortie}${refus.erreur}`.includes('secret-factice-en-argument'))
    }
    assert.equal(await compterComptes(scriptPool), 0)
  })

  it('réenrôle : compte recréé, TOTP, sessions et ancien mot de passe supprimés', async () => {
    const creation = lancer(['--nom', 'Compte réenrôlé', '--email', 're@exemple.test'])
    const ancien = motDePasseAffiche(creation.sortie)
    assert.equal((await connexion('re@exemple.test', ancien)).statut, 200)
    await scriptPool.query(
      `INSERT INTO "twoFactor" (id, secret, "backupCodes", "userId", verified)
       SELECT 'tf', 'secret-chiffre-factice', 'codes-factices', id, true FROM "user"`,
    )

    const reprise = lancer(['--reenroler', '--email', 're@exemple.test'])
    assert.equal(reprise.code, 0, reprise.erreur)
    assert.match(reprise.sortie, /Compte recréé : re@exemple\.test/)
    const nouveau = motDePasseAffiche(reprise.sortie)
    assert.notEqual(nouveau, ancien)

    const { rows } = await scriptPool.query(
      `SELECT u.name, (SELECT count(*)::int FROM "twoFactor") AS totp,
              (SELECT count(*)::int FROM "session") AS sessions
       FROM "user" u`,
    )
    assert.deepEqual(rows, [{ name: 'Compte réenrôlé', totp: 0, sessions: 0 }])
    assert.equal((await connexion('re@exemple.test', ancien)).statut, 401)
    assert.equal((await connexion('re@exemple.test', nouveau)).statut, 200)

    const inconnu = lancer(['--reenroler', '--email', 'absent@exemple.test'])
    assert.equal(inconnu.code, 1)
    assert.match(inconnu.erreur, /Aucun compte pour cette adresse/)
  })
})
