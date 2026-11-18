import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { before, describe, it } from 'node:test'

import sodium from 'libsodium-wrappers-sumo'

import { createKeyPacket } from '../../src/lib/vault/key-packet.ts'
import type { KeyPacket } from '../../src/lib/vault/key-packet.ts'
import {
  addPassphrase,
  openSealed,
  unlockPrivateKey,
  VaultOpenError,
} from '../../src/lib/vault/open.ts'
import type { VaultKeys } from '../../src/lib/vault/open.ts'
import { validerDemande } from '../../src/lib/validation/demande.ts'
import {
  SEALED_BYTES,
  SEALED_PLAINTEXT_BYTES,
  sealRequest,
  VaultKeyError,
} from '../../src/lib/vault/seal.ts'
import type { SealedFields } from '../../src/lib/vault/seal.ts'
import { splitRequest } from '../../src/lib/vault/store.ts'

// Sealed box (story 3.2, partie B) : aller-retour, mauvaise clé, octets altérés, phrase de passe,
// paramètres Argon2id. Données factices uniquement.

const PHRASE = 'quatre mots tirés au hasard, une phrase factice'
const CHAMPS: SealedFields = {
  nom: 'Camille Factice-Été',
  email: 'camille.factice@example.test',
  telephone: '+32 470 00 00 00',
  pourQui: 'proche',
  creneau: 'matin',
  message: 'Pour ma mère, à Namur.\nDe préférence en semaine ; « merci » 🌿',
}

function base64(bytes: Uint8Array): string {
  return sodium.to_base64(bytes, sodium.base64_variants.ORIGINAL)
}

function contient(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer
    return true
  }
  return false
}

let paquet: KeyPacket
let clePublique: string
let cles: VaultKeys

describe('sealed box du coffre', () => {
  before(async () => {
    await sodium.ready
    const cree = await createKeyPacket(PHRASE)
    paquet = cree.packet
    clePublique = cree.publicKey
    cles = await unlockPrivateKey(paquet, PHRASE)
  })

  it('rouvre exactement ce qui a été scellé, accents, retours à la ligne et vides compris', async () => {
    const octets = await sealRequest(CHAMPS, clePublique)
    assert.deepEqual(await openSealed(octets, cles), CHAMPS)

    const vides: SealedFields = {
      ...CHAMPS,
      email: null,
      pourQui: null,
      creneau: null,
      message: null,
    }
    assert.deepEqual(await openSealed(await sealRequest(vides, clePublique), cles), vides)
  })

  it('ne laisse aucun champ lisible dans les octets, et deux sceaux du même texte diffèrent', async () => {
    const octets = await sealRequest(CHAMPS, clePublique)
    assert.ok(octets.length >= 49)
    for (const valeur of [CHAMPS.nom, CHAMPS.email, CHAMPS.telephone, 'Namur', 'proche']) {
      assert.equal(contient(octets, sodium.from_string(valeur!)), false, 'valeur lisible')
    }
    const encore = await sealRequest(CHAMPS, clePublique)
    assert.notDeepEqual(encore, octets)
  })

  it('donne toujours la même taille, 16 Kio de texte complété, quelle que soit la demande', async () => {
    assert.equal(SEALED_PLAINTEXT_BYTES, 16 * 1024)
    assert.equal(SEALED_BYTES, 16 * 1024 + sodium.crypto_box_SEALBYTES)
    const courte = await sealRequest({ ...CHAMPS, email: null, message: null }, clePublique)
    assert.equal(courte.length, SEALED_BYTES)
    assert.equal((await sealRequest(CHAMPS, clePublique)).length, SEALED_BYTES)
  })

  it('fait tenir la plus longue demande acceptée par la validation', async () => {
    // Pire cas : chaque caractère libre devient \u0001 en JSON (6 octets).
    const resultat = validerDemande({
      besoin: 'indecis',
      pourQui: 'non-dit',
      pays: 'ailleurs',
      urgence: 'semaines',
      nom: '\u0001'.repeat(120),
      email: `${'a'.repeat(248)}@ex.be`,
      telephone: '+1 2 3 4 5 6 7 8 9 0 1 2 3 4 5',
      creneau: 'apres-midi',
      langue: 'fr',
      message: '\u0001'.repeat(2000),
      origine: 'bouche-a-oreille',
      consentement: 'oui',
    })
    assert.ok(resultat.succes, 'demande maximale refusée par la validation')
    const { sealed } = splitRequest(resultat.demande)
    assert.equal(sealed.email?.length, 254)
    assert.equal(sealed.telephone?.length, 30)
    const octets = await sealRequest(sealed, clePublique)
    assert.equal(octets.length, SEALED_BYTES)
    assert.deepEqual(await openSealed(octets, cles), sealed)
  })

  it('refuse un texte qui dépasse 16 Kio, sans le citer', async () => {
    const trop = { ...CHAMPS, message: `${'\u0001'.repeat(2800)}témoin` }
    await assert.rejects(sealRequest(trop, clePublique), (error: unknown) => {
      assert.ok(error instanceof RangeError)
      assert.ok(!error.message.includes('témoin') && !error.message.includes(CHAMPS.nom))
      return true
    })
  })

  it('échoue avec une autre clé', async () => {
    const octets = await sealRequest(CHAMPS, clePublique)
    const autre = sodium.crypto_box_keypair()
    await assert.rejects(openSealed(octets, autre), VaultOpenError)
  })

  it('échoue sur des octets altérés ou tronqués', async () => {
    const octets = await sealRequest(CHAMPS, clePublique)
    for (const position of [0, 31, 32, 47, 48, Math.floor(octets.length / 2), octets.length - 1]) {
      const altere = new Uint8Array(octets)
      altere[position]! ^= 0x01
      await assert.rejects(openSealed(altere, cles), VaultOpenError, `octet ${position}`)
    }
    await assert.rejects(openSealed(octets.slice(0, octets.length - 1), cles), VaultOpenError)
    await assert.rejects(openSealed(octets.slice(0, 40), cles), VaultOpenError)
  })

  it('refuse une clé publique invalide, sans citer la clé ni le contenu', async () => {
    const courte = base64(sodium.randombytes_buf(31))
    for (const cle of ['', 'pas du base64 !', courte]) {
      await assert.rejects(sealRequest(CHAMPS, cle), (error: unknown) => {
        assert.ok(error instanceof VaultKeyError)
        assert.ok(!error.message.includes(CHAMPS.nom))
        if (cle) assert.ok(!error.message.includes(cle))
        return true
      })
    }
  })

  it('ne cite jamais le contenu dans une erreur d’ouverture', async () => {
    const octets = await sealRequest(CHAMPS, clePublique)
    const autre = sodium.crypto_box_keypair()
    await assert.rejects(openSealed(octets, autre), (error: unknown) => {
      assert.ok(error instanceof VaultOpenError)
      assert.equal(error.cause, undefined)
      assert.ok(!error.message.includes(CHAMPS.nom))
      return true
    })
  })
})

