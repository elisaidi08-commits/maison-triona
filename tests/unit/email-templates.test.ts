import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { renderAlert, renderNotification } from '../../src/lib/email/templates.ts'

const ID = '3f2b8c1e-5d4a-4e6b-9a7c-1b2d3e4f5a6b'
const SITE = 'https://maisontriona.com'
// Espace insécable (U+00A0) : celle de messages/fr.json avant « : ».
const N = ' '

describe('renderNotification', () => {
  it('écrit une notification neutre, sans rien de la demande', () => {
    const mail = renderNotification({
      requestId: ID,
      priority: false,
      createdAt: new Date('2026-11-18T21:14:00Z'),
      siteUrl: SITE,
    })
    assert.equal(mail.subject, 'Nouvelle demande · Maison Triona')
    assert.equal(
      mail.text,
      [
        `Une demande est arrivée le mercredi 18 novembre 2026 à 22${N}h${N}14.`,
        '',
        `Pour la lire, ouvrez le coffre${N}:`,
        `${SITE}/coffre/demandes/${ID}`,
        '',
        'Ce message ne contient rien de la demande.',
      ].join('\n'),
    )
  })

  it('ajoute « Prioritaire » au sujet', () => {
    const mail = renderNotification({
      requestId: ID,
      priority: true,
      createdAt: new Date('2026-11-18T21:14:00Z'),
      siteUrl: SITE,
    })
    assert.equal(mail.subject, 'Nouvelle demande · Maison Triona · Prioritaire')
  })

  it("passe à l'heure d'été et complète les minutes", () => {
    const mail = renderNotification({
      requestId: ID,
      priority: false,
      createdAt: new Date('2026-07-01T07:05:00Z'),
      siteUrl: SITE,
    })
    assert.ok(
      mail.text.startsWith(`Une demande est arrivée le mercredi 1 juillet 2026 à 9${N}h${N}05.`),
    )
  })

  it('refuse un identifiant qui n’est pas un UUID', () => {
    assert.throws(
      () =>
        renderNotification({
          requestId: 'secret-pas-uuid',
          priority: false,
          createdAt: new Date(),
          siteUrl: SITE,
        }),
      (e: unknown) => e instanceof RangeError && !String((e as Error).message).includes('secret'),
    )
  })

  it('refuse une adresse du site qui finit par une barre oblique', () => {
    assert.throws(
      () =>
        renderNotification({
          requestId: ID,
          priority: false,
          createdAt: new Date(),
          siteUrl: `${SITE}/`,
        }),
      RangeError,
    )
  })
})

describe('renderAlert', () => {
  const createdAt = new Date('2026-11-18T21:14:00Z')
  const cases = [
    ['send_failed', 'Échec définitif de l’envoi.'],
    ['undelivered', 'Message non délivré au destinataire.'],
    ['tracking_expired', 'Livraison non confirmée après 72 heures.'],
  ] as const

  for (const [event, line] of cases) {
    it(`écrit l’alerte ${event}`, () => {
      const mail = renderAlert({ event, subjectId: ID, createdAt })
      assert.equal(mail.subject, 'Alerte technique · Maison Triona')
      assert.equal(
        mail.text,
        [
          line,
          '',
          `Identifiant du message${N}: ${ID}`,
          `Date${N}: mercredi 18 novembre 2026 à 22${N}h${N}14`,
          '',
          'Aucune donnée de demande dans ce message.',
        ].join('\n'),
      )
    })
  }

  it('écrit l’alerte notify_cap, sans identifiant de message', () => {
    const mail = renderAlert({ event: 'notify_cap', subjectId: null, createdAt })
    assert.equal(mail.subject, 'Alerte technique · Maison Triona')
    assert.equal(
      mail.text,
      [
        `Plafond de notifications atteint${N}: les demandes suivantes de la journée sont enregistrées dans le coffre, sans e-mail.`,
        '',
        `Date${N}: mercredi 18 novembre 2026 à 22${N}h${N}14`,
        '',
        'Aucune donnée de demande dans ce message.',
      ].join('\n'),
    )
  })

  // Plafond global des demandes de lien (3.9, suites, D72) : la date seulement.
  it('écrit l’alerte link_cap, sans identifiant de message', () => {
    const mail = renderAlert({ event: 'link_cap', subjectId: null, createdAt })
    assert.equal(mail.subject, 'Alerte technique · Maison Triona')
    assert.equal(
      mail.text,
      [
        `Plafond des demandes de lien atteint${N}: jusqu’à minuit UTC, plus aucun lien de réservation n’est créé ni envoyé, mais la page annonce l’envoi au visiteur.`,
        '',
        `Date${N}: mercredi 18 novembre 2026 à 22${N}h${N}14`,
        '',
        'Aucune donnée de demande dans ce message.',
      ].join('\n'),
    )
  })

  it('exige un identifiant pour une alerte sur un message, aucun pour les plafonds', () => {
    for (const event of ['send_failed', 'undelivered', 'tracking_expired'] as const) {
      assert.throws(() => renderAlert({ event, subjectId: null, createdAt }), RangeError, event)
    }
    for (const event of ['notify_cap', 'link_cap'] as const) {
      assert.throws(() => renderAlert({ event, subjectId: ID, createdAt }), RangeError, event)
    }
  })

  it('refuse un identifiant invalide et un événement inconnu', () => {
    assert.throws(
      () => renderAlert({ event: 'send_failed', subjectId: 'x', createdAt }),
      RangeError,
    )
    assert.throws(
      () => renderAlert({ event: 'autre' as never, subjectId: ID, createdAt }),
      RangeError,
    )
  })
})

describe('aucune fuite de la demande', () => {
  it('ne contient aucun champ de la demande', () => {
    // Les gabarits ne reçoivent aucun champ de la demande : ce test documente la garantie.
    const request = {
      name: 'Hortense Fuite-Simulée',
      email: 'hortense.fuite@example.test',
      phone: '+32 470 00 00 00',
      service: 'grand-age',
      country: 'BE',
    }
    const createdAt = new Date('2026-11-18T21:14:00Z')
    const mails = [
      renderNotification({ requestId: ID, priority: true, createdAt, siteUrl: SITE }),
      renderNotification({ requestId: ID, priority: false, createdAt, siteUrl: SITE }),
      renderAlert({ event: 'send_failed', subjectId: ID, createdAt }),
      renderAlert({ event: 'undelivered', subjectId: ID, createdAt }),
      renderAlert({ event: 'tracking_expired', subjectId: ID, createdAt }),
      renderAlert({ event: 'notify_cap', subjectId: null, createdAt }),
      renderAlert({ event: 'link_cap', subjectId: null, createdAt }),
    ]
    for (const mail of mails) {
      for (const value of Object.values(request)) {
        assert.ok(!mail.subject.includes(value), `sujet : ${value}`)
        assert.ok(!mail.text.includes(value), `texte : ${value}`)
      }
    }
  })
})
