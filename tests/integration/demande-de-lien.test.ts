import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { readBookingLink, requestAccessLink } from '../../src/lib/booking/bookings.ts'
import { empreinteAdresse } from '../../src/lib/booking/email-hmac.ts'
import { hashToken } from '../../src/lib/booking/tokens.ts'
import { migrate } from '../../src/lib/db/migrate.ts'
import type { EmailConfig } from '../../src/lib/email/config.ts'
import type { EmailTransport, OutgoingEmail, SendResult } from '../../src/lib/email/tem.ts'
import { runOutbox, sendAccessLinkNow } from '../../src/lib/outbox/process.ts'
import type { OutboxDeps, OutboxLogStatus } from '../../src/lib/outbox/process.ts'
import { claimDue } from '../../src/lib/outbox/repository.ts'
import { applyRoles, envoiPool, resetDatabase, TEST_DATABASE_URL, testPool } from './helpers.ts'

// Demande de lien de réservation (story 3.9 ; docs/reservation-appel.md §2, §4.4, §4.5) contre
// PostgreSQL 17, avec les vrais rôles : `site_public` crée le lien (empreinte d'adresse, jeton haché)
// et l'e-mail d'accès dans la boîte d'envoi, dans une transaction ; un nouveau lien annule l'ancien
// par la seule fonction `revoke_live_access_links` ; `envoi` envoie l'e-mail avec ce que la demande a
// en mémoire, et la tâche planifiée abandonne (`no_contact`) ce qu'elle ne peut pas reprendre. Jamais
// d'adresse ni de jeton en base. Données factices uniquement.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const SECRET = 'secret-de-test-des-empreintes-d-adresse-0123456789'
const ADRESSE = 'Hortense.Lien@Exemple.test'
const MINUTE = 60_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const REFUS = { code: '42501' }
const CONTROLE = { code: '23514' }

const CONFIG: EmailConfig = {
  temSecretKey: 'cle-secrete-de-test',
  temProjectId: '6f1c1c3e-2b8a-4c55-9a0f-0d3f5b2e7a41',
  from: { email: 'maison@exemple.invalid', name: 'Maison Triona' },
  notifyTo: 'cat@exemple.invalid',
  alertTo: 'sady@exemple.invalid',
  siteUrl: 'https://maisontriona.test',
}

const admin = testPool()
const site = new pg.Pool({
  connectionString: TEST_DATABASE_URL,
  options: '-c role=site_public',
  max: 4,
})
const envoi = envoiPool()

before(async () => {
  await resetDatabase(admin)
  await migrate(admin, MIGRATIONS)
  await applyRoles(admin)
})

after(async () => {
  await Promise.all([admin.end(), site.end(), envoi.end()])
})

beforeEach(async () => {
  await admin.query('DELETE FROM outbox')
  await admin.query('DELETE FROM bookings')
  await admin.query('DELETE FROM booking_tokens')
})

async function demander(adresse = ADRESSE, now = new Date()) {
  const outboxId = randomUUID()
  const lien = await requestAccessLink(site, {
    emailHmac: empreinteAdresse(adresse, SECRET),
    outboxId,
    now,
  })
  return { ...lien, outboxId }
}

// Toute la base en texte : ce qu'un lecteur de la base verrait.
async function toutLeTexte(): Promise<string> {
  const { rows: tables } = await admin.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  )
  const morceaux: string[] = []
  for (const { table_name } of tables) {
    const { rows } = await admin.query<{ ligne: string }>(
      `SELECT t::text AS ligne FROM "${table_name}" t`,
    )
    morceaux.push(...rows.map((row) => row.ligne))
  }
  return morceaux.join('\n').toLowerCase()
}

interface Banc {
  deps: OutboxDeps
  sent: OutgoingEmail[]
  logs: [OutboxLogStatus, string][]
  pauses: number[]
}

