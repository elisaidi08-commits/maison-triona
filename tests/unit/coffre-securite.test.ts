import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { creerNonce, cspCoffre, estCheminCoffre } from '../../src/lib/coffre/securite.ts'

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
    assert.match(csp, /script-src 'self' 'nonce-NONCE' 'strict-dynamic'(;|$)/)
    assert.match(csp, /style-src 'self' 'nonce-NONCE'(;|$)/)
    assert.ok(!csp.includes('unsafe-inline'))
    assert.ok(!csp.includes('unsafe-eval'))
    // Partie D : 'wasm-unsafe-eval' reste à ajouter, il n'est pas encore là.
    assert.ok(!csp.includes('wasm-unsafe-eval'))
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
    assert.match(local, /script-src 'self' 'nonce-NONCE' 'strict-dynamic' 'unsafe-eval'/)
    assert.match(local, /style-src 'self' 'unsafe-inline'/)
    assert.ok(!local.includes('upgrade-insecure-requests'))
  })
})
