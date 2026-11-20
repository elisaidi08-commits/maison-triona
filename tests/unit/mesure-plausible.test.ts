import assert from 'node:assert/strict'
import test from 'node:test'
import {
  envoiDuSite,
  ipVisiteur,
  lireConfigMesure,
  transmettre,
} from '../../src/lib/mesure/plausible.ts'

const EVENEMENT = {
  name: 'pageview',
  url: 'https://maisontriona.com/fr',
  domain: 'maisontriona.com',
}

test('la configuration : absente sans PLAUSIBLE_DOMAIN, refusée si invalide', () => {
  assert.equal(lireConfigMesure({ SITE_URL: 'https://maisontriona.com' }), null)
  assert.equal(lireConfigMesure({ PLAUSIBLE_DOMAIN: 'maisontriona.com' }), null)
  assert.deepEqual(
    lireConfigMesure({
      PLAUSIBLE_DOMAIN: 'maisontriona.com',
      SITE_URL: 'https://maisontriona.com',
    }),
    { domaine: 'maisontriona.com', siteUrl: 'https://maisontriona.com' },
  )
  assert.throws(
    () => lireConfigMesure({ PLAUSIBLE_DOMAIN: 'https://x', SITE_URL: 'https://maisontriona.com' }),
    /PLAUSIBLE_DOMAIN/,
  )
})

test('l’IP du visiteur : la première valide de X-Forwarded-For, sinon X-Real-IP', () => {
  assert.equal(
    ipVisiteur(new Headers({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })),
    '203.0.113.7',
  )
  assert.equal(ipVisiteur(new Headers({ 'x-real-ip': '2001:db8::1' })), '2001:db8::1')
  assert.equal(ipVisiteur(new Headers({ 'x-forwarded-for': 'pas une ip' })), null)
  assert.equal(ipVisiteur(new Headers()), null)
})

test('transmet à Plausible avec le navigateur et l’IP du visiteur, sans cookie', async () => {
  const appels: { url: string; init: RequestInit }[] = []
  const fetchSimule = (async (url: string, init: RequestInit) => {
    appels.push({ url, init })
    return new Response('{}', { status: 202 })
  }) as unknown as typeof fetch
  await transmettre({
    evenement: EVENEMENT,
    userAgent: 'Mozilla/5.0 (essai)',
    ip: '203.0.113.7',
    fetch: fetchSimule,
  })
  assert.equal(appels.length, 1)
  assert.equal(appels[0]!.url, 'https://plausible.io/api/event')
  const entetes = new Headers(appels[0]!.init.headers)
  assert.equal(entetes.get('User-Agent'), 'Mozilla/5.0 (essai)')
  assert.equal(entetes.get('X-Forwarded-For'), '203.0.113.7')
  assert.equal(entetes.get('Content-Type'), 'application/json')
  assert.equal(entetes.get('Cookie'), null)
  assert.deepEqual(JSON.parse(String(appels[0]!.init.body)), EVENEMENT)
})

test('sans navigateur ni IP : rien n’est envoyé (Plausible l’écarterait comme un robot)', async () => {
  let appels = 0
  const fetchSimule = (async () => {
    appels += 1
    return new Response('{}', { status: 202 })
  }) as unknown as typeof fetch
  await transmettre({
    evenement: EVENEMENT,
    userAgent: null,
    ip: '203.0.113.7',
    fetch: fetchSimule,
  })
  await transmettre({ evenement: EVENEMENT, userAgent: 'Mozilla', ip: null, fetch: fetchSimule })
  assert.equal(appels, 0)
})

test('une panne de Plausible ne lève jamais', async () => {
  const fetchEnPanne = (async () => {
    throw new Error('réseau')
  }) as unknown as typeof fetch
  await transmettre({
    evenement: EVENEMENT,
    userAgent: 'Mozilla',
    ip: '203.0.113.7',
    fetch: fetchEnPanne,
  })
})

test('coupée sur un aperçu Vercel, active en production', () => {
  const base = { PLAUSIBLE_DOMAIN: 'maisontriona.com', SITE_URL: 'https://maisontriona.com/' }
  assert.equal(lireConfigMesure({ ...base, VERCEL_ENV: 'preview' }), null)
  assert.deepEqual(lireConfigMesure({ ...base, VERCEL_ENV: 'production' }), {
    domaine: 'maisontriona.com',
    siteUrl: 'https://maisontriona.com',
  })
  assert.throws(
    () =>
      lireConfigMesure({ PLAUSIBLE_DOMAIN: 'maisontriona.com', SITE_URL: 'http://exemple.org' }),
    /SITE_URL/,
  )
})

test('seuls les envois de notre site sont acceptés', () => {
  const site = 'https://maisontriona.com'
  assert.equal(envoiDuSite(new Headers({ 'sec-fetch-site': 'same-origin' }), site), true)
  assert.equal(envoiDuSite(new Headers({ origin: 'https://maisontriona.com' }), site), true)
  assert.equal(
    envoiDuSite(
      new Headers({ 'sec-fetch-site': 'cross-site', origin: 'https://autre.example' }),
      site,
    ),
    false,
  )
  assert.equal(envoiDuSite(new Headers(), site), false)
})
