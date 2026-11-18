import assert from 'node:assert/strict'
import { after, describe, it } from 'node:test'

import type { EmailConfig } from '../../src/lib/email/config.ts'
import { createOutboxDeps } from '../../src/lib/outbox/deps.ts'

// Dépendances de la boîte d'envoi en production (story 3.3) : pool du rôle `envoi`, transport TEM
// tiré de la configuration, horloge, identifiants et journal réduit à un statut. Aucune connexion
// ouverte, aucun appel réseau : `fetch` est remplacé. Données factices.

const CONFIG: EmailConfig = {
  temSecretKey: 'cle-secrete-factice',
  temProjectId: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  from: { email: 'no-reply@example.test', name: 'Maison Triona' },
  notifyTo: 'cat@example.test',
  alertTo: 'sady@example.test',
  siteUrl: 'https://maisontriona.example',
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

const fetchOriginal = globalThis.fetch
const urlOriginale = process.env.ENVOI_DATABASE_URL

describe('createOutboxDeps', () => {
  after(async () => {
    globalThis.fetch = fetchOriginal
    if (urlOriginale === undefined) delete process.env.ENVOI_DATABASE_URL
    else process.env.ENVOI_DATABASE_URL = urlOriginale
  })

  // En premier : le pool est gardé pour le processus dès qu'il a été créé une fois.
  it('lève sans ENVOI_DATABASE_URL, sans rien citer de la configuration', () => {
    delete process.env.ENVOI_DATABASE_URL
    assert.throws(
      () => createOutboxDeps(CONFIG),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.equal(error.message, 'ENVOI_DATABASE_URL manquante')
        return true
      },
    )
  })

  it('branche le pool du rôle envoi, la configuration, l’horloge et les identifiants', async () => {
    process.env.ENVOI_DATABASE_URL = 'postgres://envoi:factice@localhost:5432/base_factice'
    const deps = createOutboxDeps(CONFIG)
    try {
      assert.equal(deps.config, CONFIG)
      assert.equal(
        (deps.pool as unknown as { options: { application_name?: string } }).options
          .application_name,
        'maison-triona-envoi',
      )
      // Un seul pool par processus : le premier essai et la tâche planifiée le partagent.
      assert.equal(createOutboxDeps(CONFIG).pool, deps.pool)
      const avant = Date.now()
      const maintenant = deps.now()
      assert.ok(maintenant instanceof Date)
      assert.ok(Math.abs(maintenant.getTime() - avant) < 1000)
      const [a, b] = [deps.newId(), deps.newId()]
      assert.match(a, UUID)
      assert.match(b, UUID)
      assert.notEqual(a, b)
    } finally {
      await deps.pool.end()
    }
  })

  it('crée le transport TEM avec la clé et le projet de la configuration', async () => {
    const appels: { headers: Record<string, string>; body: { project_id?: string } }[] = []
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      appels.push({
        headers: init?.headers as Record<string, string>,
        body: JSON.parse(init?.body as string) as { project_id?: string },
      })
      return new Response(JSON.stringify({ emails: [{ id: 'tem-factice-1' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }) as typeof globalThis.fetch
    const deps = createOutboxDeps(CONFIG)
    const resultat = await deps.transport.send({
      from: CONFIG.from,
      to: CONFIG.notifyTo,
      subject: 'Sujet factice',
      text: 'Corps factice',
    })
    assert.deepEqual(resultat, { ok: true, providerId: 'tem-factice-1' })
    assert.equal(appels.length, 1)
    assert.equal(appels[0]?.headers['X-Auth-Token'], CONFIG.temSecretKey)
    assert.equal(appels[0]?.body.project_id, CONFIG.temProjectId)
  })

  it('journalise « [envoi] <statut> <identifiant> », et rien d’autre', () => {
    const lignes: unknown[][] = []
    const infoOriginale = console.info
    console.info = (...args: unknown[]) => {
      lignes.push(args)
    }
    try {
      createOutboxDeps(CONFIG).log('sent', '0b0c6a8e-1d2f-4a3b-8c4d-5e6f7a8b9c0d')
    } finally {
      console.info = infoOriginale
    }
    assert.deepEqual(lignes, [['[envoi] sent 0b0c6a8e-1d2f-4a3b-8c4d-5e6f7a8b9c0d']])
  })
})
