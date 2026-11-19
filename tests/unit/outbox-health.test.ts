import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Pool } from 'pg'

import { etatEnvoiDuCoffre } from '../../src/lib/auth/acces.ts'
import {
  emailSendingState,
  OUTBOX_HEALTH_DAYS,
  OUTBOX_LATE_MINUTES,
  outboxHealthLines,
} from '../../src/lib/outbox/health.ts'

// État de l'envoi des e-mails sur l'accueil du coffre (story 3.3, suites C) : phrases en français,
// apostrophe typographique, espace insécable avant « : », singulier et pluriel. Données factices.
// Lecture réservée à un accès autorisé (etatEnvoiDuCoffre, comme dernierPassageConservation).

const NBSP = ' '
const RIEN = { late: 0, failed: 0, unnotified: 0 }
const FULL = {
  TEM_SECRET_KEY: 'secret-key-value-123',
  TEM_PROJECT_ID: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  EMAIL_FROM: 'Maison Triona <no-reply@maisontriona.com>',
  EMAIL_NOTIFY_TO: 'cat@example.com',
  EMAIL_ALERT_TO: 'sady@example.com',
  SITE_URL: 'https://maisontriona.com',
}

describe('emailSendingState', () => {
  it('rien de posé : envoi coupé', () => {
    assert.equal(emailSendingState({}), 'off')
  })

  it('configuration complète : envoi allumé', () => {
    assert.equal(emailSendingState(FULL), 'on')
  })

  it('configuration à moitié posée ou invalide : incomplète', () => {
    assert.equal(emailSendingState({ TEM_SECRET_KEY: FULL.TEM_SECRET_KEY }), 'incomplete')
    assert.equal(emailSendingState({ ...FULL, TEM_PROJECT_ID: 'pas-un-uuid' }), 'incomplete')
  })
})