describe('clé privée protégée par phrase de passe', () => {
  before(async () => {
    await sodium.ready
    if (!paquet) {
      const cree = await createKeyPacket(PHRASE)
      paquet = cree.packet
      clePublique = cree.publicKey
    }
  })

  it('utilise Argon2id avec des paramètres au moins « moderate »', () => {
    assert.equal(paquet.version, 1)
    assert.equal(paquet.kdf.algorithm, 'argon2id13')
    assert.ok(paquet.kdf.opslimit >= sodium.crypto_pwhash_OPSLIMIT_MODERATE)
    assert.ok(paquet.kdf.memlimit >= sodium.crypto_pwhash_MEMLIMIT_MODERATE)
    assert.equal(sodium.from_base64(paquet.kdf.salt, sodium.base64_variants.ORIGINAL).length, 16)
    assert.equal(sodium.from_base64(paquet.nonce, sodium.base64_variants.ORIGINAL).length, 24)
    // Clé privée de 32 octets + code d'authentification de 16 octets.
    assert.equal(sodium.from_base64(paquet.ciphertext, sodium.base64_variants.ORIGINAL).length, 48)
    assert.equal(paquet.publicKey, clePublique)
  })

  it('rouvre la clé privée avec la bonne phrase, depuis le JSON du paquet', async () => {
    const relu = JSON.parse(JSON.stringify(paquet)) as unknown
    const ouvertes = await unlockPrivateKey(relu, PHRASE)
    assert.equal(base64(ouvertes.publicKey), clePublique)
    assert.equal(ouvertes.privateKey.length, 32)
    const octets = await sealRequest(CHAMPS, clePublique)
    assert.deepEqual(await openSealed(octets, ouvertes), CHAMPS)
  })

  it('refuse une mauvaise phrase de passe', async () => {
    await assert.rejects(unlockPrivateKey(paquet, `${PHRASE}.`), VaultOpenError)
    await assert.rejects(unlockPrivateKey(paquet, ''), VaultOpenError)
  })

  it('accepte la même phrase saisie sous une autre forme Unicode (NFC ou NFD)', async () => {
    const accentuee = 'une phrase de passe très accentuée, éèêë'
    const { packet } = await createKeyPacket(accentuee.normalize('NFC'))
    await assert.doesNotReject(unlockPrivateKey(packet, accentuee.normalize('NFD')))
  })

  it('refuse un paquet affaibli, altéré ou mal formé', async () => {
    const affaibli = { ...paquet, kdf: { ...paquet.kdf, opslimit: 1, memlimit: 8 * 1024 * 1024 } }
    await assert.rejects(unlockPrivateKey(affaibli, PHRASE), VaultOpenError)
    const autreAlgorithme = { ...paquet, kdf: { ...paquet.kdf, algorithm: 'argon2i13' } }
    await assert.rejects(unlockPrivateKey(autreAlgorithme, PHRASE), VaultOpenError)

    const chiffre = sodium.from_base64(paquet.ciphertext, sodium.base64_variants.ORIGINAL)
    chiffre[0]! ^= 0x01
    await assert.rejects(
      unlockPrivateKey({ ...paquet, ciphertext: base64(chiffre) }, PHRASE),
      VaultOpenError,
    )

    const autreCle = base64(sodium.crypto_box_keypair().publicKey)
    await assert.rejects(
      unlockPrivateKey({ ...paquet, publicKey: autreCle }, PHRASE),
      VaultOpenError,
    )

    for (const mauvais of [null, 'texte', {}, { ...paquet, version: 2 }, { ...paquet, nonce: 1 }]) {
      await assert.rejects(unlockPrivateKey(mauvais, PHRASE), VaultOpenError)
    }
  })

  it('donne à chaque personne son paquet : même paire de clés, autre phrase', async () => {
    const autrePhrase = 'la phrase de la seconde personne, factice'
    const second = await addPassphrase(paquet, PHRASE, autrePhrase)
    assert.equal(second.publicKey, paquet.publicKey)
    assert.notEqual(second.kdf.salt, paquet.kdf.salt)
    assert.notEqual(second.ciphertext, paquet.ciphertext)
    const siennes = await unlockPrivateKey(second, autrePhrase)
    const premieres = await unlockPrivateKey(paquet, PHRASE)
    assert.deepEqual(siennes.privateKey, premieres.privateKey)
    await assert.rejects(unlockPrivateKey(second, PHRASE), VaultOpenError)
    // Une demande scellée pour la clé publique se rouvre avec l'un ou l'autre paquet.
    const octets = await sealRequest(CHAMPS, clePublique)
    assert.deepEqual(await openSealed(octets, siennes), CHAMPS)
  })

  it('refuse d’ajouter une phrase avec la mauvaise phrase actuelle, la même, ou trop courte', async () => {
    await assert.rejects(
      addPassphrase(paquet, 'pas la bonne phrase du tout', 'x'.repeat(20)),
      VaultOpenError,
    )
    await assert.rejects(addPassphrase(paquet, PHRASE, PHRASE), RangeError)
    await assert.rejects(addPassphrase(paquet, PHRASE, 'courte'), RangeError)
  })

  it('refuse une phrase de passe trop courte à la création', async () => {
    await assert.rejects(createKeyPacket('trop courte'), RangeError)
  })
})

describe('modules d’ouverture, prêts pour le navigateur', () => {
  // Le futur /coffre (partie C) déchiffre dans le navigateur : aucune API de Node.
  for (const fichier of ['open.ts', 'key-packet.ts', 'seal.ts', 'sodium.ts']) {
    it(`${fichier} n’importe que libsodium et des modules voisins`, () => {
      const source = readFileSync(
        new URL(`../../src/lib/vault/${fichier}`, import.meta.url),
        'utf8',
      )
      const imports = [...source.matchAll(/(?:from |import\()'([^']+)'/g)].map((match) => match[1])
      for (const specifier of imports) {
        assert.ok(
          specifier === 'libsodium-wrappers-sumo' || specifier?.startsWith('./'),
          `${fichier} importe ${specifier}`,
        )
      }
      assert.doesNotMatch(source, /\bBuffer\b|\bprocess\.|require\(/)
    })
  }
})
