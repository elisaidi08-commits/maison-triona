import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { limiterDebit, usageUnique } from '../../src/lib/rate-limit.ts'
import { empreinte, reseauIp, selDuJour } from '../../src/lib/security/empreinte.ts'
import {
  DELAI_MINIMUM_MS,
  DUREE_MAXIMUM_MS,
  signerHorodatage,
  verifierHorodatage,
} from '../../src/lib/security/horodatage.ts'
import { secretFormulaire } from '../../src/lib/security/secret.ts'

// Anti-abus du formulaire (story 3.5, docs/architecture.md §6.7) : horodatage signé, empreintes,
// secret, adaptateur Upstash (limitation de débit, usage unique).

const SECRET = 'secret-de-test-de-trente-deux-caracteres'
const NOW = Date.UTC(2026, 10, 18, 10, 0, 0)

describe('horodatage signé', () => {
  test('un jeton signé est reconnu, avec son âge et son identifiant', () => {
    const jeton = signerHorodatage(NOW, SECRET)
    const [, signature] = jeton.split('.')
    assert.deepEqual(verifierHorodatage(jeton, SECRET, NOW + 4000), {
      statut: 'valide',
      ageMs: 4000,
      identifiant: signature,
    })
  })

  test('moins de 3 secondes : âge sous le seuil', () => {
    const resultat = verifierHorodatage(signerHorodatage(NOW, SECRET), SECRET, NOW + 1200)
    assert.equal(resultat.statut, 'valide')
    if (resultat.statut === 'valide') assert.ok(resultat.ageMs < DELAI_MINIMUM_MS)
  })

  test('plus de 2 heures : périmé', () => {
    const jeton = signerHorodatage(NOW, SECRET)
    assert.equal(verifierHorodatage(jeton, SECRET, NOW + DUREE_MAXIMUM_MS).statut, 'valide')
    assert.equal(verifierHorodatage(jeton, SECRET, NOW + DUREE_MAXIMUM_MS + 1).statut, 'expire')
  })

  test('instant modifié, autre secret, forme inattendue : invalide', () => {
    const jeton = signerHorodatage(NOW, SECRET)
    const [, signature] = jeton.split('.')
    assert.equal(verifierHorodatage(`${NOW - 60_000}.${signature}`, SECRET, NOW).statut, 'invalide')
    assert.equal(verifierHorodatage(jeton, `${SECRET}-autre`, NOW).statut, 'invalide')
    for (const forme of ['abc', `${NOW}`, `${NOW}.`, `${NOW}.a.b`, `12.${signature}`]) {
      assert.equal(verifierHorodatage(forme, SECRET, NOW).statut, 'invalide', forme)
    }
  })

  test('instant venu du futur : invalide', () => {
    const jeton = signerHorodatage(NOW + 60_000, SECRET)
    assert.equal(verifierHorodatage(jeton, SECRET, NOW).statut, 'invalide')
  })

  test('jeton absent (envoi sans JavaScript)', () => {
    assert.equal(verifierHorodatage('', SECRET, NOW).statut, 'absent')
    assert.equal(verifierHorodatage(null, SECRET, NOW).statut, 'absent')
  })
})

describe('empreintes', () => {
  const ip = '203.0.113.7'
  const jour = new Date(NOW)
  const lendemain = new Date(NOW + 24 * 60 * 60 * 1000)

  test('stable dans la journée, sans l’adresse en clair', () => {
    const valeur = empreinte(ip, SECRET, jour)
    assert.equal(valeur, empreinte(ip, SECRET, new Date(NOW + 60_000)))
    assert.ok(!valeur.includes(ip))
    assert.match(valeur, /^[A-Za-z0-9_-]{43}$/)
  })

  test('le sel change chaque jour : aucune empreinte commune d’un jour à l’autre', () => {
    assert.notEqual(selDuJour(SECRET, jour), selDuJour(SECRET, lendemain))
    assert.notEqual(empreinte(ip, SECRET, jour), empreinte(ip, SECRET, lendemain))
  })

  test('une adresse e-mail est normalisée avant l’empreinte', () => {
    assert.equal(
      empreinte(' Camille@Example.com ', SECRET, jour),
      empreinte('camille@example.com', SECRET, jour),
    )
  })
})

