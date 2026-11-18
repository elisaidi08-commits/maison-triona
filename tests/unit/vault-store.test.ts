import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { Demande } from '../../src/lib/validation/demande.ts'
import { vaultPublicKeyFromEnv } from '../../src/lib/vault/config.ts'
import { splitRequest } from '../../src/lib/vault/store.ts'

// Répartition d'une demande entre colonnes en clair et sealed box (docs/architecture.md §6.5), et
// configuration du coffre. Données factices uniquement.

const DEMANDE: Demande = {
  besoin: 'grand-age',
  pourQui: 'proche',
  pays: 'LU',
  urgence: 'semaines',
  nom: 'Hortense Factice',
  email: 'hortense.factice@example.test',
  telephone: '+352 621 000 000',
  creneau: 'soir',
  langue: 'en',
  message: 'Un mot libre factice.',
  origine: 'recommandation',
  consentement: 'oui',
  locale: 'fr',
}

describe('splitRequest', () => {
  it('ne garde en clair que les colonnes de tri', () => {
    const { clear } = splitRequest(DEMANDE)
    assert.deepEqual(clear, {
      kind: 'request',
      service: 'grand-age',
      country: 'LU',
      // Langue de réponse choisie, pas celle de l'interface.
      locale: 'en',
      urgency: 'semaines',
      source: 'recommandation',
    })
    const texte = JSON.stringify(clear)
    for (const valeur of ['Hortense', 'example.test', '621', 'mot libre', 'proche', 'soir']) {
      assert.ok(!texte.includes(valeur), valeur)
    }
  })

  it('scelle le nom, le contact, « pour qui », le créneau et le mot libre', () => {
    assert.deepEqual(splitRequest(DEMANDE).sealed, {
      nom: 'Hortense Factice',
      email: 'hortense.factice@example.test',
      telephone: '+352 621 000 000',
      pourQui: 'proche',
      creneau: 'soir',
      message: 'Un mot libre factice.',
    })
  })

  it('remplace un champ facultatif absent par null', () => {
    const minimale: Demande = {
      besoin: 'indecis',
      pays: 'non-dit',
      urgence: 'aucune',
      nom: 'Al',
      telephone: '+33 6 00 00 00 00',
      langue: 'fr',
      consentement: 'oui',
      locale: 'fr',
    }
    assert.deepEqual(splitRequest(minimale), {
      clear: {
        kind: 'request',
        service: 'indecis',
        country: 'non-dit',
        locale: 'fr',
        urgency: 'aucune',
        source: null,
      },
      sealed: {
        nom: 'Al',
        email: null,
        telephone: '+33 6 00 00 00 00',
        pourQui: null,
        creneau: null,
        message: null,
      },
    })
  })
})

describe('vaultPublicKeyFromEnv', () => {
  const URL = 'postgres://localhost:5432/maison_triona_dev'
  const CLE = 'Y2xlLXB1YmxpcXVlLWZhY3RpY2UtZGUtMzItb2N0ZXQ='

  it('reste fermé tant que la base ou la clé publique manque', () => {
    assert.equal(vaultPublicKeyFromEnv({}), null)
    assert.equal(vaultPublicKeyFromEnv({ DATABASE_URL: URL }), null)
    assert.equal(vaultPublicKeyFromEnv({ VAULT_PUBLIC_KEY: CLE }), null)
    assert.equal(vaultPublicKeyFromEnv({ DATABASE_URL: ' ', VAULT_PUBLIC_KEY: CLE }), null)
    assert.equal(vaultPublicKeyFromEnv({ DATABASE_URL: URL, VAULT_PUBLIC_KEY: '  ' }), null)
  })

  it('renvoie la clé publique quand les deux sont posées', () => {
    assert.equal(vaultPublicKeyFromEnv({ DATABASE_URL: URL, VAULT_PUBLIC_KEY: ` ${CLE}\n` }), CLE)
  })
})
