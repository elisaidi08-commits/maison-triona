import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import pg from 'pg'

import { CHEMINS_AUTORISES, creerAuth } from '../../src/lib/auth/auth.ts'
import { genererMotDePasse } from '../../src/lib/auth/comptes.ts'
import { acteurLimitation, cheminAuth } from '../../src/lib/auth/enveloppe.ts'
import {
  BASE_PATH_AUTH,
  DELAI_ENROLEMENT_S,
  DISJONCTEUR_ECHECS,
  FENETRE_FREIN_S,
  MOT_DE_PASSE_MIN,
  VERROU_COMPTE_ECHECS,
  DUREE_MAX_SESSION_S,
  INACTIVITE_MAX_S,
  MAX_COMPTES,
  parametresAuth,
  peutCreerCompte,
  secretAuth,
  urlAuth,
} from '../../src/lib/auth/config.ts'
import { evaluerSession } from '../../src/lib/auth/session.ts'

// Configuration de l'authentification du coffre (story 3.2, partie C). Aucune base n'est jointe :
// le pool pointe vers un port fermé et n'est jamais interrogé.
const SECRET_FACTICE = 'secret-factice-de-test-0123456789-abcdefghijkl'
const poolFactice = () => new pg.Pool({ connectionString: 'postgres://localhost:1/aucune_test' })

describe('secret de Better Auth', () => {
  it('refuse un secret absent ou trop court hors poste local, sans citer la valeur', () => {
    for (const env of [
      { VERCEL_ENV: 'production' },
      { VERCEL_ENV: 'preview', BETTER_AUTH_SECRET: 'court-factice' },
    ]) {
      assert.throws(
        () => secretAuth(env),
        (error: Error) => {
          assert.match(error.message, /BETTER_AUTH_SECRET manquant ou trop court/)
          assert.ok(!error.message.includes('court-factice'))
          return true
        },
      )
    }
  })

  it('garde un secret de 32 caractères au moins', () => {
    assert.equal(
      secretAuth({ VERCEL_ENV: 'production', BETTER_AUTH_SECRET: SECRET_FACTICE }),
      SECRET_FACTICE,
    )
  })

  it('n’applique un repli que sur le poste local', () => {
    const repli = secretAuth({})
    assert.ok(repli.length >= 32)
    assert.equal(secretAuth({ BETTER_AUTH_SECRET: 'court' }), repli)
  })
})

describe('adresse du coffre', () => {
  it('prend BETTER_AUTH_URL, puis SITE_URL, réduites à leur origine', () => {
    assert.equal(
      urlAuth({ BETTER_AUTH_URL: 'https://exemple.test/coffre/' }),
      'https://exemple.test',
    )
    assert.equal(urlAuth({ SITE_URL: 'https://site.test/' }), 'https://site.test')
  })

  it('prend l’adresse de l’aperçu Vercel, et exige une adresse ailleurs hors poste local', () => {
    assert.equal(
      urlAuth({ VERCEL_ENV: 'preview', VERCEL_URL: 'apercu-factice.vercel.app' }),
      'https://apercu-factice.vercel.app',
    )
    assert.throws(() => urlAuth({ VERCEL_ENV: 'production' }), /BETTER_AUTH_URL ou SITE_URL/)
    assert.equal(urlAuth({}), 'http://localhost:3000')
  })

  it('pose Secure dès que le coffre est servi en https, pas en local', () => {
    assert.equal(parametresAuth({}).cookiesSecurises, false)
    assert.equal(
      parametresAuth({
        VERCEL_ENV: 'production',
        SITE_URL: 'https://site.test',
        BETTER_AUTH_SECRET: SECRET_FACTICE,
      }).cookiesSecurises,
      true,
    )
  })
})

describe('options de Better Auth', () => {
  it('réduit Better Auth au strict minimum (D67)', () => {
    const { options } = creerAuth(poolFactice(), {})
    assert.equal(options.basePath, BASE_PATH_AUTH)
    assert.equal(options.emailAndPassword?.enabled, true)
    assert.equal(options.emailAndPassword?.disableSignUp, true)
    // Aucun fournisseur OAuth, aucune autre méthode de connexion.
    assert.equal('socialProviders' in options, false)
    assert.deepEqual(
      options.plugins?.map((plugin) => plugin.id),
      ['two-factor'],
    )
    assert.equal(options.telemetry?.enabled, false)
    assert.deepEqual([...CHEMINS_AUTORISES].sort(), [
      '/sign-in/email',
      '/sign-out',
      '/two-factor/enable',
      '/two-factor/verify-backup-code',
      '/two-factor/verify-totp',
    ])
  })

  it('fixe des sessions courtes, sans rafraîchissement', () => {
    const { options } = creerAuth(poolFactice(), {})
    assert.equal(options.session?.expiresIn, 8 * 60 * 60)
    assert.equal(options.session?.disableSessionRefresh, true)
    assert.equal(DUREE_MAX_SESSION_S, 8 * 60 * 60)
    assert.equal(INACTIVITE_MAX_S, 15 * 60)
  })

  it('active la limitation de débit en base, plus stricte que les défauts', () => {
    const { options } = creerAuth(poolFactice(), {})
    assert.equal(options.rateLimit?.enabled, true)
    assert.equal(options.rateLimit?.storage, 'database')
    assert.deepEqual(options.rateLimit?.customRules?.['/sign-in/email'], { window: 900, max: 5 })
    assert.deepEqual(options.rateLimit?.customRules?.['/two-factor/*'], { window: 900, max: 10 })
  })

  it('limite les cookies à /coffre : HttpOnly, SameSite=Strict, Secure hors local', async () => {
    const local = await creerAuth(poolFactice(), {}).$context
    assert.deepEqual(
      {
        name: local.authCookies.sessionToken.name,
        path: local.authCookies.sessionToken.attributes.path,
        httpOnly: local.authCookies.sessionToken.attributes.httpOnly,
        sameSite: local.authCookies.sessionToken.attributes.sameSite,
        secure: local.authCookies.sessionToken.attributes.secure,
      },
      {
        name: 'coffre.session_token',
        path: '/coffre',
        httpOnly: true,
        sameSite: 'strict',
        secure: false,
      },
    )
    const deploye = await creerAuth(poolFactice(), {
      VERCEL_ENV: 'production',
      SITE_URL: 'https://site.test',
      BETTER_AUTH_SECRET: SECRET_FACTICE,
    }).$context
    assert.equal(deploye.authCookies.sessionToken.name, '__Secure-coffre.session_token')
    assert.equal(deploye.authCookies.sessionToken.attributes.secure, true)
    assert.equal(deploye.authCookies.sessionToken.attributes.path, '/coffre')
    // Défi du second facteur : même chemin, mêmes attributs.
    const defi = deploye.createAuthCookie('two_factor')
    assert.equal(defi.attributes.path, '/coffre')
    assert.equal(defi.attributes.sameSite, 'strict')
  })

  it('refuse de démarrer sans secret hors poste local', () => {
    assert.throws(
      () => creerAuth(poolFactice(), { VERCEL_ENV: 'production', SITE_URL: 'https://site.test' }),
      /BETTER_AUTH_SECRET/,
    )
  })
})

