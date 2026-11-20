import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { getMigrations } from 'better-auth/db/migration'

import {
  demandeDuCoffre,
  effacementDuCoffre,
  exportDuCoffre,
  gelDuCoffre,
  lireAcces,
  listeDuCoffre,
  scelleDuCoffre,
} from '../../src/lib/auth/acces.ts'
import { appelerAuth } from '../../src/lib/auth/appel.ts'
import type { ReponseAuth } from '../../src/lib/auth/appel.ts'
import { creerAuth } from '../../src/lib/auth/auth.ts'
import type { AuthCoffre } from '../../src/lib/auth/auth.ts'
import { creerCompte } from '../../src/lib/auth/comptes.ts'
import { servirAuth } from '../../src/lib/auth/enveloppe.ts'
import { purgerAuth } from '../../src/lib/auth/purge.ts'
import { qrCodeSvg } from '../../src/lib/auth/qr-code.ts'
import { migrate } from '../../src/lib/db/migrate.ts'
import { runRetention } from '../../src/lib/vault/conservation.ts'
import { insertRequest } from '../../src/lib/vault/repository.ts'
import { sealRequest } from '../../src/lib/vault/seal.ts'
import { loadSodium, toBase64 } from '../../src/lib/vault/sodium.ts'
import { applyRoles, coffrePool, resetDatabase, testPool } from './helpers.ts'
import { codeFaux, codeTotp, secretDeLUri } from './totp.ts'

