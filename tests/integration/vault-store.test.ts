import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import sodium from 'libsodium-wrappers-sumo'

import pg from 'pg'

import { migrate } from '../../src/lib/db/migrate.ts'
import type { Demande } from '../../src/lib/validation/demande.ts'
import { createKeyPacket } from '../../src/lib/vault/key-packet.ts'
import { openSealed, unlockPrivateKey } from '../../src/lib/vault/open.ts'
import type { VaultKeys } from '../../src/lib/vault/open.ts'
import {
  insertRequest,
  listRequests,
  readSealed,
  VaultError,
} from '../../src/lib/vault/repository.ts'
import { retentionDeadline } from '../../src/lib/vault/retention.ts'
import { VaultKeyError } from '../../src/lib/vault/seal.ts'
import { splitRequest, storeRequest } from '../../src/lib/vault/store.ts'
import { resetDatabase, TEST_DATABASE_URL, testPool } from './helpers.ts'

// Enregistrement chiffré d'une demande (story 3.2, partie B) et fuite simulée : la base entière,
// relue en texte, ne contient aucun nom, aucune coordonnée ni aucun mot libre. Données factices.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const PHRASE = 'phrase de passe factice des tests d’intégration'
const pool = testPool()

const DEMANDE: Demande = {
  besoin: 'grand-age',
  pourQui: 'proche',
  pays: 'BE',
  urgence: 'semaines',
  nom: 'Hortense Fuite-Simulée',
  email: 'hortense.fuite@example.test',
  telephone: '+32 470 98 76 54',
  creneau: 'apres-midi',
  langue: 'fr',
  message: 'Mot libre de la fuite simulée : ma tante Ysolde, à Spa.\nDeuxième ligne.',
  origine: 'salon',
  consentement: 'oui',
  locale: 'fr',
}

// Tout ce qui ne doit jamais apparaître en clair, sous plusieurs formes.
const INTERDITS = [
  'Hortense',
  'Fuite-Simulée',
  'hortense.fuite@example.test',
  'hortense.fuite',
  '+32 470 98 76 54',
  '470 98 76 54',
  '470987654',
  'Mot libre de la fuite simulée',
  'Ysolde',
  'Deuxième ligne',
  'apres-midi',
  'proche',
]

const hex = (texte: string) => Buffer.from(texte, 'utf8').toString('hex')

// Toutes les colonnes de toutes les tables, en texte : la ligne entière (`t::text`, octets en
// hexadécimal) et chaque colonne d'octets en échappement (ASCII lisible tel quel).
async function toutLeTexte(): Promise<string> {
  const { rows: tables } = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  )
  assert.ok(tables.some((table) => table.table_name === 'vault_requests'))
  const morceaux: string[] = []
  for (const { table_name } of tables) {
    const nom = `"${table_name.replaceAll('"', '""')}"`
    const { rows } = await pool.query<{ ligne: string }>(`SELECT t::text AS ligne FROM ${nom} t`)
    morceaux.push(...rows.map((row) => row.ligne))
    const { rows: colonnes } = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND data_type = 'bytea'`,
      [table_name],
    )
    for (const { column_name } of colonnes) {
      const colonne = `"${column_name.replaceAll('"', '""')}"`
      const { rows: octets } = await pool.query<{ texte: string }>(
        `SELECT encode(${colonne}, 'escape') AS texte FROM ${nom}`,
      )
      morceaux.push(...octets.map((row) => row.texte))
    }
  }
  return morceaux.join('\n')
}

function fuites(texte: string): string[] {
  const minuscules = texte.toLowerCase()
  return INTERDITS.filter(
    (interdit) => minuscules.includes(interdit.toLowerCase()) || minuscules.includes(hex(interdit)),
  )
}

let clePublique: string
let cles: VaultKeys

describe('enregistrement chiffré dans le coffre', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
    const cree = await createKeyPacket(PHRASE)
    clePublique = cree.publicKey
    cles = await unlockPrivateKey(cree.packet, PHRASE)
  })
  beforeEach(() => pool.query('TRUNCATE vault_requests, vault_access_log RESTART IDENTITY'))
  after(() => pool.end())

  it('fuite simulée : aucune donnée personnelle lisible dans toute la base', async () => {
    await storeRequest(pool, DEMANDE, clePublique, new Date())
    await storeRequest(pool, { ...DEMANDE, locale: 'en', langue: 'en' }, clePublique, new Date())
    const texte = await toutLeTexte()
    assert.match(texte, /grand-age/)
    assert.deepEqual(fuites(texte), [])
  })

  it('témoin : le contrôle repère une demande écrite sans chiffrement', async () => {
    const enClair = sodium.from_string(JSON.stringify(splitRequest(DEMANDE).sealed))
    await insertRequest(pool, {
      ...splitRequest(DEMANDE).clear,
      sealed: enClair,
      retentionUntil: new Date('2028-01-01T00:00:00Z'),
    })
    assert.ok(fuites(await toutLeTexte()).length >= 8)
  })

  it('range les colonnes de tri en clair, avec l’échéance de conservation', async () => {
    const maintenant = new Date('2027-03-15T10:00:00Z')
    const id = await storeRequest(pool, DEMANDE, clePublique, maintenant)
    const [ligne] = await listRequests(pool)
    assert.ok(ligne)
    assert.equal(ligne.id, id)
    assert.deepEqual(
      {
        kind: ligne.kind,
        service: ligne.service,
        country: ligne.country,
        locale: ligne.locale,
        urgency: ligne.urgency,
        source: ligne.source,
        status: ligne.status,
        frozen: ligne.frozen,
      },
      {
        kind: 'request',
        service: 'grand-age',
        country: 'BE',
        locale: 'fr',
        urgency: 'semaines',
        source: 'salon',
        status: 'new',
        frozen: false,
      },
    )
    assert.equal(
      ligne.retentionUntil.toISOString(),
      retentionDeadline(maintenant, 12).toISOString(),
    )
  })

  it('rouvre la demande avec la clé privée', async () => {
    const id = await storeRequest(pool, DEMANDE, clePublique, new Date())
    const octets = await readSealed(pool, id, 'compte-factice')
    assert.ok(octets)
    assert.deepEqual(await openSealed(octets, cles), splitRequest(DEMANDE).sealed)
  })

  it('n’écrit rien si la clé publique est invalide, sans citer la demande', async () => {
    await assert.rejects(
      storeRequest(pool, DEMANDE, 'clé invalide', new Date()),
      (error: unknown) => {
        assert.ok(error instanceof VaultKeyError)
        assert.ok(!error.message.includes('Hortense'))
        return true
      },
    )
    assert.deepEqual(await listRequests(pool), [])
  })

  it('échec d’écriture (base injoignable) : une erreur réduite à son code', async () => {
    const adresse = new URL(TEST_DATABASE_URL)
    adresse.pathname = '/maison_triona_absente_test'
    const absente = new pg.Pool({ connectionString: adresse.toString(), max: 1 })
    try {
      await assert.rejects(
        storeRequest(absente, DEMANDE, clePublique, new Date()),
        (error: unknown) => {
          assert.ok(error instanceof VaultError)
          assert.equal(error.message, 'Coffre : storeRequest a échoué (3D000)')
          assert.equal(error.cause, undefined)
          return true
        },
      )
    } finally {
      await absente.end()
    }
    assert.deepEqual(await listRequests(pool), [])
  })
})
