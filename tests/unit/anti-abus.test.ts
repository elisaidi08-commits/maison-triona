import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { limiterDebit } from '../../src/lib/rate-limit.ts'
import { empreinte, selDuJour } from '../../src/lib/security/empreinte.ts'
import {
  DELAI_MINIMUM_MS,
  signerHorodatage,
  verifierHorodatage,
} from '../../src/lib/security/horodatage.ts'
import { secretFormulaire } from '../../src/lib/security/secret.ts'

// Anti-abus du formulaire (story 3.5, docs/architecture.md §6.7) : horodatage signé, empreintes,
// secret, adaptateur de limitation de débit.

const SECRET = 'secret-de-test-de-trente-deux-caracteres'
const NOW = Date.UTC(2026, 10, 18, 10, 0, 0)

describe('horodatage signé', () => {
  test('un jeton signé est reconnu, avec son âge', () => {
    const jeton = signerHorodatage(NOW, SECRET)
    assert.deepEqual(verifierHorodatage(jeton, SECRET, NOW + 4000), {
      statut: 'valide',
      ageMs: 4000,
    })
  })

  test('moins de 3 secondes : âge sous le seuil', () => {
    const resultat = verifierHorodatage(signerHorodatage(NOW, SECRET), SECRET, NOW + 1200)
    assert.equal(resultat.statut, 'valide')
    if (resultat.statut === 'valide') assert.ok(resultat.ageMs < DELAI_MINIMUM_MS)
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

describe('secret du formulaire', () => {
  test('production sans secret : erreur', () => {
    assert.throws(() => secretFormulaire({ VERCEL_ENV: 'production' }), /FORM_SIGNING_SECRET/)
    assert.throws(
      () => secretFormulaire({ VERCEL_ENV: 'production', FORM_SIGNING_SECRET: 'court' }),
      /FORM_SIGNING_SECRET/,
    )
  })

  test('production avec secret : le secret', () => {
    assert.equal(
      secretFormulaire({ VERCEL_ENV: 'production', FORM_SIGNING_SECRET: SECRET }),
      SECRET,
    )
  })

  test('hors production : repli de développement', () => {
    assert.ok(secretFormulaire({}).length >= 32)
    assert.ok(secretFormulaire({ VERCEL_ENV: 'preview' }).length >= 32)
  })
})

describe('limitation de débit', () => {
  const limites = [
    { cle: 'ip:abc', maximum: 3, fenetreSecondes: 600 },
    { cle: 'jour:2026-11-18', maximum: 100, fenetreSecondes: 86_400 },
  ]
  const env = { UPSTASH_REDIS_REST_URL: 'https://ue.upstash.test/', UPSTASH_REDIS_REST_TOKEN: 't' }

  function faux(reponse: unknown, appels: { url: string; init: RequestInit }[] = []) {
    return (async (url: string, init: RequestInit) => {
      appels.push({ url, init })
      return new Response(JSON.stringify(reponse), { status: 200 })
    }) as unknown as typeof fetch
  }

  test('sans configuration : inactive, tout passe, aucun appel réseau', async () => {
    let appele = false
    const requete = (async () => {
      appele = true
      return new Response('[]')
    }) as unknown as typeof fetch
    assert.deepEqual(await limiterDebit(limites, { env: {}, fetch: requete }), {
      autorise: true,
      actif: false,
    })
    assert.equal(appele, false)
  })

  test('sous les seuils : autorisé ; une transaction SET NX EX puis INCR par clé', async () => {
    const appels: { url: string; init: RequestInit }[] = []
    const reponse = [{ result: 'OK' }, { result: 1 }, { result: null }, { result: 42 }]
    const resultat = await limiterDebit(limites, { env, fetch: faux(reponse, appels) })
    assert.deepEqual(resultat, { autorise: true, actif: true })
    assert.equal(appels[0]?.url, 'https://ue.upstash.test/multi-exec')
    assert.deepEqual(JSON.parse(String(appels[0]?.init.body)), [
      ['SET', 'mt:debit:ip:abc', '0', 'EX', '600', 'NX'],
      ['INCR', 'mt:debit:ip:abc'],
      ['SET', 'mt:debit:jour:2026-11-18', '0', 'EX', '86400', 'NX'],
      ['INCR', 'mt:debit:jour:2026-11-18'],
    ])
  })

  test('un seuil dépassé : refusé', async () => {
    const reponse = [{ result: null }, { result: 4 }, { result: null }, { result: 10 }]
    assert.deepEqual(await limiterDebit(limites, { env, fetch: faux(reponse) }), {
      autorise: false,
      actif: true,
    })
  })

  test('Upstash injoignable ou réponse inattendue : on laisse passer, en le signalant', async () => {
    const panne = (async () => {
      throw new Error('réseau')
    }) as unknown as typeof fetch
    assert.deepEqual(await limiterDebit(limites, { env, fetch: panne }), {
      autorise: true,
      actif: true,
      indisponible: true,
    })
    assert.deepEqual(await limiterDebit(limites, { env, fetch: faux({ error: 'ERR' }) }), {
      autorise: true,
      actif: true,
      indisponible: true,
    })
  })
})
