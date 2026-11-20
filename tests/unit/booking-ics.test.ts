import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { bookingUid, buildIcs, ICS_DOMAIN } from '../../src/lib/booking/ics.ts'

// Invitation d'agenda de la personne (story 3.10 ; docs/reservation-appel.md §4.5) : sous-ensemble de
// RFC 5545 écrit à la main, sans dépendance. UID stable, heures en UTC, texte échappé et replié à
// 75 octets, aucun nom de service ni rien de sensible.

const ID = '6f1c2b8e-3a4d-4e5f-9a0b-1c2d3e4f5a6b'
const EVENEMENT = {
  uid: bookingUid(ID, 'guest'),
  start: new Date('2027-03-02T09:30:00Z'),
  end: new Date('2027-03-02T10:00:00Z'),
  stamp: new Date('2027-03-01T08:15:42.123Z'),
  summary: 'Appel · Maison Triona',
  description: 'Nous vous appelons au numéro indiqué.',
}

// Lignes logiques : repliement défait (CRLF suivi d'une espace), puis découpe sur CRLF.
function lignes(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n')
}

function messages(locale: 'fr' | 'en'): { summary: string; description: string } {
  const json = JSON.parse(
    readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), 'utf8'),
  )
  return json.Booking.ics
}

describe('invitation .ics', () => {
  it('écrit un calendrier RFC 5545 de base : CRLF, enveloppes, propriétés obligatoires', () => {
    const ics = buildIcs(EVENEMENT)
    assert.ok(ics.endsWith('\r\n'))
    assert.equal(ics.replace(/\r\n/g, '').includes('\n'), false, 'aucun saut de ligne nu')
    const l = lignes(ics)
    assert.equal(l[0], 'BEGIN:VCALENDAR')
    assert.equal(l.at(-2), 'END:VCALENDAR')
    assert.equal(l.at(-1), '')
    for (const attendue of [
      'VERSION:2.0',
      'PRODID:-//Maison Triona//Appel//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${ID}-guest@${ICS_DOMAIN}`,
      'DTSTAMP:20270301T081542Z',
      'DTSTART:20270302T093000Z',
      'DTEND:20270302T100000Z',
      'SEQUENCE:0',
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'SUMMARY:Appel · Maison Triona',
      'DESCRIPTION:Nous vous appelons au numéro indiqué.',
      'END:VEVENT',
    ]) {
      assert.ok(l.includes(attendue), attendue)
    }
    assert.equal(l.filter((ligne) => ligne === 'BEGIN:VEVENT').length, 1)
  })

  it('garde un UID stable par réservation et par destinataire', () => {
    assert.equal(bookingUid(ID, 'guest'), `${ID}-guest@maisontriona.com`)
    assert.equal(bookingUid(ID, 'host'), `${ID}-host@maisontriona.com`)
    assert.equal(
      buildIcs(EVENEMENT).match(/^UID:.*$/m)?.[0],
      buildIcs({ ...EVENEMENT, stamp: new Date('2027-03-05T00:00:00Z') }).match(/^UID:.*$/m)?.[0],
    )
    assert.throws(() => bookingUid('pas-un-uuid', 'guest'), RangeError)
  })

  it('échappe le texte (antislash, point-virgule, virgule, retour à la ligne)', () => {
    const ics = buildIcs({ ...EVENEMENT, summary: 'a\\b;c,d\ne', description: 'x\r\ny' })
    const l = lignes(ics)
    assert.ok(l.includes('SUMMARY:a\\\\b\\;c\\,d\\ne'))
    assert.ok(l.includes('DESCRIPTION:x\\ny'))
  })

  it('replie les lignes à 75 octets sans couper un caractère', () => {
    const description = 'Été à Bruxelles — '.repeat(12)
    const ics = buildIcs({ ...EVENEMENT, description })
    for (const ligne of ics.split('\r\n')) {
      assert.ok(Buffer.byteLength(ligne, 'utf8') <= 75, ligne)
      assert.equal(Buffer.from(ligne, 'utf8').toString('utf8'), ligne)
    }
    assert.ok(lignes(ics).includes(`DESCRIPTION:${description}`))
  })

  it('ne contient ni nom de service, ni rien de sensible, en français comme en anglais', () => {
    for (const locale of ['fr', 'en'] as const) {
      const ics = buildIcs({ ...EVENEMENT, ...messages(locale) }).toLowerCase()
      for (const interdit of [
        'concierg',
        'grand',
        'âge',
        'later life',
        'enfant',
        'child',
        'garde',
        'santé',
        'health',
        'soin',
        'care',
        'http',
        'tel:',
        '@exemple',
      ]) {
        assert.equal(ics.includes(interdit), false, `${locale} : ${interdit}`)
      }
      // Aucune adresse ni lien : seul l'UID porte un « @ ».
      assert.equal(ics.match(/@/g)?.length, 1)
    }
  })

  it('refuse des dates invalides ou une fin avant le début', () => {
    assert.throws(() => buildIcs({ ...EVENEMENT, start: new Date(Number.NaN) }), RangeError)
    assert.throws(() => buildIcs({ ...EVENEMENT, end: EVENEMENT.start }), RangeError)
  })

  // Story 3.11 : un appel déplacé garde son UID, avec une séquence plus grande ; un appel annulé
  // donne un fichier METHOD:CANCEL qui retire l'événement.
  it('met à jour un appel déplacé : même UID, SEQUENCE incrémentée, nouvelles heures', () => {
    const avant = lignes(buildIcs(EVENEMENT))
    const apres = lignes(
      buildIcs({
        ...EVENEMENT,
        start: new Date('2027-03-03T15:00:00Z'),
        end: new Date('2027-03-03T15:30:00Z'),
        sequence: 1,
      }),
    )
    const uid = (l: string[]) => l.find((ligne) => ligne.startsWith('UID:'))
    assert.equal(uid(apres), uid(avant))
    assert.ok(apres.includes('SEQUENCE:1'))
    assert.ok(apres.includes('METHOD:PUBLISH'))
    assert.ok(apres.includes('STATUS:CONFIRMED'))
    assert.ok(apres.includes('DTSTART:20270303T150000Z'))
    assert.ok(apres.includes('DTEND:20270303T153000Z'))
  })

  it('retire un appel annulé : METHOD:CANCEL, STATUS:CANCELLED, même UID et sa séquence', () => {
    const l = lignes(buildIcs({ ...EVENEMENT, sequence: 2, method: 'CANCEL' }))
    assert.ok(l.includes('METHOD:CANCEL'))
    assert.ok(l.includes('STATUS:CANCELLED'))
    assert.ok(l.includes('SEQUENCE:2'))
    assert.ok(l.includes(`UID:${ID}-guest@${ICS_DOMAIN}`))
    assert.equal(l.includes('METHOD:PUBLISH'), false)
    assert.equal(l.includes('STATUS:CONFIRMED'), false)
  })

  it('refuse une séquence négative ou fractionnaire et une méthode inconnue', () => {
    assert.throws(() => buildIcs({ ...EVENEMENT, sequence: -1 }), RangeError)
    assert.throws(() => buildIcs({ ...EVENEMENT, sequence: 1.5 }), RangeError)
    assert.throws(() => buildIcs({ ...EVENEMENT, method: 'REQUEST' as 'PUBLISH' }), RangeError)
  })
})
