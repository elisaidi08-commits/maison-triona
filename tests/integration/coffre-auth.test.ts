import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { getMigrations } from 'better-auth/db/migration'

import { lireAcces, listeDuCoffre } from '../../src/lib/auth/acces.ts'
import { appelerAuth } from '../../src/lib/auth/appel.ts'
import type { ReponseAuth } from '../../src/lib/auth/appel.ts'
import { creerAuth } from '../../src/lib/auth/auth.ts'
import type { AuthCoffre } from '../../src/lib/auth/auth.ts'
import { creerCompte } from '../../src/lib/auth/comptes.ts'
import { migrate } from '../../src/lib/db/migrate.ts'
import { insertRequest } from '../../src/lib/vault/repository.ts'
import { resetDatabase, testPool } from './helpers.ts'
import { codeFaux, codeTotp, secretDeLUri } from './totp.ts'

// Authentification du coffre de bout en bout (story 3.2, partie C), sur la base de test, par le
// même chemin que les Server Actions : `appelerAuth` → `auth.handler`. Comptes et contenus factices.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const ORIGINE = 'http://localhost:3000'
const ENV = {
  BETTER_AUTH_SECRET: 'secret-factice-integration-0123456789-abcdefgh',
  BETTER_AUTH_URL: ORIGINE,
}
const MOT_DE_PASSE = 'phrase-factice-tres-longue'
const pool = testPool()
let auth: AuthCoffre

let ipSuivante = 1
function nouvelleIp(): string {
  ipSuivante += 1
  return `203.0.113.${ipSuivante}`
}

// Navigateur réduit : garde les cookies reçus (valeur brute, comme un navigateur) et les renvoie.
class Navigateur {
  readonly cookies = new Map<string, string>()
  readonly ip: string

  constructor(ip = nouvelleIp()) {
    this.ip = ip
  }

  entetes(): Headers {
    const entetes = new Headers({
      origin: ORIGINE,
      'x-forwarded-for': this.ip,
      'user-agent': 'test',
    })
    const cookie = [...this.cookies].map(([nom, valeur]) => `${nom}=${valeur}`).join('; ')
    if (cookie) entetes.set('cookie', cookie)
    return entetes
  }

  async appeler(chemin: string, corps: Record<string, unknown> = {}): Promise<ReponseAuth> {
    const reponse = await appelerAuth(auth, chemin, corps, this.entetes())
    for (const ligne of reponse.cookies) {
      const [paire = '', ...attributs] = ligne.split(';').map((part) => part.trim())
      const egal = paire.indexOf('=')
      const nom = paire.slice(0, egal)
      const expire = attributs.some((attribut) => /^max-age=0$/i.test(attribut))
      if (expire) this.cookies.delete(nom)
      else this.cookies.set(nom, paire.slice(egal + 1))
    }
    return reponse
  }

  connexion(email: string, motDePasse = MOT_DE_PASSE): Promise<ReponseAuth> {
    return this.appeler('/sign-in/email', { email, password: motDePasse, rememberMe: true })
  }
}

async function compteSansTotp(email: string): Promise<void> {
  await creerCompte(auth, pool, { nom: 'Compte factice', email, motDePasse: MOT_DE_PASSE })
}

// Compte créé, connecté par mot de passe, TOTP enrôlé et confirmé (session autorisée).
async function compteAvecTotp(email: string) {
  await compteSansTotp(email)
  const navigateur = new Navigateur()
  assert.equal((await navigateur.connexion(email)).statut, 200)
  const enrolement = await navigateur.appeler('/two-factor/enable', { password: MOT_DE_PASSE })
  assert.equal(enrolement.statut, 200)
  const { totpURI, backupCodes } = enrolement.donnees as { totpURI: string; backupCodes: string[] }
  assert.match(totpURI, /^otpauth:\/\/totp\/Maison%20Triona:/)
  const secret = secretDeLUri(totpURI)
  const confirmation = await navigateur.appeler('/two-factor/verify-totp', {
    code: codeTotp(secret),
  })
  assert.equal(confirmation.statut, 200)
  return { secret, codesSecours: backupCodes, navigateur }
}

async function journal() {
  const { rows } = await pool.query<{ actor: string; action: string; request_id: string | null }>(
    'SELECT actor, action, request_id FROM vault_access_log ORDER BY id',
  )
  return rows
}

