import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { describe, it } from 'node:test'

import { HORS_TACHES_PLANIFIEES, redirectionsVercelApp } from '../../src/lib/redirections.ts'

// Redirection de l'adresse vercel.app vers le domaine (308, à l'ouverture) : jamais sur les tâches
// planifiées, que Vercel Cron appelle sans suivre de redirection. La source est compilée par Next
// lui-même (`buildCustomRoute`, l'expression écrite dans routes-manifest.json), et la destination
// par `prepareDestination`, comme au moment de répondre.

const require = createRequire(import.meta.url)
const { buildCustomRoute } = require('next/dist/lib/build-custom-route.js') as {
  buildCustomRoute: (
    type: 'redirect',
    route: { source: string; destination: string; permanent: boolean },
    restricted: string[],
  ) => { regex: string; statusCode: number }
}
const { getPathMatch } = require('next/dist/shared/lib/router/utils/path-match.js') as {
  getPathMatch: (
    source: string,
    options: { removeUnnamedParams: boolean; strict: boolean },
  ) => (pathname: string) => Record<string, string> | false
}
const { prepareDestination } =
  require('next/dist/shared/lib/router/utils/prepare-destination.js') as {
    prepareDestination: (args: {
      appendParamsToQuery: boolean
      destination: string
      params: Record<string, string>
      query: Record<string, string>
    }) => { newUrl: string; parsedDestination: { hostname?: string; protocol?: string } }
  }

const DOMAINE = 'https://maisontriona.com'

function seule(): { source: string; destination: string; permanent: boolean } {
  const redirections = redirectionsVercelApp({ ouvert: true, siteUrl: `${DOMAINE}/` })
  assert.equal(redirections.length, 1)
  const [redirection] = redirections
  assert.ok(redirection)
  return redirection
}

describe('redirection de l’adresse vercel.app', () => {
  it('inactive avant l’ouverture, sans domaine, ou vers une adresse vercel.app', () => {
    assert.deepEqual(redirectionsVercelApp({ ouvert: false, siteUrl: DOMAINE }), [])
    assert.deepEqual(redirectionsVercelApp({ ouvert: true, siteUrl: undefined }), [])
    assert.deepEqual(redirectionsVercelApp({ ouvert: true, siteUrl: '  ' }), [])
    assert.deepEqual(
      redirectionsVercelApp({ ouvert: true, siteUrl: 'https://maison-triona.vercel.app' }),
      [],
    )
  })

  it('308 vers le domaine, seulement pour un hôte vercel.app', () => {
    const redirection = seule()
    assert.equal(redirection.source, HORS_TACHES_PLANIFIEES)
    assert.equal(redirection.permanent, true)
    assert.deepEqual(redirectionsVercelApp({ ouvert: true, siteUrl: DOMAINE })[0]?.has, [
      { type: 'host', value: '.*\\.vercel\\.app' },
    ])
    assert.equal(buildCustomRoute('redirect', redirection, ['/_next']).statusCode, 308)
  })

  it('jamais sur les tâches planifiées', () => {
    const regex = new RegExp(buildCustomRoute('redirect', seule(), ['/_next']).regex)
    for (const chemin of ['/api/cron/retention', '/api/cron/envoi']) {
      assert.equal(regex.test(chemin), false, chemin)
    }
    for (const chemin of [
      '/',
      '/fr',
      '/en/contact',
      '/fr/contact/merci',
      '/coffre',
      '/api/autre',
    ]) {
      assert.equal(regex.test(chemin), true, chemin)
    }
  })

  it('garde le chemin vers le domaine', () => {
    const redirection = seule()
    const correspondance = getPathMatch(redirection.source, {
      removeUnnamedParams: true,
      strict: true,
    })
    for (const chemin of ['/', '/fr/contact/merci']) {
      const params = correspondance(chemin)
      assert.ok(params, chemin)
      const { newUrl, parsedDestination } = prepareDestination({
        appendParamsToQuery: false,
        destination: redirection.destination,
        params,
        query: {},
      })
      assert.equal(newUrl, chemin)
      assert.equal(parsedDestination.hostname, 'maisontriona.com')
    }
  })
})
