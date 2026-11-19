import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import sodium from 'libsodium-wrappers-sumo'

import { openSealed, openSealedBooking, VaultOpenError } from '../../src/lib/vault/open.ts'
import type { VaultKeys } from '../../src/lib/vault/open.ts'
import {
  BOOKING_SEALED_BYTES,
  sealBooking,
  sealRequest,
  VaultKeyError,
} from '../../src/lib/vault/seal.ts'
import type { SealedBookingFields } from '../../src/lib/vault/seal.ts'

// Scellé d'une réservation d'appel (story 3.10) : même sealed box que les demandes, clé publique du
// coffre, taille fixe de 2 Kio (2 096 octets scellés), ouvert seulement avec la clé privée (agenda
// de Cat, story 3.13). Données factices uniquement.

const CHAMPS: SealedBookingFields = {
  nom: 'Hortense Factice-Été',
  telephone: '+32 470 12 34 56',
  langue: 'en',
  sms: true,
  origine: 'salon',
}

let cles: VaultKeys
let clePublique: string

function contient(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer
    return true
  }
  return false
}

describe('scellé d’une réservation', () => {
  before(async () => {
    await sodium.ready
    const paire = sodium.crypto_box_keypair()
    cles = { publicKey: paire.publicKey, privateKey: paire.privateKey }
    clePublique = sodium.to_base64(paire.publicKey, sodium.base64_variants.ORIGINAL)
  })

  it('rouvre exactement ce qui a été scellé', async () => {
    const octets = await sealBooking(CHAMPS, clePublique)
    assert.deepEqual(await openSealedBooking(octets, cles), CHAMPS)
    const sansOption = { ...CHAMPS, sms: false, origine: null, langue: 'fr' as const }
    assert.deepEqual(
      await openSealedBooking(await sealBooking(sansOption, clePublique), cles),
      sansOption,
    )
  })

  it('a toujours la même taille, et ne laisse rien de lisible', async () => {
    const court = await sealBooking({ ...CHAMPS, nom: 'Al', origine: null }, clePublique)
    const long = await sealBooking(
      { ...CHAMPS, nom: '"'.repeat(120), telephone: '+'.repeat(30) },
      clePublique,
    )
    assert.equal(court.length, BOOKING_SEALED_BYTES)
    assert.equal(long.length, BOOKING_SEALED_BYTES)
    assert.equal(BOOKING_SEALED_BYTES, 2096)
    const octets = await sealBooking(CHAMPS, clePublique)
    for (const valeur of ['Hortense', '470 12 34', 'salon']) {
      assert.equal(contient(octets, sodium.from_string(valeur)), false, valeur)
    }
    assert.notDeepEqual(await sealBooking(CHAMPS, clePublique), octets)
  })

  it('fait tenir le plus long nom, échappé au pire, sous 2 Kio', async () => {
    // 120 caractères de contrôle, chacun échappé en six octets (\u0001) par JSON.
    const octets = await sealBooking({ ...CHAMPS, nom: '\u0001'.repeat(120) }, clePublique)
    assert.equal((await openSealedBooking(octets, cles)).nom.length, 120)
  })

  it('refuse un texte trop long et une clé invalide, sans rien citer', async () => {
    await assert.rejects(
      sealBooking({ ...CHAMPS, nom: 'Ysolde'.repeat(400) }, clePublique),
      (erreur: Error) => erreur instanceof RangeError && !erreur.message.includes('Ysolde'),
    )
    await assert.rejects(sealBooking(CHAMPS, 'pas-une-cle'), VaultKeyError)
  })

  it('ne confond pas une réservation et une demande', async () => {
    const reservation = await sealBooking(CHAMPS, clePublique)
    await assert.rejects(openSealed(reservation, cles), VaultOpenError)
    const demande = await sealRequest(
      { nom: 'X Y', email: null, telephone: null, pourQui: null, creneau: null, message: null },
      clePublique,
    )
    await assert.rejects(openSealedBooking(demande, cles), VaultOpenError)
    const autre = sodium.crypto_box_keypair()
    await assert.rejects(
      openSealedBooking(reservation, { publicKey: autre.publicKey, privateKey: autre.privateKey }),
      VaultOpenError,
    )
  })
})