describe('réseau d’une adresse IP', () => {
  test('IPv4 telle quelle, IPv4 encapsulée ramenée à l’IPv4', () => {
    assert.equal(reseauIp(' 203.0.113.7 '), '203.0.113.7')
    assert.equal(reseauIp('::ffff:203.0.113.7'), '203.0.113.7')
  })

  test('IPv6 : préfixe /64, quelle que soit l’écriture', () => {
    const attendu = '2001:db8:85a3:12::/64'
    for (const adresse of [
      '2001:db8:85a3:12:1:2:3:4',
      '2001:0DB8:85A3:0012:ffff:ffff:ffff:ffff',
      '2001:db8:85a3:12::1',
      '[2001:db8:85a3:12::abcd]',
      '2001:db8:85a3:12::1%eth0',
    ]) {
      assert.equal(reseauIp(adresse), attendu, adresse)
    }
    assert.equal(reseauIp('2001:db8::1'), '2001:db8:0:0::/64')
    assert.equal(reseauIp('::1'), '0:0:0:0::/64')
    assert.notEqual(reseauIp('2001:db8:85a3:13::1'), attendu)
  })

  test('forme illisible : rendue telle quelle', () => {
    assert.equal(reseauIp('inconnue'), 'inconnue')
    assert.equal(reseauIp('1::2::3'), '1::2::3')
  })
})

describe('secret du formulaire', () => {
  test('déploiement Vercel sans secret, ou secret trop court : aucun repli', () => {
    for (const VERCEL_ENV of ['production', 'preview', 'development']) {
      assert.equal(secretFormulaire({ VERCEL_ENV }), null, VERCEL_ENV)
      assert.equal(secretFormulaire({ VERCEL_ENV, FORM_SIGNING_SECRET: 'court' }), null)
    }
  })

  test('déploiement Vercel avec secret : le secret', () => {
    assert.equal(secretFormulaire({ VERCEL_ENV: 'preview', FORM_SIGNING_SECRET: SECRET }), SECRET)
  })

  test('hors Vercel (poste, CI) : repli de développement', () => {
    const repli = secretFormulaire({})
    assert.ok(repli && repli.length >= 32)
    assert.equal(secretFormulaire({ FORM_SIGNING_SECRET: SECRET }), SECRET)
  })
})

