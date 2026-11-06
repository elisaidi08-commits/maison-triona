import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, beforeEach, describe, it } from 'node:test'

import { migrate } from '../../src/lib/db/migrate.ts'
import { resetDatabase, testPool } from './helpers.ts'

const pool = testPool()

async function makeDir(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'mt-migrations-'))
  for (const [name, sql] of Object.entries(files)) {
    await writeFile(join(dir, name), sql)
  }
  return dir
}

const FILES = {
  '0001_a.sql': 'CREATE TABLE a (id int);',
  '0002_b.sql': 'CREATE TABLE b (id int);',
}

describe('migrate', () => {
  before(() => resetDatabase(pool))
  beforeEach(() => resetDatabase(pool))
  after(() => pool.end())

  it('applique les migrations sur une base vide puis n’applique rien au second appel', async () => {
    const dir = await makeDir(FILES)
    assert.deepEqual(await migrate(pool, dir), ['0001_a', '0002_b'])
    assert.deepEqual(await migrate(pool, dir), [])
    const { rows } = await pool.query('SELECT version FROM schema_migrations ORDER BY version')
    assert.deepEqual(
      rows.map((row) => row.version),
      ['0001_a', '0002_b'],
    )
  })

  it('refuse une migration modifiée après application', async () => {
    const dir = await makeDir(FILES)
    await migrate(pool, dir)
    await writeFile(join(dir, '0001_a.sql'), 'CREATE TABLE a (id int, extra int);')
    await assert.rejects(migrate(pool, dir), {
      message: 'Migration modifiée après application : 0001_a',
    })
  })

  it('applique chaque migration une seule fois en cas d’appels parallèles', async () => {
    const dir = await makeDir(FILES)
    const results = await Promise.all([migrate(pool, dir), migrate(pool, dir)])
    assert.equal(results.flat().length, 2)
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM schema_migrations')
    assert.equal(rows[0].n, 2)
  })

  it('n’enregistre pas une migration invalide et garde les précédentes', async () => {
    const dir = await makeDir({ ...FILES, '0003_c.sql': 'CREATE TABL oups;' })
    await assert.rejects(migrate(pool, dir))
    const { rows } = await pool.query('SELECT version FROM schema_migrations ORDER BY version')
    assert.deepEqual(
      rows.map((row) => row.version),
      ['0001_a', '0002_b'],
    )
  })
})