describe('authentification du coffre', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
    auth = creerAuth(pool, ENV)
  })
  beforeEach(() =>
    pool.query(
      'TRUNCATE "user", "verification", "rateLimit", vault_access_log, vault_requests RESTART IDENTITY CASCADE',
    ),
  )
  after(() => pool.end())

  it('a un schéma conforme à la configuration de Better Auth', async () => {
    const { toBeCreated, toBeAdded } = await getMigrations(auth.options)
    assert.deepEqual(toBeCreated, [])
    assert.deepEqual(toBeAdded, [])
  })

  it('refuse toute inscription, par HTTP comme côté serveur', async () => {
    const navigateur = new Navigateur()
    const corps = { name: 'Inconnu', email: 'inscription@exemple.test', password: MOT_DE_PASSE }
    assert.equal((await navigateur.appeler('/sign-up/email', corps)).statut, 404)
    await assert.rejects(
      auth.api.signUpEmail({ body: corps }),
      (error: { body?: { code?: string } }) => {
        assert.equal(error.body?.code, 'EMAIL_PASSWORD_SIGN_UP_DISABLED')
        return true
      },
    )
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM "user"')
    assert.equal(rows[0].n, 0)
  })

  it('ne sert que les routes de la liste fermée et refuse l’appareil de confiance', async () => {
    const navigateur = new Navigateur()
    for (const chemin of [
      '/get-session',
      '/two-factor/disable',
      '/two-factor/get-totp-uri',
      '/change-password',
      '/request-password-reset',
      '/sign-in/social',
      '/list-sessions',
    ]) {
      assert.equal((await navigateur.appeler(chemin)).statut, 404, chemin)
    }
    const confiance = await navigateur.appeler('/two-factor/verify-totp', {
      code: '000000',
      trustDevice: true,
    })
    assert.equal(confiance.statut, 400)
    assert.equal(confiance.code, 'TRUST_DEVICE_DISABLED')
  })

  it('connexion sans TOTP : enrôlement seulement, aucun accès à la liste', async () => {
    await compteSansTotp('sans-totp@exemple.test')
    await insertRequest(pool, demandeFactice())
    const navigateur = new Navigateur()
    const connexion = await navigateur.connexion('sans-totp@exemple.test')
    assert.equal(connexion.statut, 200)
    assert.equal(
      (connexion.donnees as { twoFactorRedirect?: boolean }).twoFactorRedirect,
      undefined,
    )

    const acces = await lireAcces(auth, pool, navigateur.entetes())
    assert.equal(acces.etat, 'enrolement')
    assert.equal(await listeDuCoffre(pool, acces), null)
    assert.deepEqual(await journal(), [
      { actor: 'sans-totp@exemple.test', action: 'login', request_id: null },
    ])
  })

  it('TOTP valide : accès à la liste, sans le contenu chiffré', async () => {
    const { secret } = await compteAvecTotp('avec-totp@exemple.test')
    const id = await insertRequest(pool, demandeFactice())

    const navigateur = new Navigateur()
    const connexion = await navigateur.connexion('avec-totp@exemple.test')
    assert.equal(connexion.statut, 200)
    assert.deepEqual(connexion.donnees, { twoFactorRedirect: true, twoFactorMethods: ['totp'] })
    // Mot de passe seul : aucun cookie de session, seulement le défi du second facteur.
    assert.deepEqual([...navigateur.cookies.keys()], ['coffre.two_factor'])
    assert.equal((await lireAcces(auth, pool, navigateur.entetes())).etat, 'anonyme')

    const verification = await navigateur.appeler('/two-factor/verify-totp', {
      code: codeTotp(secret),
    })
    assert.equal(verification.statut, 200)
    const cookieSession = verification.cookies.find((ligne) =>
      ligne.startsWith('coffre.session_token='),
    )
    assert.ok(cookieSession)
    assert.match(cookieSession, /; Path=\/coffre(;|$)/)
    assert.match(cookieSession, /; HttpOnly(;|$)/)
    assert.match(cookieSession, /; SameSite=Strict(;|$)/)
    assert.doesNotMatch(cookieSession, /; Secure/)

    const acces = await lireAcces(auth, pool, navigateur.entetes())
    assert.equal(acces.etat, 'autorise')
    assert.equal(acces.etat === 'autorise' && acces.compte.email, 'avec-totp@exemple.test')
    const liste = await listeDuCoffre(pool, acces)
    assert.ok(liste)
    assert.deepEqual(
      liste.map((demande) => demande.id),
      [id],
    )
    assert.equal('sealed' in (liste[0] ?? {}), false)
  })

  it('code de secours : accès, une seule fois', async () => {
    const { codesSecours } = await compteAvecTotp('secours@exemple.test')
    assert.equal(codesSecours.length, 10)
    const [code] = codesSecours

    const premier = new Navigateur()
    await premier.connexion('secours@exemple.test')
    assert.equal((await premier.appeler('/two-factor/verify-backup-code', { code })).statut, 200)
    assert.equal((await lireAcces(auth, pool, premier.entetes())).etat, 'autorise')

    const second = new Navigateur()
    await second.connexion('secours@exemple.test')
    const reemploi = await second.appeler('/two-factor/verify-backup-code', { code })
    assert.equal(reemploi.statut, 401)
    assert.equal(reemploi.code, 'INVALID_BACKUP_CODE')
  })

  it('une session ouverte avant l’enrôlement ne donne jamais accès', async () => {
    await compteSansTotp('avant@exemple.test')
    const ancienne = new Navigateur()
    await ancienne.connexion('avant@exemple.test')

    const nouvelle = new Navigateur()
    await nouvelle.connexion('avant@exemple.test')
    const { totpURI } = (await nouvelle.appeler('/two-factor/enable', { password: MOT_DE_PASSE }))
      .donnees as { totpURI: string }
    await nouvelle.appeler('/two-factor/verify-totp', { code: codeTotp(secretDeLUri(totpURI)) })

    assert.equal((await lireAcces(auth, pool, nouvelle.entetes())).etat, 'autorise')
    assert.equal((await lireAcces(auth, pool, ancienne.entetes())).etat, 'anonyme')
    // Refusée, l'ancienne session est supprimée.
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM "session"')
    assert.equal(rows[0].n, 1)
  })

  it('ferme la session après 15 minutes d’inactivité et après 8 heures', async () => {
    const { navigateur, secret } = await compteAvecTotp('duree@exemple.test')
    const depart = Date.now()
    const dans = (minutes: number) => new Date(depart + minutes * 60_000)

    // Chaque page servie repousse l'inactivité ; 16 minutes sans page ferment la session.
    assert.equal((await lireAcces(auth, pool, navigateur.entetes(), dans(10))).etat, 'autorise')
    assert.equal((await lireAcces(auth, pool, navigateur.entetes(), dans(20))).etat, 'autorise')
    assert.equal((await lireAcces(auth, pool, navigateur.entetes(), dans(36))).etat, 'anonyme')
    assert.equal((await lireAcces(auth, pool, navigateur.entetes(), dans(0))).etat, 'anonyme')

    // Active toutes les 10 minutes : ouverte jusqu'à 8 heures, fermée au-delà.
    const actif = new Navigateur()
    await actif.connexion('duree@exemple.test')
    await actif.appeler('/two-factor/verify-totp', { code: codeTotp(secret) })
    for (let minute = 10; minute <= 8 * 60; minute += 10) {
      assert.equal((await lireAcces(auth, pool, actif.entetes(), dans(minute))).etat, 'autorise')
    }
    assert.equal((await lireAcces(auth, pool, actif.entetes(), dans(8 * 60 + 5))).etat, 'anonyme')
  })

  it('échecs de mot de passe répétés : blocage de l’adresse IP', async () => {
    await compteSansTotp('mdp@exemple.test')
    const navigateur = new Navigateur()
    for (let essai = 0; essai < 5; essai++) {
      const echec = await navigateur.connexion('mdp@exemple.test', 'mauvaise-phrase-factice')
      assert.equal(echec.statut, 401)
      assert.equal(echec.code, 'INVALID_EMAIL_OR_PASSWORD')
    }
    // Sixième essai, même avec le bon mot de passe : refusé (5 par 15 minutes et par IP).
    assert.equal((await navigateur.connexion('mdp@exemple.test')).statut, 429)
    assert.equal((await new Navigateur().connexion('mdp@exemple.test')).statut, 200)

    const echecs = (await journal()).filter((ligne) => ligne.action === 'login_failed')
    assert.equal(echecs.length, 5)
    assert.ok(echecs.every((ligne) => ligne.actor === 'mdp@exemple.test'))
  })

  it('échecs TOTP répétés : compte verrouillé, même avec un bon code', async () => {
    const { secret } = await compteAvecTotp('verrou@exemple.test')
    const navigateur = new Navigateur()
    await navigateur.connexion('verrou@exemple.test')
    for (let essai = 0; essai < 5; essai++) {
      const echec = await navigateur.appeler('/two-factor/verify-totp', { code: codeFaux(secret) })
      assert.equal(echec.statut, 401)
      assert.equal(echec.code, 'INVALID_CODE')
    }
    const bloque = await navigateur.appeler('/two-factor/verify-totp', { code: codeTotp(secret) })
    assert.equal(bloque.statut, 429)
    assert.equal(bloque.code, 'ACCOUNT_TEMPORARILY_LOCKED')

    // Nouveau défi, autre adresse : le compte reste verrouillé.
    const autre = new Navigateur()
    await autre.connexion('verrou@exemple.test')
    const encore = await autre.appeler('/two-factor/verify-totp', { code: codeTotp(secret) })
    assert.equal(encore.code, 'ACCOUNT_TEMPORARILY_LOCKED')
    assert.equal((await lireAcces(auth, pool, autre.entetes())).etat, 'anonyme')

    const echecs = (await journal()).filter((ligne) => ligne.action === 'login_failed')
    assert.equal(echecs.length, 7)
    assert.ok(echecs.every((ligne) => ligne.actor === 'verrou@exemple.test'))
  })

  it('remplit le journal d’accès sans aucun contenu', async () => {
    const { secret, codesSecours } = await compteAvecTotp('journal@exemple.test')
    await pool.query('TRUNCATE vault_access_log RESTART IDENTITY')
    const contenu = demandeFactice()
    await insertRequest(pool, contenu)

    const navigateur = new Navigateur()
    await navigateur.connexion('personne-factice@exemple.test', 'saisie-factice-inconnue')
    await navigateur.connexion('journal@exemple.test', 'mauvaise-phrase-factice')
    await navigateur.connexion('journal@exemple.test')
    const code = codeTotp(secret)
    await navigateur.appeler('/two-factor/verify-totp', { code })
    await listeDuCoffre(pool, await lireAcces(auth, pool, navigateur.entetes()))
    assert.equal((await navigateur.appeler('/sign-out')).statut, 200)
    assert.equal((await lireAcces(auth, pool, navigateur.entetes())).etat, 'anonyme')

    assert.deepEqual(await journal(), [
      { actor: 'inconnu', action: 'login_failed', request_id: null },
      { actor: 'journal@exemple.test', action: 'login_failed', request_id: null },
      { actor: 'journal@exemple.test', action: 'login', request_id: null },
      { actor: 'journal@exemple.test', action: 'list', request_id: null },
      { actor: 'journal@exemple.test', action: 'logout', request_id: null },
    ])

    const { rows: colonnes } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'vault_access_log' ORDER BY ordinal_position`,
    )
    assert.deepEqual(
      colonnes.map((colonne) => colonne.column_name),
      ['id', 'at', 'actor', 'action', 'request_id'],
    )
    const { rows: tout } = await pool.query('SELECT * FROM vault_access_log')
    const brut = JSON.stringify(tout)
    for (const secretSaisi of [
      MOT_DE_PASSE,
      'mauvaise-phrase-factice',
      'saisie-factice-inconnue',
      'personne-factice@exemple.test',
      code,
      secret,
      ...codesSecours,
      Buffer.from(contenu.sealed).toString('hex'),
    ]) {
      assert.ok(!brut.includes(secretSaisi), 'le journal ne contient aucune saisie')
    }
  })
})

function demandeFactice() {
  return {
    kind: 'request' as const,
    service: 'conciergerie',
    country: 'BE',
    locale: 'fr' as const,
    urgency: 'aucune',
    source: null,
    sealed: new Uint8Array(randomBytes(64)),
    retentionUntil: new Date('2028-01-01T00:00:00Z'),
    privacyVersion: '2026-11-18',
  }
}