describe('adaptateur Upstash', () => {
  const limites = [
    { cle: 'ip:abc', maximum: 3, fenetreSecondes: 600 },
    { cle: 'jour:2026-11-18', maximum: 100, fenetreSecondes: 86_400, alerte: true },
  ]
  const env = { UPSTASH_REDIS_REST_URL: 'https://ue.upstash.test/', UPSTASH_REDIS_REST_TOKEN: 't' }
  type Appel = { url: string; init: RequestInit }

  function faux(corps: unknown, appels: Appel[] = [], status = 200) {
    return (async (url: string, init: RequestInit) => {
      appels.push({ url, init })
      return new Response(JSON.stringify(corps), { status })
    }) as unknown as typeof fetch
  }

  test('sans configuration : inactif, aucun appel ; absence signalée sur Vercel seulement', async () => {
    let appele = false
    const requete = (async () => {
      appele = true
      return new Response('[]')
    }) as unknown as typeof fetch
    assert.deepEqual(await limiterDebit(limites, { env: {}, fetch: requete }), {
      statut: 'inactif',
      configManquante: false,
    })
    assert.deepEqual(await usageUnique('jeton:x', 60, { env: { VERCEL_ENV: 'preview' } }), {
      statut: 'inactif',
      configManquante: true,
    })
    assert.equal(appele, false)
  })

  test('sous les seuils : autorisé ; une transaction SET NX EX puis INCR par clé', async () => {
    const appels: Appel[] = []
    const reponse = [{ result: 'OK' }, { result: 1 }, { result: null }, { result: 42 }]
    const resultat = await limiterDebit(limites, { env, fetch: faux(reponse, appels) })
    assert.deepEqual(resultat, { statut: 'autorise', alertes: [] })
    assert.equal(appels[0]?.url, 'https://ue.upstash.test/multi-exec')
    assert.deepEqual(JSON.parse(String(appels[0]?.init.body)), [
      ['SET', 'mt:debit:ip:abc', '0', 'EX', '600', 'NX'],
      ['INCR', 'mt:debit:ip:abc'],
      ['SET', 'mt:debit:jour:2026-11-18', '0', 'EX', '86400', 'NX'],
      ['INCR', 'mt:debit:jour:2026-11-18'],
    ])
  })

  test('limite bloquante dépassée : refusé', async () => {
    const reponse = [{ result: null }, { result: 4 }, { result: null }, { result: 10 }]
    assert.deepEqual(await limiterDebit(limites, { env, fetch: faux(reponse) }), {
      statut: 'refuse',
    })
  })

  test('plafond global du jour dépassé : alerte, sans bloquer', async () => {
    const reponse = [{ result: null }, { result: 1 }, { result: null }, { result: 101 }]
    assert.deepEqual(await limiterDebit(limites, { env, fetch: faux(reponse) }), {
      statut: 'autorise',
      alertes: ['jour:2026-11-18'],
    })
  })

  test('panne réseau : « reseau » (on laisse passer)', async () => {
    const panne = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    assert.deepEqual(await limiterDebit(limites, { env, fetch: panne }), { statut: 'reseau' })
    assert.deepEqual(await usageUnique('jeton:x', 60, { env, fetch: panne }), {
      statut: 'reseau',
    })
  })

  test('401 ou 403 : « config » (on laisse passer en le journalisant)', async () => {
    for (const status of [401, 403]) {
      assert.deepEqual(
        await limiterDebit(limites, { env, fetch: faux({ error: 'Unauthorized' }, [], status) }),
        { statut: 'config' },
      )
    }
  })

  test('erreur 5xx du service : traitée comme une panne (« reseau », on laisse passer)', async () => {
    for (const status of [500, 502, 503]) {
      assert.deepEqual(
        await limiterDebit(limites, { env, fetch: faux({ error: 'ERR' }, [], status) }),
        { statut: 'reseau' },
      )
    }
  })

  test('toute autre réponse inattendue : « reponse » (on refuse)', async () => {
    for (const [corps, status] of [
      [{ error: 'ERR' }, 400],
      [{ error: 'ERR' }, 200],
      [[{ result: 'OK' }], 200],
      [[{ result: 'OK' }, { error: 'ERR' }, { result: null }, { result: 1 }], 200],
    ] as const) {
      assert.deepEqual(await limiterDebit(limites, { env, fetch: faux(corps, [], status) }), {
        statut: 'reponse',
      })
    }
  })

  test('usage unique : nouveau, puis déjà vu', async () => {
    const appels: Appel[] = []
    assert.deepEqual(
      await usageUnique('jeton:abc', 7200, { env, fetch: faux([{ result: 'OK' }], appels) }),
      { statut: 'nouveau' },
    )
    assert.deepEqual(JSON.parse(String(appels[0]?.init.body)), [
      ['SET', 'mt:unique:jeton:abc', '1', 'EX', '7200', 'NX'],
    ])
    assert.deepEqual(
      await usageUnique('jeton:abc', 7200, { env, fetch: faux([{ result: null }]) }),
      {
        statut: 'deja-vu',
      },
    )
  })
})
