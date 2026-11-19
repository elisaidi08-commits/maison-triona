import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { PRIVACY_POLICY_VERSION } from '../../src/lib/privacy.ts'

// Version de la politique de confidentialité enregistrée avec chaque demande (preuve du
// consentement, migration 0002). Garde-fou : si le texte de la politique (`Privacy`, FR et EN)
// change, ce test échoue tant que PRIVACY_POLICY_VERSION et l'empreinte ci-dessous ne sont pas
// mises à jour ensemble.

const lire = (langue: string) =>
  (
    JSON.parse(readFileSync(new URL(`../../messages/${langue}.json`, import.meta.url), 'utf8')) as {
      Privacy: unknown
    }
  ).Privacy

const EMPREINTES: Record<string, string> = {
  '2026-11-18': 'b178f13d77d1d90e8e4b57e4b06ce3c5790d8badf480ce40632a6c37cc41f807',
  // Réservation d'appel (story 3.10) : la politique ne décrit que ce qui existe (ni e-mail, ni SMS,
  // ni agenda Google pour les appels).
  '2026-11-19': '23e8ca2001bcc658bdf252a3e7bf771ff6993f92847d2633314a36e00bb5430b',
}

describe('PRIVACY_POLICY_VERSION', () => {
  it('suit le texte publié de la politique de confidentialité', () => {
    const empreinte = createHash('sha256')
      .update(JSON.stringify([lire('fr'), lire('en')]))
      .digest('hex')
    assert.equal(
      empreinte,
      EMPREINTES[PRIVACY_POLICY_VERSION],
      'Politique modifiée : nouvelle PRIVACY_POLICY_VERSION (src/lib/privacy.ts) et son empreinte ici',
    )
  })

  it('tient dans la colonne privacy_version (1 à 40 caractères)', () => {
    assert.match(PRIVACY_POLICY_VERSION, /^[A-Za-z0-9.-]{1,40}$/)
  })
})