function banc(reponses: SendResult[] = [], now: () => Date = () => new Date()): Banc {
  const sent: OutgoingEmail[] = []
  const logs: [OutboxLogStatus, string][] = []
  const pauses: number[] = []
  const file = [...reponses]
  const transport: EmailTransport = {
    async send(message) {
      const index = sent.push(message)
      return file.shift() ?? { ok: true, providerId: `tem-${index}` }
    },
    async status() {
      return { ok: true, state: 'pending', flags: [] }
    },
  }
  return {
    deps: {
      pool: envoi,
      transport,
      config: CONFIG,
      now,
      newId: () => randomUUID(),
      log: (status, id) => logs.push([status, id]),
    },
    sent,
    logs,
    pauses,
  }
}

async function ligne(id: string) {
  const { rows } = await admin.query(
    'SELECT template, request_id, status, last_error, attempts FROM outbox WHERE id = $1',
    [id],
  )
  return rows[0]
}

async function alertes(): Promise<{ alert_event: string; alert_subject: string }[]> {
  const { rows } = await admin.query(
    "SELECT alert_event, alert_subject FROM outbox WHERE template = 'technical_alert'",
  )
  return rows
}

describe('demande de lien (site_public)', () => {
  it('crée le lien (empreintes seules) et son e-mail d’accès, dans une transaction', async () => {
    const lien = await demander()
    assert.match(lien.token, /^[A-Za-z0-9_-]{43}$/)

    const { rows: jetons } = await admin.query(
      'SELECT token_hash, purpose, email_hmac, created_at, expires_at FROM booking_tokens',
    )
    assert.equal(jetons.length, 1)
    assert.deepEqual(jetons[0].token_hash, hashToken(lien.token))
    assert.equal(jetons[0].purpose, 'access')
    assert.deepEqual(jetons[0].email_hmac, empreinteAdresse(ADRESSE.toLowerCase(), SECRET))
    assert.equal(jetons[0].expires_at.getTime() - jetons[0].created_at.getTime(), 48 * 60 * MINUTE)

    assert.deepEqual(await ligne(lien.outboxId), {
      template: 'booking_access',
      request_id: null,
      status: 'pending',
      last_error: null,
      attempts: 0,
    })
    assert.equal((await readBookingLink(site, lien.token, new Date())).state, 'valid')

    // Ni l'adresse, ni le jeton, ni sa forme base64 en clair, nulle part.
    const tout = await toutLeTexte()
    for (const interdit of [ADRESSE.toLowerCase(), 'hortense', lien.token.toLowerCase()]) {
      assert.ok(!tout.includes(interdit), interdit)
    }
  })

  it('un nouveau lien annule l’ancien de la même adresse, pas celui d’une autre', async () => {
    const premier = await demander('camille@exemple.test')
    const autre = await demander('ysolde@exemple.test')
    // Même adresse, autrement écrite : même empreinte.
    const second = await demander('  CAMILLE@exemple.test ')
    const now = new Date()
    assert.equal((await readBookingLink(site, premier.token, now)).state, 'invalid')
    assert.equal((await readBookingLink(site, second.token, now)).state, 'valid')
    assert.equal((await readBookingLink(site, autre.token, now)).state, 'valid')
    const { rows } = await admin.query(
      'SELECT count(*)::int AS n FROM booking_tokens WHERE revoked_at IS NOT NULL',
    )
    assert.equal(rows[0].n, 1)
    const { rows: messages } = await admin.query(
      "SELECT count(*)::int AS n FROM outbox WHERE template = 'booking_access'",
    )
    assert.equal(messages[0].n, 3)
  })

  it('deux demandes simultanées de la même adresse laissent un seul lien vivant', async () => {
    const resultats = await Promise.all([demander(), demander(), demander()])
    const now = new Date()
    const etats = await Promise.all(resultats.map((r) => readBookingLink(site, r.token, now)))
    assert.equal(etats.filter((etat) => etat.state === 'valid').length, 1)
  })

  it('rien n’est écrit si l’e-mail ne peut pas s’inscrire (identifiant refusé)', async () => {
    await assert.rejects(
      requestAccessLink(site, {
        emailHmac: empreinteAdresse(ADRESSE, SECRET),
        outboxId: 'pas-un-uuid',
        now: new Date(),
      }),
    )
    const { rows } = await admin.query('SELECT count(*)::int AS n FROM booking_tokens')
    assert.equal(rows[0].n, 0)
  })

  it('droits : créer un lien et annuler par empreinte, rien de plus', async () => {
    const lien = await demander()
    for (const sql of [
      'SELECT email_hmac FROM booking_tokens',
      'SELECT * FROM booking_tokens',
      'UPDATE booking_tokens SET revoked_at = now()',
      'UPDATE booking_tokens SET email_hmac = NULL',
      'DELETE FROM booking_tokens',
      'SELECT * FROM outbox',
      'UPDATE outbox SET status = $$failed$$',
      'DELETE FROM outbox',
    ]) {
      await assert.rejects(site.query(sql), REFUS, sql)
    }
    // La fonction n'annule que la cible donnée ; une empreinte inconnue n'annule rien.
    await site.query('SELECT revoke_live_access_links($1)', [Buffer.alloc(32, 9)])
    assert.equal((await readBookingLink(site, lien.token, new Date())).state, 'valid')
    await site.query('SELECT revoke_live_access_links($1)', [empreinteAdresse(ADRESSE, SECRET)])
    assert.equal((await readBookingLink(site, lien.token, new Date())).state, 'invalid')
    // Le rôle `coffre` (ni aucun autre rôle sans droit) ne l'appelle pas.
    const coffre = new pg.Pool({ connectionString: TEST_DATABASE_URL, options: '-c role=coffre' })
    try {
      await assert.rejects(
        coffre.query('SELECT revoke_live_access_links($1)', [Buffer.alloc(32, 1)]),
        REFUS,
      )
    } finally {
      await coffre.end()
    }
  })

  it('une annulation ne se pose qu’une fois et ne se retire jamais', async () => {
    const lien = await demander()
    await demander()
    const { rows } = await admin.query('SELECT id FROM booking_tokens WHERE token_hash = $1', [
      hashToken(lien.token),
    ])
    const id = rows[0].id
    await assert.rejects(
      admin.query('UPDATE booking_tokens SET revoked_at = NULL WHERE id = $1', [id]),
      CONTROLE,
    )
    await assert.rejects(
      admin.query('UPDATE booking_tokens SET revoked_at = now() WHERE id = $1', [id]),
      CONTROLE,
    )
  })

  it('un e-mail d’accès ne porte ni demande ni priorité', async () => {
    for (const sql of [
      `INSERT INTO outbox (id, template, request_id) VALUES (gen_random_uuid(), 'booking_access', gen_random_uuid())`,
      `INSERT INTO outbox (id, template, priority) VALUES (gen_random_uuid(), 'booking_access', true)`,
      `INSERT INTO outbox (id, template, alert_event) VALUES (gen_random_uuid(), 'booking_access', 'send_failed')`,
    ]) {
      await assert.rejects(admin.query(sql), CONTROLE, sql)
    }
  })
})