describe('règle des deux comptes', () => {
  it('autorise le premier et le deuxième compte, refuse au-delà', () => {
    assert.equal(MAX_COMPTES, 2)
    assert.equal(peutCreerCompte(0), true)
    assert.equal(peutCreerCompte(1), true)
    assert.equal(peutCreerCompte(2), false)
    assert.equal(peutCreerCompte(3), false)
    assert.equal(peutCreerCompte(-1), false)
    assert.equal(peutCreerCompte(Number.NaN), false)
  })
})

describe('évaluation d’une session', () => {
  const ouverte = new Date('2026-11-18T09:00:00Z')
  const session = (modif: Partial<Parameters<typeof evaluerSession>[0]> = {}) => ({
    createdAt: ouverte,
    updatedAt: ouverte,
    twoFactorVerified: true,
    twoFactorEnabled: true,
    ...modif,
  })
  const apres = (secondes: number) => new Date(ouverte.getTime() + secondes * 1000)

  it('autorise une session ouverte par le second facteur, active et récente', () => {
    assert.equal(evaluerSession(session(), apres(60)), 'autorisee')
  })

  it('expire après 15 minutes d’inactivité', () => {
    assert.equal(evaluerSession(session(), apres(15 * 60)), 'autorisee')
    assert.equal(evaluerSession(session(), apres(15 * 60 + 1)), 'expiree')
  })

  it('expire après 8 heures, même active', () => {
    const active = session({ updatedAt: apres(8 * 60 * 60) })
    assert.equal(evaluerSession(active, apres(8 * 60 * 60)), 'autorisee')
    assert.equal(
      evaluerSession({ ...active, updatedAt: apres(8 * 60 * 60 + 1) }, apres(8 * 60 * 60 + 1)),
      'expiree',
    )
  })

  it('limite un compte sans TOTP à l’enrôlement', () => {
    assert.equal(
      evaluerSession(session({ twoFactorEnabled: false, twoFactorVerified: false }), apres(1)),
      'enrolement',
    )
  })

  it('refuse une session ouverte sans second facteur sur un compte qui a un TOTP', () => {
    assert.equal(
      evaluerSession(session({ twoFactorVerified: false }), apres(1)),
      'second-facteur-manquant',
    )
  })

  it('refuse des dates illisibles', () => {
    assert.equal(evaluerSession(session({ createdAt: new Date(Number.NaN) }), apres(1)), 'expiree')
  })
})

describe('enveloppe du gestionnaire', () => {
  it('extrait la route Better Auth, et rien hors de /coffre/api/auth', () => {
    assert.equal(
      cheminAuth('http://localhost:3000/coffre/api/auth/sign-in/email'),
      '/sign-in/email',
    )
    assert.equal(
      cheminAuth('http://localhost:3000/coffre/api/auth/sign-in/email?x=1'),
      '/sign-in/email',
    )
    assert.equal(cheminAuth('http://localhost:3000/coffre/api/authx/sign-in/email'), null)
    assert.equal(cheminAuth('http://localhost:3000/api/auth/sign-in/email'), null)
    assert.equal(cheminAuth('pas une adresse'), null)
    assert.equal(acteurLimitation('/sign-in/email'), 'limitation:/sign-in/email')
  })

  it('freine la force brute au-delà de la limite par IP', () => {
    assert.equal(MOT_DE_PASSE_MIN, 24)
    assert.equal(FENETRE_FREIN_S, 15 * 60)
    assert.equal(VERROU_COMPTE_ECHECS, 10)
    assert.equal(DISJONCTEUR_ECHECS, 50)
    assert.equal(DELAI_ENROLEMENT_S, 24 * 60 * 60)
  })
})

describe('mots de passe générés', () => {
  it('font 35 caractères sans caractère ambigu, tous différents', () => {
    const tires = new Set(Array.from({ length: 100 }, genererMotDePasse))
    assert.equal(tires.size, 100)
    for (const motDePasse of tires) {
      assert.match(motDePasse, /^[a-hjkmnp-z2-9]{5}(-[a-hjkmnp-z2-9]{5}){5}$/)
      assert.ok(motDePasse.length >= MOT_DE_PASSE_MIN)
    }
  })
})