// Authentification du coffre de bout en bout (story 3.2, partie C), sur la base de test, par le
// même chemin que les Server Actions : `appelerAuth` → `auth.handler`. Comptes et contenus factices.
// Better Auth et l'accès au coffre passent par le rôle `coffre` (db/roles/coffre.sql), comme en
// production ; `pool` (administrateur) prépare et relit la base.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const ORIGINE = 'http://localhost:3000'
const ENV = {
  BETTER_AUTH_SECRET: 'secret-factice-integration-0123456789-abcdefgh',
  BETTER_AUTH_URL: ORIGINE,
}
const MOT_DE_PASSE = 'phrase-factice-tres-longue'
const pool = testPool()
const coffre = coffrePool()
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
    const reponse = await appelerAuth(auth, coffre, chemin, corps, this.entetes())
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
  await creerCompte(auth, coffre, { nom: 'Compte factice', email, motDePasse: MOT_DE_PASSE })
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
    await applyRoles(pool)
    auth = creerAuth(coffre, ENV)
  })
  beforeEach(() =>
    pool.query(
      'TRUNCATE "user", "verification", "rateLimit", vault_access_log, vault_requests RESTART IDENTITY CASCADE',
    ),
  )
  after(async () => {
    await coffre.end()
    await pool.end()
  })

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

    const acces = await lireAcces(auth, coffre, navigateur.entetes())
    assert.equal(acces.etat, 'enrolement')
    assert.equal(await listeDuCoffre(coffre, acces), null)
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
    assert.equal((await lireAcces(auth, coffre, navigateur.entetes())).etat, 'anonyme')

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

    const acces = await lireAcces(auth, coffre, navigateur.entetes())
    assert.equal(acces.etat, 'autorise')
    assert.equal(acces.etat === 'autorise' && acces.compte.email, 'avec-totp@exemple.test')
    const liste = await listeDuCoffre(coffre, acces)
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
    assert.equal((await lireAcces(auth, coffre, premier.entetes())).etat, 'autorise')

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

    assert.equal((await lireAcces(auth, coffre, nouvelle.entetes())).etat, 'autorise')
    assert.equal((await lireAcces(auth, coffre, ancienne.entetes())).etat, 'anonyme')
    // Refusée, l'ancienne session est supprimée.
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM "session"')
    assert.equal(rows[0].n, 1)
  })

  it('ferme la session après 15 minutes d’inactivité et après 8 heures', async () => {
    const { navigateur, secret } = await compteAvecTotp('duree@exemple.test')
    const depart = Date.now()
    const dans = (minutes: number) => new Date(depart + minutes * 60_000)

    // Chaque page servie repousse l'inactivité ; 16 minutes sans page ferment la session.
    assert.equal((await lireAcces(auth, coffre, navigateur.entetes(), dans(10))).etat, 'autorise')
    assert.equal((await lireAcces(auth, coffre, navigateur.entetes(), dans(20))).etat, 'autorise')
    assert.equal((await lireAcces(auth, coffre, navigateur.entetes(), dans(36))).etat, 'anonyme')
    assert.equal((await lireAcces(auth, coffre, navigateur.entetes(), dans(0))).etat, 'anonyme')

    // Active toutes les 10 minutes : ouverte jusqu'à 8 heures, fermée au-delà.
    const actif = new Navigateur()
    await actif.connexion('duree@exemple.test')
    await actif.appeler('/two-factor/verify-totp', { code: codeTotp(secret) })
    for (let minute = 10; minute <= 8 * 60; minute += 10) {
      assert.equal((await lireAcces(auth, coffre, actif.entetes(), dans(minute))).etat, 'autorise')
    }
    assert.equal((await lireAcces(auth, coffre, actif.entetes(), dans(8 * 60 + 5))).etat, 'anonyme')
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
    assert.equal((await lireAcces(auth, coffre, autre.entetes())).etat, 'anonyme')

    const echecs = (await journal()).filter((ligne) => ligne.action === 'login_failed')
    assert.equal(echecs.length, 7)
    assert.ok(echecs.every((ligne) => ligne.actor === 'verrou@exemple.test'))
  })

  it('répond 404 à une route ou une méthode hors liste, sans rien écrire', async () => {
    const navigateur = new Navigateur()
    for (const chemin of ['/get-session', '/sign-up/email', '/inconnue', '/sign-in/email/']) {
      assert.equal((await navigateur.appeler(chemin)).statut, 404, chemin)
    }
    const get = await servirAuth(
      auth,
      coffre,
      new Request(`${ORIGINE}/coffre/api/auth/sign-in/email`, { headers: navigateur.entetes() }),
    )
    assert.equal(get.status, 404)
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM "rateLimit"')
    assert.equal(rows[0].n, 0)
    assert.deepEqual(await journal(), [])
  })

  it('produit le QR code d’enrôlement à partir de l’URI de Better Auth (D68)', async () => {
    await compteSansTotp('qr@exemple.test')
    const navigateur = new Navigateur()
    assert.equal((await navigateur.connexion('qr@exemple.test')).statut, 200)
    const enrolement = await navigateur.appeler('/two-factor/enable', { password: MOT_DE_PASSE })
    const { totpURI } = enrolement.donnees as { totpURI: string }
    const svg = await qrCodeSvg(totpURI)
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="240" height="240" /)
    assert.ok(!svg.includes(secretDeLUri(totpURI)))
  })

  it('journalise l’enrôlement, le mot de passe juste et le code de secours à part', async () => {
    const { secret, codesSecours } = await compteAvecTotp('actions@exemple.test')
    const totp = new Navigateur()
    await totp.connexion('actions@exemple.test')
    await totp.appeler('/two-factor/verify-totp', { code: codeTotp(secret) })
    const secours = new Navigateur()
    await secours.connexion('actions@exemple.test')
    await secours.appeler('/two-factor/verify-backup-code', { code: codesSecours[0] })
    assert.deepEqual(
      (await journal()).map((ligne) => ligne.action),
      ['login', 'totp_enrolled', 'password_ok', 'login', 'password_ok', 'login_backup_code'],
    )
  })

  it('garde une seule session par compte, sans adresse IP ni navigateur', async () => {
    const { navigateur: premier, secret } = await compteAvecTotp('unique@exemple.test')
    assert.equal((await lireAcces(auth, coffre, premier.entetes())).etat, 'autorise')
    // Mot de passe seul (second facteur attendu) : ne déconnecte personne.
    const etape = new Navigateur()
    await etape.connexion('unique@exemple.test')
    assert.equal((await lireAcces(auth, coffre, premier.entetes())).etat, 'autorise')
    // Connexion complète ailleurs : la première session est fermée.
    await etape.appeler('/two-factor/verify-totp', { code: codeTotp(secret) })
    assert.equal((await lireAcces(auth, coffre, etape.entetes())).etat, 'autorise')
    assert.equal((await lireAcces(auth, coffre, premier.entetes())).etat, 'anonyme')
    const { rows } = await pool.query<{ ipAddress: string | null; userAgent: string | null }>(
      'SELECT "ipAddress", "userAgent" FROM "session"',
    )
    assert.deepEqual(rows, [{ ipAddress: null, userAgent: null }])
  })

  it('verrou souple : 10 échecs en 15 minutes bloquent le compte, toutes IP confondues', async () => {
    await compteSansTotp('souple@exemple.test')
    await compteSansTotp('voisin@exemple.test')
    for (const navigateur of [new Navigateur(), new Navigateur()]) {
      for (let essai = 0; essai < 5; essai++) {
        assert.equal(
          (await navigateur.connexion('souple@exemple.test', 'faux-factice')).statut,
          401,
        )
      }
    }
    // Onzième essai, bon mot de passe, adresse neuve : même 429 que la limite par IP.
    const bloque = await new Navigateur().connexion('souple@exemple.test')
    assert.equal(bloque.statut, 429)
    assert.equal(bloque.code, null)
    assert.equal((await new Navigateur().connexion('voisin@exemple.test')).statut, 200)
    const lignes = await journal()
    assert.equal(lignes.filter((ligne) => ligne.action === 'login_failed').length, 10)
    assert.deepEqual(
      lignes.filter((ligne) => ligne.action === 'rate_limited'),
      [{ actor: 'limitation:/sign-in/email', action: 'rate_limited', request_id: null }],
    )
  })

  it('disjoncteur : au-delà de 50 échecs en 15 minutes, plus aucune connexion', async () => {
    await compteSansTotp('disjoncteur@exemple.test')
    await pool.query(
      `INSERT INTO vault_access_log (actor, action)
       SELECT 'inconnu', 'login_failed' FROM generate_series(1, 50)`,
    )
    assert.equal((await new Navigateur().connexion('disjoncteur@exemple.test')).statut, 429)
    await pool.query(`UPDATE vault_access_log SET at = now() - interval '16 minutes'`)
    assert.equal((await new Navigateur().connexion('disjoncteur@exemple.test')).statut, 200)
  })

  it('journalise les 429 une fois par route et par 15 minutes', async () => {
    await compteSansTotp('rafale@exemple.test')
    const navigateur = new Navigateur()
    for (let essai = 0; essai < 5; essai++)
      await navigateur.connexion('rafale@exemple.test', 'faux')
    for (let essai = 0; essai < 3; essai++) {
      assert.equal((await navigateur.connexion('rafale@exemple.test')).statut, 429)
    }
    const limites = (await journal()).filter((ligne) => ligne.action === 'rate_limited')
    assert.deepEqual(limites, [
      { actor: 'limitation:/sign-in/email', action: 'rate_limited', request_id: null },
    ])
  })

  it('refuse l’enrôlement plus de 24 heures après la création du compte', async () => {
    await compteSansTotp('tardif@exemple.test')
    await pool.query(
      `UPDATE "user" SET "createdAt" = now() - interval '25 hours' WHERE email = 'tardif@exemple.test'`,
    )
    const navigateur = new Navigateur()
    assert.equal((await navigateur.connexion('tardif@exemple.test')).statut, 200)
    const refus = await navigateur.appeler('/two-factor/enable', { password: MOT_DE_PASSE })
    assert.equal(refus.statut, 403)
    assert.equal(refus.code, 'ENROLMENT_WINDOW_CLOSED')
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM "twoFactor"')
    assert.equal(rows[0].n, 0)
  })

  it('purge les compteurs, défis et sessions échus, et garde le reste', async () => {
    const { navigateur } = await compteAvecTotp('purge@exemple.test')
    const defi = new Navigateur()
    await defi.connexion('purge@exemple.test')
    const maintenant = Date.now()
    await pool.query(
      `INSERT INTO "rateLimit" (id, key, count, "lastRequest") VALUES ('vieux', 'x|/sign-in/email', 1, $1)`,
      [maintenant - 16 * 60_000],
    )
    const avant = await pool.query('SELECT count(*)::int AS n FROM "rateLimit"')
    assert.ok(avant.rows[0].n >= 2)

    // Maintenant : seul le vieux compteur part ; session et défi restent.
    assert.deepEqual(await purgerAuth(coffre, new Date(maintenant)), {
      limites: 1,
      verifications: 0,
      sessions: 0,
    })
    assert.equal((await lireAcces(auth, coffre, navigateur.entetes())).etat, 'autorise')
    // Une heure plus tard : compteurs, défi (5 minutes) et session inactive partent.
    const purge = await purgerAuth(coffre, new Date(maintenant + 60 * 60_000))
    assert.ok(purge.limites >= 1 && purge.verifications >= 1)
    assert.equal(purge.sessions, 1)
    for (const table of ['"rateLimit"', '"verification"', '"session"']) {
      const { rows } = await pool.query(`SELECT count(*)::int AS n FROM ${table}`)
      assert.equal(rows[0].n, 0, table)
    }
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
    await listeDuCoffre(coffre, await lireAcces(auth, coffre, navigateur.entetes()))
    assert.equal((await navigateur.appeler('/sign-out')).statut, 200)
    assert.equal((await lireAcces(auth, coffre, navigateur.entetes())).etat, 'anonyme')

    assert.deepEqual(await journal(), [
      { actor: 'inconnu', action: 'login_failed', request_id: null },
      { actor: 'journal@exemple.test', action: 'login_failed', request_id: null },
      { actor: 'journal@exemple.test', action: 'password_ok', request_id: null },
      { actor: 'journal@exemple.test', action: 'login', request_id: null },
      { actor: 'journal@exemple.test', action: 'list', request_id: null },
      { actor: 'journal@exemple.test', action: 'logout', request_id: null },
    ])

    // Aucune colonne ne peut recevoir un contenu : hors acteur et action (listes fermées, adresse du
    // compte), des dates, des identifiants (demande, appel) et les compteurs entiers de la
    // conservation (partie D).
    const { rows: colonnes } = await pool.query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_name = 'vault_access_log' ORDER BY ordinal_position`,
    )
    assert.deepEqual(
      colonnes.map((colonne) => `${colonne.column_name}:${colonne.data_type}`),
      [
        'id:bigint',
        'at:timestamp with time zone',
        'actor:text',
        'action:text',
        'request_id:uuid',
        'purged_requests:integer',
        'purged_sessions:integer',
        'purged_rate_limits:integer',
        'purged_verifications:integer',
        'purged_bookings:integer',
        'purged_tokens:integer',
        // Agenda des appels (story 3.13, 0013) : l'identifiant de l'appel visé, rien d'autre.
        'booking_id:uuid',
      ],
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

  it('partie D : lecture, export, gel et effacement, journalisés au nom du compte seulement', async () => {
    const { navigateur } = await compteAvecTotp('lecture@exemple.test')
    await pool.query('TRUNCATE vault_access_log RESTART IDENTITY')
    const contenu = demandeFactice()
    const id = await insertRequest(pool, contenu)
    const acces = await lireAcces(auth, coffre, navigateur.entetes())
    assert.equal(acces.etat, 'autorise')

    // La page : colonnes de tri, sans journal. La lecture : les octets exacts, journalisée.
    assert.equal((await demandeDuCoffre(coffre, acces, id))?.id, id)
    assert.deepEqual(await scelleDuCoffre(coffre, acces, id), contenu.sealed)
    assert.equal(await exportDuCoffre(coffre, acces, id), true)
    assert.equal(await gelDuCoffre(coffre, acces, id, true), true)
    assert.equal(await gelDuCoffre(coffre, acces, id, false), true)
    assert.equal(await effacementDuCoffre(coffre, acces, id), true)
    assert.equal(await demandeDuCoffre(coffre, acces, id), null)
    assert.equal(await scelleDuCoffre(coffre, acces, id), null)
    assert.deepEqual(await journal(), [
      { actor: 'lecture@exemple.test', action: 'read', request_id: id },
      { actor: 'lecture@exemple.test', action: 'export', request_id: id },
      { actor: 'lecture@exemple.test', action: 'freeze', request_id: id },
      { actor: 'lecture@exemple.test', action: 'unfreeze', request_id: id },
      { actor: 'lecture@exemple.test', action: 'delete', request_id: id },
    ])
  })

  it('partie D : sans session autorisée, rien n’est lu, gelé, exporté ni effacé', async () => {
    await compteSansTotp('enrolement@exemple.test')
    const enrolement = new Navigateur()
    assert.equal((await enrolement.connexion('enrolement@exemple.test')).statut, 200)
    await pool.query('TRUNCATE vault_access_log RESTART IDENTITY')
    const id = await insertRequest(pool, demandeFactice())
    for (const acces of [
      await lireAcces(auth, coffre, enrolement.entetes()),
      await lireAcces(auth, coffre, new Navigateur().entetes()),
    ]) {
      assert.notEqual(acces.etat, 'autorise')
      assert.equal(await demandeDuCoffre(coffre, acces, id), null)
      assert.equal(await scelleDuCoffre(coffre, acces, id), null)
      assert.equal(await exportDuCoffre(coffre, acces, id), false)
      assert.equal(await gelDuCoffre(coffre, acces, id, true), false)
      assert.equal(await effacementDuCoffre(coffre, acces, id), false)
    }
    const { rows } = await pool.query('SELECT frozen FROM vault_requests WHERE id = $1', [id])
    assert.deepEqual(rows, [{ frozen: false }])
    assert.deepEqual(await journal(), [])
  })

  it('partie D : le journal ne contient jamais de contenu, conservation comprise', async () => {
    const { navigateur } = await compteAvecTotp('temoin@exemple.test')
    const lib = await loadSodium()
    const { publicKey } = lib.crypto_box_keypair()
    const temoins = {
      nom: 'Nom-Temoin-Factice',
      email: 'temoin-scelle@exemple.test',
      telephone: '+32 470 99 99 99',
      pourQui: 'proche',
      creneau: 'soir',
      message: 'Mot-libre-temoin-factice',
    }
    const sealed = await sealRequest(temoins, toBase64(lib, publicKey))
    const lue = await insertRequest(pool, { ...demandeFactice(), sealed })
    const echue = await insertRequest(pool, {
      ...demandeFactice(),
      sealed,
      retentionUntil: new Date('2026-01-01T00:00:00Z'),
    })
    const acces = await lireAcces(auth, coffre, navigateur.entetes())
    await listeDuCoffre(coffre, acces)
    await scelleDuCoffre(coffre, acces, lue)
    await exportDuCoffre(coffre, acces, lue)
    await gelDuCoffre(coffre, acces, lue, true)
    await effacementDuCoffre(coffre, acces, lue)
    await runRetention(coffre, new Date())

    const { rows } = await pool.query('SELECT * FROM vault_access_log')
    assert.ok(rows.some((row) => row.action === 'purge' && row.request_id === echue))
    assert.ok(rows.some((row) => row.action === 'retention'))
    const brut = JSON.stringify(rows)
    const hex = Buffer.from(sealed).toString('hex')
    for (const temoin of [
      ...Object.values(temoins),
      hex.slice(0, 64),
      toBase64(lib, sealed).slice(0, 64),
    ]) {
      assert.ok(!brut.includes(temoin), 'le journal ne contient aucun contenu')
    }
    // Seules colonnes renseignées : date, acteur (adresse du compte ou « system »), action,
    // identifiant de demande, compteurs entiers.
    for (const row of rows) {
      assert.ok(['temoin@exemple.test', 'system'].includes(row.actor), row.actor)
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