describe('e-mail d’accès (envoi)', () => {
  it('part au premier essai, avec le lien de la langue demandée, sans rien en base', async () => {
    const lien = await demander()
    const b = banc()
    await sendAccessLinkNow(b.deps, lien.outboxId, { to: ADRESSE, token: lien.token, locale: 'en' })
    assert.equal(b.sent.length, 1)
    const [mail] = b.sent
    assert.equal(mail?.to, ADRESSE)
    assert.deepEqual(mail?.from, CONFIG.from)
    assert.equal(mail?.subject, 'Your personal link · Maison Triona')
    assert.ok(mail?.text.includes(`https://maisontriona.test/en/contact/appel/${lien.token}\n`))
    assert.equal((await ligne(lien.outboxId)).status, 'accepted')
    assert.deepEqual(b.logs, [['sent', lien.outboxId]])
    // Journal : un statut et l'identifiant du message, jamais l'adresse ni le jeton.
    const journal = JSON.stringify(b.logs)
    assert.ok(!journal.includes(ADRESSE) && !journal.includes(lien.token))

    // Rejoué (double appel) : rien ne repart.
    await sendAccessLinkNow(b.deps, lien.outboxId, { to: ADRESSE, token: lien.token, locale: 'en' })
    assert.equal(b.sent.length, 1)
  })

  it('une erreur passagère laisse un second essai ; deux, et c’est l’échec avec une alerte', async () => {
    const indisponible: SendResult = { ok: false, retryable: true, code: 'http_503' }
    const reprise = await demander('reprise@exemple.test')
    const b1 = banc([indisponible])
    const contenu = { to: 'reprise@exemple.test', token: reprise.token, locale: 'fr' as const }
    await sendAccessLinkNow(b1.deps, reprise.outboxId, contenu, {
      sleep: async (ms) => void b1.pauses.push(ms),
    })
    assert.equal(b1.sent.length, 2)
    assert.deepEqual(b1.pauses, [2000])
    assert.equal((await ligne(reprise.outboxId)).status, 'accepted')
    assert.ok(b1.sent[0]?.text.includes(`/fr/contact/appel/${reprise.token}`))

    const echec = await demander('echec@exemple.test')
    const b2 = banc([indisponible, indisponible])
    await sendAccessLinkNow(
      b2.deps,
      echec.outboxId,
      { to: 'echec@exemple.test', token: echec.token, locale: 'fr' },
      { sleep: async () => {} },
    )
    assert.equal(b2.sent.length, 2)
    assert.deepEqual(await ligne(echec.outboxId), {
      template: 'booking_access',
      request_id: null,
      status: 'failed',
      last_error: 'http_503',
      attempts: 1,
    })
    assert.deepEqual(await alertes(), [
      { alert_event: 'send_failed', alert_subject: echec.outboxId },
    ])
    assert.deepEqual(b2.logs, [['failed:provider', echec.outboxId]])

    // Refus franc (4xx) : un seul essai.
    await admin.query('DELETE FROM outbox')
    const refus = await demander('refus@exemple.test')
    const b3 = banc([{ ok: false, retryable: false, code: 'http_400' }])
    await sendAccessLinkNow(
      b3.deps,
      refus.outboxId,
      { to: 'refus@exemple.test', token: refus.token, locale: 'fr' },
      { sleep: async () => assert.fail('aucune pause') },
    )
    assert.equal(b3.sent.length, 1)
    assert.equal((await ligne(refus.outboxId)).status, 'failed')
  })

  it('jeton mal formé : rien ne part, échec et alerte', async () => {
    const lien = await demander()
    const b = banc()
    await sendAccessLinkNow(b.deps, lien.outboxId, { to: ADRESSE, token: 'court', locale: 'fr' })
    assert.equal(b.sent.length, 0)
    assert.equal((await ligne(lien.outboxId)).last_error, 'render')
    assert.equal((await alertes()).length, 1)
  })

  it('la tâche planifiée laisse 5 minutes au premier essai, puis abandonne sans rien envoyer', async () => {
    const lien = await demander()
    const maintenant = new Date()
    // Juste après la demande : la tâche ne le réserve pas (le premier essai est en cours).
    assert.deepEqual(await claimDue(envoi, maintenant, 10), [])

    // Plus de 5 minutes après : ni adresse ni jeton à reprendre, échec `no_contact` et alerte.
    const plusTard = new Date(maintenant.getTime() + 6 * MINUTE)
    const b = banc([], () => plusTard)
    const bilan = await runOutbox(b.deps)
    assert.equal(b.sent.filter((mail) => mail.to === ADRESSE).length, 0)
    assert.equal(bilan.failed, 1)
    const etat = await ligne(lien.outboxId)
    assert.equal(etat.status, 'failed')
    assert.equal(etat.last_error, 'no_contact')
    assert.ok(b.logs.some(([statut, id]) => statut === 'failed:no-contact' && id === lien.outboxId))
    const [alerte] = await alertes()
    assert.equal(alerte?.alert_subject, lien.outboxId)
    for (const [, id] of b.logs) assert.match(id, UUID)
  })
})
