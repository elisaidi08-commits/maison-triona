import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  cheminDemandeMalForme,
  creerNonce,
  cspCoffre,
  estCheminCoffre,
  PAGE_INTROUVABLE,
} from '../../src/lib/coffre/securite.ts'

// CSP et chemins du coffre (story 3.2, partie C ; docs/architecture.md §9.1).

describe('chemins du coffre', () => {
  it('reconnaît /coffre et ce qui est dessous, rien d’autre', () => {
    for (const chemin of [
      '/coffre',
      '/coffre/',
      '/coffre/connexion',
      '/coffre/api/auth/sign-out',
    ]) {
      assert.equal(estCheminCoffre(chemin), true, chemin)
    }
    for (const chemin of ['/', '/fr', '/coffres', '/coffre-fort', '/fr/coffre', '/en/coffre']) {
      assert.equal(estCheminCoffre(chemin), false, chemin)
    }
  })
})

describe('CSP du coffre', () => {
  it('tire un nonce de 128 bits, neuf à chaque appel', () => {
    const nonces = new Set(Array.from({ length: 50 }, creerNonce))
    assert.equal(nonces.size, 50)
    for (const nonce of nonces) assert.equal(Buffer.from(nonce, 'base64').length, 16)
  })

  it('n’autorise que les scripts et styles porteurs du nonce, sans unsafe-inline', () => {
    const csp = cspCoffre('NONCE', { dev: false, deploye: true })
    // Partie D : 'wasm-unsafe-eval' pour libsodium (WebAssembly), et rien de plus.
    assert.match(csp, /script-src 'self' 'nonce-NONCE' 'strict-dynamic' 'wasm-unsafe-eval'(;|$)/)
    assert.match(csp, /style-src 'self' 'nonce-NONCE'(;|$)/)
    assert.ok(!csp.includes('unsafe-inline'))
    // 'wasm-unsafe-eval' n'ouvre que la compilation de WebAssembly, jamais eval() ni new Function.
    assert.ok(!csp.replace("'wasm-unsafe-eval'", '').includes('unsafe-eval'))
    assert.equal(csp.split("'wasm-unsafe-eval'").length, 2)
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ]) {
      assert.ok(csp.split('; ').includes(directive), directive)
    }
    assert.doesNotMatch(csp, /https?:\/\//)
  })

  it('ne relâche la politique qu’en développement, et n’impose https qu’une fois déployé', () => {
    const local = cspCoffre('NONCE', { dev: true, deploye: false })
    assert.match(
      local,
      /script-src 'self' 'nonce-NONCE' 'strict-dynamic' 'wasm-unsafe-eval' 'unsafe-eval'/,
    )
    assert.match(local, /style-src 'self' 'unsafe-inline'/)
    assert.ok(!local.includes('upgrade-insecure-requests'))
  })
})

describe('adresse d’une demande (partie D)', () => {
  it('écarte un identifiant qui n’est pas un UUID, laisse passer le reste', () => {
    for (const chemin of [
      '/coffre/demandes/pas-un-uuid',
      '/coffre/demandes/6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5',
      '/coffre/demandes/6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5bb',
      '/coffre/demandes/%3Cscript%3E',
      '/coffre/demandes/1',
    ]) {
      assert.equal(cheminDemandeMalForme(chemin), true, chemin)
    }
    for (const chemin of [
      '/coffre/demandes/6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b',
      '/coffre/demandes/6F1C2A8E-3B4D-4E5F-8A9B-0C1D2E3F4A5B',
      '/coffre/demandes/6f1c2a8e-3b4d-4e5f-8a9b-0c1d2e3f4a5b/',
      '/coffre',
      '/coffre/connexion',
      '/coffre/demandes',
    ]) {
      assert.equal(cheminDemandeMalForme(chemin), false, chemin)
    }
  })

  it('répond par une page minimale : ni script, ni style, noindex', () => {
    assert.doesNotMatch(PAGE_INTROUVABLE, /<script|<style|style=|<link/i)
    assert.match(PAGE_INTROUVABLE, /<html lang="fr">/)
    assert.match(PAGE_INTROUVABLE, /<meta name="robots" content="noindex, nofollow">/)
    assert.match(PAGE_INTROUVABLE, /<h1>Introuvable<\/h1>/)
  })
})
