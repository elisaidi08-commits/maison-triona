import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import sodium from 'libsodium-wrappers-sumo'

import pg from 'pg'
import type { PoolClient } from 'pg'

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
import type { StoreOptions } from '../../src/lib/vault/store.ts'
import { URGENCES } from '../../src/lib/demande/champs.ts'
import { PRIVACY_POLICY_VERSION } from '../../src/lib/privacy.ts'
import { applyRoles, resetDatabase, TEST_DATABASE_URL, testPool } from './helpers.ts'

// Enregistrement chiffré d'une demande (story 3.2, partie B) et de sa notification dans la boîte
// d'envoi, dans la même transaction (story 3.3) : une notification qui ne s'écrit pas n'empêche
// jamais la demande de s'enregistrer (point de sauvegarde). Fuite simulée : la base entière, boîte
// d'envoi comprise, relue en texte, ne contient aucun nom, aucune coordonnée ni aucun mot libre.
// Données factices.

const MIGRATIONS = fileURLToPath(new URL('../../db/migrations', import.meta.url))
const PHRASE = 'phrase de passe factice des tests d’intégration'
const pool = testPool()
// Connexion qui prend le rôle du site public dès l'ouverture, comme la Server Action.
const sitePublic = new pg.Pool({
  connectionString: TEST_DATABASE_URL,
  options: '-c role=site_public',
  max: 2,
})

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
  assert.ok(tables.some((table) => table.table_name === 'outbox'))
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

// Espion sur tous les clients PostgreSQL : texte SQL et paramètres de chaque `query`, octets en
// hexadécimal. Ce que la fonction envoie à la base, pas seulement ce que la base garde.
async function espionner(action: () => Promise<unknown>): Promise<string> {
  const prototype = pg.Client.prototype as unknown as { query: (...args: unknown[]) => unknown }
  const original = prototype.query
  const appels: string[] = []
  const enTexte = (valeur: unknown): string =>
    valeur instanceof Uint8Array
      ? Buffer.from(valeur).toString('hex')
      : valeur instanceof Date
        ? valeur.toISOString()
        : Array.isArray(valeur)
          ? valeur.map(enTexte).join(' | ')
          : typeof valeur === 'object' && valeur !== null
            ? JSON.stringify(valeur)
            : String(valeur)
  prototype.query = function (this: unknown, ...args: unknown[]) {
    appels.push(
      args
        .filter((arg) => typeof arg !== 'function')
        .map(enTexte)
        .join(' | '),
    )
    return original.apply(this, args)
  }
  try {
    await action()
  } finally {
    prototype.query = original
  }
  return appels.join('\n')
}

let clePublique: string
let cles: VaultKeys

function enregistrer(demande: Demande, options: Partial<StoreOptions> = {}, base = pool) {
  return storeRequest(base, demande, {
    publicKey: clePublique,
    privacyVersion: PRIVACY_POLICY_VERSION,
    now: new Date(),
    notify: true,
    ...options,
  })
}

// Insertion refusée par un déclencheur (code P0001), le temps d'un test.
async function refuserInsertions(table: 'outbox' | 'vault_requests'): Promise<void> {
  await pool.query(`
    CREATE FUNCTION refuser_insertion() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'insertion refusée par le test';
    END
    $$;
    CREATE TRIGGER refuser_insertion BEFORE INSERT ON ${table}
      FOR EACH ROW EXECUTE FUNCTION refuser_insertion();
  `)
}

async function accepterInsertions(table: 'outbox' | 'vault_requests'): Promise<void> {
  await pool.query(`DROP TRIGGER refuser_insertion ON ${table}; DROP FUNCTION refuser_insertion()`)
}

interface LigneEnvoi {
  id: string
  template: string
  request_id: string | null
  priority: boolean
  status: string
  created_at: Date
}

async function boiteEnvoi(): Promise<LigneEnvoi[]> {
  const { rows } = await pool.query<LigneEnvoi>(
    'SELECT id, template, request_id, priority, status, created_at FROM outbox ORDER BY created_at',
  )
  return rows
}

