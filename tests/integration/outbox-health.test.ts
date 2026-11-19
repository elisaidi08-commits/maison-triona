import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { etatEnvoiDuCoffre } from '../../src/lib/auth/acces.ts'
import { migrate } from '../../src/lib/db/migrate.ts'
import { outboxHealth } from '../../src/lib/outbox/health.ts'
import { insertRequest } from '../../src/lib/vault/repository.ts'
import { applyRoles, coffrePool, resetDatabase, testPool } from './helpers.ts'

// État de l'envoi des e-mails (story 3.3, suites C) : trois comptes et leurs fenêtres, lus sous le
// rôle `coffre` (connexion qui prend le rôle dès l'ouverture, comme l'espace /coffre) : les droits
// par colonne de db/roles/coffre.sql suffisent. Données factices ; l'administrateur écrit.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const MAINTENANT = new Date('2027-03-10T12:00:00Z')
const MINUTE = 60_000
const JOUR = 24 * 60 * MINUTE
const admin = testPool()
const coffre = coffrePool()

function avant(ms: number): Date {
  return new Date(MAINTENANT.getTime() - ms)
}

async function message(colonnes: {
  template?: 'request_notification' | 'technical_alert'
  requestId?: string | null
  status?: 'pending' | 'accepted' | 'delivered' | 'undelivered' | 'failed'
  nextAttemptAt?: Date
  createdAt?: Date
}): Promise<void> {
  const template = colonnes.template ?? 'request_notification'
  const status = colonnes.status ?? 'pending'
  const accepte = status === 'accepted' || status === 'delivered' || status === 'undelivered'
  await admin.query(
    `INSERT INTO outbox (id, template, request_id, alert_event, alert_subject, status,
                         next_attempt_at, created_at, provider_id, accepted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      randomUUID(),
      template,
      colonnes.requestId === undefined
        ? template === 'request_notification'
          ? randomUUID()
          : null
        : colonnes.requestId,
      template === 'technical_alert' ? 'send_failed' : null,
      template === 'technical_alert' ? randomUUID() : null,
      status,
      colonnes.nextAttemptAt ?? MAINTENANT,
      colonnes.createdAt ?? avant(MINUTE),
      accepte ? 'tem-factice' : null,
      accepte ? avant(MINUTE) : null,
    ],
  )
}

async function demande(creeeLe: Date): Promise<string> {
  const id = await insertRequest(admin, {
    kind: 'request',
    service: 'conciergerie',
    country: 'BE',
    locale: 'fr',
    urgency: 'aucune',
    source: null,
    sealed: new Uint8Array(randomBytes(64)),
    retentionUntil: new Date('2028-06-01T00:00:00Z'),
    privacyVersion: '2026-11-18',
  })
  await admin.query('UPDATE vault_requests SET created_at = $2 WHERE id = $1', [id, creeeLe])
  return id
}

describe('état de l’envoi des e-mails (accueil du coffre)', () => {
  before(async () => {
    await resetDatabase(admin)
    await migrate(admin, MIGRATIONS)
    await applyRoles(admin)
  })
  beforeEach(async () => {
    await admin.query('DELETE FROM outbox')
    await admin.query('DELETE FROM vault_requests')
  })
  after(async () => {
    await coffre.end()
    await admin.end()
  })

  it('boîte vide, aucune demande : trois zéros', async () => {
    assert.deepEqual(await outboxHealth(coffre, MAINTENANT), { late: 0, failed: 0, unnotified: 0 })
  })

  it('en retard : en attente et dus depuis plus de 15 minutes, pas au-delà', async () => {
    await message({ nextAttemptAt: avant(16 * MINUTE) })
    await message({ template: 'technical_alert', nextAttemptAt: avant(3 * 60 * MINUTE) })
    await message({ nextAttemptAt: avant(15 * MINUTE) }) // juste à la limite : pas encore
    await message({ nextAttemptAt: avant(14 * MINUTE) })
    await message({ nextAttemptAt: new Date(MAINTENANT.getTime() + 5 * MINUTE) }) // reprise prévue
    await message({ status: 'failed', nextAttemptAt: avant(60 * MINUTE) })
    await message({ status: 'accepted', nextAttemptAt: avant(60 * MINUTE) })
    const etat = await outboxHealth(coffre, MAINTENANT)
    assert.equal(etat.late, 2)
  })

  it('en échec : échoués ou non délivrés, notifications et alertes, sur 7 jours', async () => {
    await message({ status: 'failed', createdAt: avant(JOUR) })
    await message({
      template: 'technical_alert',
      status: 'undelivered',
      createdAt: avant(6 * JOUR),
    })
    await message({ template: 'technical_alert', status: 'failed', createdAt: avant(7 * JOUR) })
    await message({ status: 'failed', createdAt: avant(7 * JOUR + MINUTE) }) // hors fenêtre
    await message({ status: 'delivered', createdAt: avant(JOUR) })
    await message({ status: 'accepted', createdAt: avant(JOUR) })
    await message({ status: 'pending', createdAt: avant(JOUR) })
    const etat = await outboxHealth(coffre, MAINTENANT)
    assert.equal(etat.failed, 3)
  })

  it('sans notification : demandes des 7 derniers jours sans notification à leur nom', async () => {
    const notifiee = await demande(avant(JOUR))
    await message({ requestId: notifiee, status: 'delivered' })
    const echouee = await demande(avant(JOUR))
    await message({ requestId: echouee, status: 'failed' }) // comptée en échec, pas ici
    await demande(avant(2 * JOUR)) // jamais notifiée (`failed:outbox`, envoi coupé, plafond)
    await demande(avant(7 * JOUR)) // à la limite : dans la fenêtre
    const alerteSeule = await demande(avant(3 * JOUR))
    await message({ template: 'technical_alert', requestId: alerteSeule })
    await demande(avant(7 * JOUR + MINUTE)) // hors fenêtre
    const etat = await outboxHealth(coffre, MAINTENANT)
    assert.deepEqual(etat, { late: 0, failed: 1, unnotified: 3 })
  })

  it('refuse une date invalide, sans requête', async () => {
    await assert.rejects(outboxHealth(coffre, new Date(Number.NaN)), RangeError)
  })

  it('accès autorisé : les mêmes comptes, par etatEnvoiDuCoffre', async () => {
    await message({ status: 'failed', createdAt: avant(JOUR) })
    await demande(avant(JOUR))
    const acces = {
      etat: 'autorise' as const,
      compte: { id: 'u1', email: 'u1@exemple.test', nom: 'Compte factice' },
    }
    assert.deepEqual(await etatEnvoiDuCoffre(coffre, acces, MAINTENANT), {
      late: 0,
      failed: 1,
      unnotified: 1,
    })
  })
})
