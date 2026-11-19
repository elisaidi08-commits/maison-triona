import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { describe, it } from 'node:test'

import {
  ACCESS_TOKEN_TTL_HOURS,
  accessTokenExpiry,
  accessTokenState,
  generateToken,
  hashToken,
  isTokenFormat,
  TOKEN_LENGTH,
  tokenMatches,
} from '../../src/lib/booking/tokens.ts'

// Jetons des liens de réservation (story 3.10 ; docs/reservation-appel.md §4.4) : 32 octets
// aléatoires en base64url, empreinte SHA-256 seule en base, comparaison à temps constant, 48 heures.

const BASE64URL = /^[A-Za-z0-9_-]+$/
const MAINTENANT = new Date('2027-03-01T08:00:00Z')

describe('jetons des liens de réservation', () => {
  it('tire 32 octets aléatoires, écrits en base64url sans remplissage (43 caractères)', () => {
    const vus = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const { token } = generateToken()
      assert.equal(token.length, TOKEN_LENGTH)
      assert.equal(TOKEN_LENGTH, 43)
      assert.match(token, BASE64URL)
      assert.equal(Buffer.from(token, 'base64url').length, 32)
      vus.add(token)
    }
    assert.equal(vus.size, 200)
  })

  it('rend l’empreinte SHA-256 du jeton (32 octets), jamais le jeton lui-même', () => {
    const { token, hash } = generateToken()
    assert.equal(hash.length, 32)
    assert.deepEqual(hash, createHash('sha256').update(token, 'utf8').digest())
    assert.deepEqual(hashToken(token), hash)
    assert.ok(!hash.toString('hex').includes(Buffer.from(token).toString('hex')))
    // Deux jetons, deux empreintes.
    assert.notDeepEqual(generateToken().hash, hash)
  })

  it('ne reconnaît que le format exact : 43 caractères base64url', () => {
    const { token } = generateToken()
    assert.ok(isTokenFormat(token))
    for (const valeur of [
      token.slice(1),
      `${token}A`,
      `${token.slice(0, 42)}=`,
      `${token.slice(0, 42)}+`,
      `${token.slice(0, 42)}/`,
      `${token.slice(0, 42)}.`,
      `${token.slice(0, 42)} `,
      '',
      null,
      undefined,
      42,
      ['a'],
    ]) {
      assert.equal(isTokenFormat(valeur), false, String(valeur))
    }
  })

  it('compare les empreintes à temps constant, sans lever d’erreur sur une longueur inattendue', () => {
    const { token, hash } = generateToken()
    assert.equal(tokenMatches(token, hash), true)
    assert.equal(tokenMatches(token, new Uint8Array(hash)), true)
    assert.equal(tokenMatches(generateToken().token, hash), false)
    const altere = Buffer.from(hash)
    altere[31] = (altere[31] ?? 0) ^ 1
    assert.equal(tokenMatches(token, altere), false)
    assert.equal(tokenMatches(token, hash.subarray(0, 31)), false)
    assert.equal(tokenMatches(token, Buffer.alloc(0)), false)
    assert.equal(tokenMatches('court', hash), false)
  })

  it('expire 48 heures après sa création', () => {
    assert.equal(ACCESS_TOKEN_TTL_HOURS, 48)
    assert.equal(accessTokenExpiry(MAINTENANT).toISOString(), '2027-03-03T08:00:00.000Z')
    assert.throws(() => accessTokenExpiry(new Date(Number.NaN)), RangeError)
  })

  it('dit l’état d’un lien d’accès : valable, expiré, utilisé, annulé, autre usage', () => {
    const lien = {
      purpose: 'access' as const,
      expiresAt: accessTokenExpiry(MAINTENANT),
      usedAt: null,
      revokedAt: null,
    }
    assert.equal(accessTokenState(lien, MAINTENANT), 'valid')
    assert.equal(accessTokenState(lien, new Date('2027-03-03T07:59:59.999Z')), 'valid')
    // À l'instant de l'échéance, le lien ne vaut plus.
    assert.equal(accessTokenState(lien, new Date('2027-03-03T08:00:00Z')), 'expired')
    assert.equal(accessTokenState({ ...lien, usedAt: MAINTENANT }, MAINTENANT), 'used')
    assert.equal(accessTokenState({ ...lien, revokedAt: MAINTENANT }, MAINTENANT), 'revoked')
    // Annulé l'emporte sur utilisé, utilisé sur expiré.
    assert.equal(
      accessTokenState({ ...lien, usedAt: MAINTENANT, revokedAt: MAINTENANT }, MAINTENANT),
      'revoked',
    )
    assert.equal(
      accessTokenState({ ...lien, usedAt: MAINTENANT }, new Date('2027-03-04T00:00:00Z')),
      'used',
    )
    assert.equal(accessTokenState({ ...lien, purpose: 'manage' }, MAINTENANT), 'wrong-purpose')
    assert.throws(() => accessTokenState(lien, new Date(Number.NaN)), RangeError)
  })
})