describe('enregistrement chiffré dans le coffre', () => {
  before(async () => {
    await resetDatabase(pool)
    await migrate(pool, MIGRATIONS)
    const cree = await createKeyPacket(PHRASE)
    clePublique = cree.publicKey
    cles = await unlockPrivateKey(cree.packet, PHRASE)
    await applyRoles(pool)
  })
  // `bookings` référence `vault_requests` depuis 0013 (rattachement d'un appel) : vidée avec elle.
  beforeEach(() =>
    pool.query(
      'TRUNCATE vault_requests, bookings, booking_tokens, vault_access_log, outbox RESTART IDENTITY',
    ),
  )
  after(async () => {
    await sitePublic.end()
    await pool.end()
  })

  it('fuite simulée : aucune donnée personnelle lisible dans toute la base', async () => {
    await enregistrer(DEMANDE)
    await enregistrer({ ...DEMANDE, locale: 'en', langue: 'en', urgence: 'urgent' })
    assert.equal((await boiteEnvoi()).length, 2)
    const texte = await toutLeTexte()
    assert.match(texte, /grand-age/)
    // La boîte d'envoi est bien relue : ses lignes figurent dans le texte contrôlé.
    assert.match(texte, /request_notification/)
    assert.deepEqual(fuites(texte), [])
  })

  it('fuite simulée : aucun texte en clair dans les paramètres envoyés à la base', async () => {
    const envoye = await espionner(() => enregistrer(DEMANDE))
    assert.match(envoye, /INSERT INTO vault_requests/)
    assert.match(envoye, /INSERT INTO outbox/)
    assert.match(envoye, /grand-age/)
    // Les octets scellés sont bien passés en paramètre (16 432 octets, en hexadécimal).
    assert.match(envoye, /[0-9a-f]{32864}/)
    assert.deepEqual(fuites(envoye), [])

    // Témoin : une insertion sans chiffrement est repérée par l'espion.
    const enClair = sodium.from_string(JSON.stringify(splitRequest(DEMANDE).sealed))
    const temoin = await espionner(() =>
      insertRequest(pool, {
        ...splitRequest(DEMANDE).clear,
        sealed: enClair,
        retentionUntil: new Date('2028-01-01T00:00:00Z'),
        privacyVersion: PRIVACY_POLICY_VERSION,
      }),
    )
    assert.ok(fuites(temoin).length >= 8)
  })

  it('témoin : le contrôle repère une demande écrite sans chiffrement', async () => {
    const enClair = sodium.from_string(JSON.stringify(splitRequest(DEMANDE).sealed))
    await insertRequest(pool, {
      ...splitRequest(DEMANDE).clear,
      sealed: enClair,
      retentionUntil: new Date('2028-01-01T00:00:00Z'),
      privacyVersion: PRIVACY_POLICY_VERSION,
    })
    assert.ok(fuites(await toutLeTexte()).length >= 8)
  })

  it('range les colonnes de tri en clair, avec l’échéance de conservation', async () => {
    const maintenant = new Date('2027-03-15T10:00:00Z')
    const { id } = await enregistrer(DEMANDE, { now: maintenant })
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
        privacyVersion: ligne.privacyVersion,
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
        privacyVersion: PRIVACY_POLICY_VERSION,
      },
    )
    assert.equal(
      ligne.retentionUntil.toISOString(),
      retentionDeadline(maintenant, 12).toISOString(),
    )
  })

  it('rouvre la demande avec la clé privée', async () => {
    const { id } = await enregistrer(DEMANDE)
    const octets = await readSealed(pool, id, 'compte-factice')
    assert.ok(octets)
    assert.deepEqual(await openSealed(octets, cles), splitRequest(DEMANDE).sealed)
  })

  it('n’écrit rien si la clé publique est invalide, sans citer la demande', async () => {
    await assert.rejects(enregistrer(DEMANDE, { publicKey: 'clé invalide' }), (error: unknown) => {
      assert.ok(error instanceof VaultKeyError)
      assert.ok(!error.message.includes('Hortense'))
      return true
    })
    assert.deepEqual(await listRequests(pool), [])
    assert.deepEqual(await boiteEnvoi(), [])
  })

  it('échec d’écriture (base injoignable) : une erreur réduite à son code', async () => {
    const adresse = new URL(TEST_DATABASE_URL)
    adresse.pathname = '/maison_triona_absente_test'
    const absente = new pg.Pool({ connectionString: adresse.toString(), max: 1 })
    try {
      await assert.rejects(enregistrer(DEMANDE, {}, absente), (error: unknown) => {
        assert.ok(error instanceof VaultError)
        assert.equal(error.message, 'Coffre : storeRequest a échoué (3D000)')
        assert.equal(error.cause, undefined)
        return true
      })
    } finally {
      await absente.end()
    }
    assert.deepEqual(await listRequests(pool), [])
  })

  it('écrit la notification dans la même transaction que la demande', async () => {
    const resultat = await enregistrer(DEMANDE)
    const [demande] = await listRequests(pool)
    const lignes = await boiteEnvoi()
    assert.ok(demande)
    assert.equal(lignes.length, 1)
    const [ligne] = lignes
    assert.ok(ligne)
    assert.deepEqual(resultat, { id: demande.id, outbox: [ligne.id], notifyFailed: false })
    assert.deepEqual(
      {
        template: ligne.template,
        request_id: ligne.request_id,
        priority: ligne.priority,
        status: ligne.status,
      },
      {
        template: 'request_notification',
        request_id: demande.id,
        priority: false,
        status: 'pending',
      },
    )
    // `now()` de PostgreSQL est l'heure de début de la transaction : même instant, à la
    // microseconde, pour les deux lignes.
    const { rows } = await pool.query<{ meme: boolean }>(
      `SELECT r.created_at = o.created_at AS meme
         FROM vault_requests r JOIN outbox o ON o.request_id = r.id`,
    )
    assert.deepEqual(rows, [{ meme: true }])
  })

  it('ne marque prioritaire que l’urgence « urgent »', async () => {
    for (const urgence of URGENCES) {
      const { id } = await enregistrer({ ...DEMANDE, urgence })
      const { rows } = await pool.query<{ priority: boolean }>(
        'SELECT priority FROM outbox WHERE request_id = $1',
        [id],
      )
      assert.deepEqual(rows, [{ priority: urgence === 'urgent' }], urgence)
    }
  })

  it('sans notification demandée, n’écrit rien dans la boîte d’envoi', async () => {
    const resultat = await enregistrer(DEMANDE, { notify: false })
    const [demande] = await listRequests(pool)
    assert.ok(demande)
    assert.deepEqual(resultat, { id: demande.id, outbox: [], notifyFailed: false })
    assert.deepEqual(await boiteEnvoi(), [])
  })

  it('si la notification ne s’écrit pas, la demande est gardée, sans notification', async () => {
    await refuserInsertions('outbox')
    let resultat
    try {
      resultat = await enregistrer(DEMANDE)
    } finally {
      await accepterInsertions('outbox')
    }
    const [demande] = await listRequests(pool)
    assert.ok(demande)
    assert.deepEqual(resultat, { id: demande.id, outbox: [], notifyFailed: true })
    assert.deepEqual(await boiteEnvoi(), [])
    // La demande gardée est complète : elle se rouvre avec la clé privée.
    const octets = await readSealed(pool, demande.id, 'compte-factice')
    assert.ok(octets)
    assert.deepEqual(await openSealed(octets, cles), splitRequest(DEMANDE).sealed)
  })

  it('retour au point de sauvegarde impossible : tout est annulé, erreur réduite', async () => {
    // Pool à part, dont le client refuse `ROLLBACK TO SAVEPOINT` : il n'est jamais rendu au pool
    // des autres tests, et il est fermé à la fin.
    const espion = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 1 })
    const instructions: string[] = []
    const connecter = espion.connect.bind(espion) as () => Promise<PoolClient>
    ;(espion as unknown as { connect: () => Promise<PoolClient> }).connect = async () => {
      const client = await connecter()
      const query = client.query.bind(client) as (...args: unknown[]) => Promise<unknown>
      ;(client as unknown as { query: (...args: unknown[]) => Promise<unknown> }).query = (
        ...args: unknown[]
      ) => {
        const texte = typeof args[0] === 'string' ? args[0] : ''
        instructions.push(texte.split('\n')[0] ?? '')
        if (texte.startsWith('ROLLBACK TO SAVEPOINT')) {
          return Promise.reject(
            Object.assign(new Error('retour refusé par le test : Hortense'), { code: '08006' }),
          )
        }
        return query(...args)
      }
      return client
    }
    await refuserInsertions('outbox')
    try {
      await assert.rejects(enregistrer(DEMANDE, {}, espion), (error: unknown) => {
        assert.ok(error instanceof VaultError)
        assert.equal(error.message, 'Coffre : storeRequest a échoué (08006)')
        assert.equal(error.cause, undefined)
        return true
      })
    } finally {
      await accepterInsertions('outbox')
      await espion.end()
    }
    // Le chemin attendu : point de sauvegarde, notification refusée, retour refusé, annulation.
    assert.deepEqual(
      instructions.filter((texte) => /^(BEGIN|SAVEPOINT|ROLLBACK|COMMIT)/.test(texte)),
      ['BEGIN', 'SAVEPOINT notification', 'ROLLBACK TO SAVEPOINT notification', 'ROLLBACK'],
    )
    assert.deepEqual(await listRequests(pool), [])
    assert.deepEqual(await boiteEnvoi(), [])
  })

  it('une demande qui ne s’écrit pas lève toujours, sans notification orpheline', async () => {
    await refuserInsertions('vault_requests')
    try {
      await assert.rejects(enregistrer(DEMANDE), (error: unknown) => {
        assert.ok(error instanceof VaultError)
        assert.equal(error.code, 'P0001')
        assert.ok(!error.message.includes('refusée par le test'))
        return true
      })
    } finally {
      await accepterInsertions('vault_requests')
    }
    assert.deepEqual(await listRequests(pool), [])
    assert.deepEqual(await boiteEnvoi(), [])
  })

  it('site_public sans droit sur la boîte d’envoi : la demande est gardée quand même', async () => {
    await pool.query('REVOKE INSERT ON outbox FROM site_public')
    let resultat
    try {
      resultat = await enregistrer(DEMANDE, {}, sitePublic)
    } finally {
      // Les droits d'origine, colonne pour colonne (db/roles/site_public.sql).
      await pool.query('GRANT INSERT (id, template, request_id, priority) ON outbox TO site_public')
    }
    const [demande] = await listRequests(pool)
    assert.ok(demande)
    assert.deepEqual(resultat, { id: demande.id, outbox: [], notifyFailed: true })
    assert.deepEqual(await boiteEnvoi(), [])
  })

  it('suffit au rôle site_public : demande et notification, sans relecture', async () => {
    const { rows } = await sitePublic.query<{ role: string }>('SELECT current_user AS role')
    assert.equal(rows[0]?.role, 'site_public')
    const { id, outbox, notifyFailed } = await enregistrer(
      { ...DEMANDE, urgence: 'urgent' },
      {},
      sitePublic,
    )
    assert.equal(notifyFailed, false)
    assert.deepEqual(
      (await listRequests(pool)).map((ligne) => ligne.id),
      [id],
    )
    assert.deepEqual(
      (await boiteEnvoi()).map((ligne) => [ligne.id, ligne.request_id, ligne.priority]),
      [[outbox[0], id, true]],
    )
  })
})