describe('outboxHealthLines', () => {
  it('garde les fenêtres de 15 minutes et de 7 jours', () => {
    assert.equal(OUTBOX_LATE_MINUTES, 15)
    assert.equal(OUTBOX_HEALTH_DAYS, 7)
  })

  it('envoi allumé, rien en retard ni en échec : rien à signaler', () => {
    assert.deepEqual(outboxHealthLines(RIEN, 'on'), {
      lines: [`Envoi des e-mails${NBSP}: rien à signaler.`],
      alert: false,
    })
  })

  it('messages en retard : la tâche planifiée ne passe peut-être plus', () => {
    assert.deepEqual(outboxHealthLines({ ...RIEN, late: 1 }, 'on'), {
      lines: [
        `Attention${NBSP}: 1 message en attente depuis plus de 15 minutes. La tâche planifiée ne passe peut-être plus.`,
      ],
      alert: true,
    })
    assert.deepEqual(outboxHealthLines({ ...RIEN, late: 3 }, 'on').lines, [
      `Attention${NBSP}: 3 messages en attente depuis plus de 15 minutes. La tâche planifiée ne passe peut-être plus.`,
    ])
  })

  it('messages en échec ces 7 derniers jours', () => {
    assert.deepEqual(outboxHealthLines({ ...RIEN, failed: 1 }, 'on'), {
      lines: [`Attention${NBSP}: 1 message n’a pas pu être envoyé ou livré ces 7 derniers jours.`],
      alert: true,
    })
    assert.deepEqual(outboxHealthLines({ ...RIEN, failed: 2 }, 'on').lines, [
      `Attention${NBSP}: 2 messages n’ont pas pu être envoyés ou livrés ces 7 derniers jours.`,
    ])
  })

  it('demandes sans notification, envoi allumé : une alerte', () => {
    assert.deepEqual(outboxHealthLines({ ...RIEN, unnotified: 1 }, 'on'), {
      lines: [
        `Attention${NBSP}: 1 demande de ces 7 derniers jours n’a pas fait l’objet d’une notification par e-mail. Elle est bien enregistrée dans le coffre.`,
      ],
      alert: true,
    })
    assert.deepEqual(outboxHealthLines({ ...RIEN, unnotified: 4 }, 'on').lines, [
      `Attention${NBSP}: 4 demandes de ces 7 derniers jours n’ont pas fait l’objet d’une notification par e-mail. Elles sont bien enregistrées dans le coffre.`,
    ])
  })

  it('plusieurs problèmes : une phrase chacun, retard, échecs puis demandes', () => {
    const { lines, alert } = outboxHealthLines({ late: 2, failed: 1, unnotified: 3 }, 'on')
    assert.equal(alert, true)
    assert.equal(lines.length, 3)
    assert.match(lines[0]!, /^Attention : 2 messages en attente/)
    assert.match(lines[1]!, /^Attention : 1 message n’a pas pu/)
    assert.match(lines[2]!, /^Attention : 3 demandes de ces 7 derniers jours/)
  })

  it('envoi coupé : une phrase sans alerte, et le compte des demandes sans notification', () => {
    assert.deepEqual(outboxHealthLines(RIEN, 'off'), {
      lines: [`L’envoi des e-mails est coupé${NBSP}: aucune notification ne part.`],
      alert: false,
    })
    assert.deepEqual(outboxHealthLines({ ...RIEN, unnotified: 1 }, 'off'), {
      lines: [
        `L’envoi des e-mails est coupé${NBSP}: aucune notification ne part.`,
        '1 demande de ces 7 derniers jours n’a pas fait l’objet d’une notification par e-mail. Elle est bien enregistrée dans le coffre.',
      ],
      alert: false,
    })
    assert.equal(
      outboxHealthLines({ ...RIEN, unnotified: 5 }, 'off').lines.at(-1),
      '5 demandes de ces 7 derniers jours n’ont pas fait l’objet d’une notification par e-mail. Elles sont bien enregistrées dans le coffre.',
    )
  })

  it('envoi coupé : ni retard ni échec signalés (rien ne part, la tâche ne reprend rien)', () => {
    assert.deepEqual(outboxHealthLines({ late: 4, failed: 2, unnotified: 0 }, 'off'), {
      lines: [`L’envoi des e-mails est coupé${NBSP}: aucune notification ne part.`],
      alert: false,
    })
  })

  it('configuration incomplète : une alerte, les échecs et les demandes sans notification', () => {
    assert.deepEqual(outboxHealthLines(RIEN, 'incomplete'), {
      lines: [
        `Attention${NBSP}: la configuration des e-mails est incomplète ou invalide, aucune notification ne part.`,
      ],
      alert: true,
    })
    const { lines, alert } = outboxHealthLines({ late: 6, failed: 1, unnotified: 2 }, 'incomplete')
    assert.equal(alert, true)
    // Le retard découle de la configuration : pas de phrase sur la tâche planifiée.
    assert.equal(lines.length, 3)
    assert.match(lines[1]!, /^Attention : 1 message n’a pas pu/)
    assert.match(lines[2]!, /^Attention : 2 demandes de ces 7 derniers jours/)
  })

  it('refuse un compte négatif ou non entier', () => {
    assert.throws(() => outboxHealthLines({ ...RIEN, late: -1 }, 'on'), RangeError)
    assert.throws(() => outboxHealthLines({ ...RIEN, failed: 1.5 }, 'on'), RangeError)
    assert.throws(() => outboxHealthLines({ ...RIEN, unnotified: Number.NaN }, 'on'), RangeError)
  })
})

describe('etatEnvoiDuCoffre', () => {
  it('sans accès autorisé : null, sans aucune requête', async () => {
    let requetes = 0
    const pool = {
      query: async () => {
        requetes += 1
        throw new Error('aucune requête attendue')
      },
    } as unknown as Pool
    const compte = { id: 'u1', email: 'u1@exemple.test', nom: 'Compte factice' }
    const maintenant = new Date('2027-03-10T12:00:00Z')
    assert.equal(await etatEnvoiDuCoffre(pool, { etat: 'anonyme' }, maintenant), null)
    assert.equal(await etatEnvoiDuCoffre(pool, { etat: 'enrolement', compte }, maintenant), null)
    assert.equal(requetes, 0)
  })
})
