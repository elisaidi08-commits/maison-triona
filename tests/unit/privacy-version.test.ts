import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { PRIVACY_ANCHORS, PRIVACY_POLICY_VERSION, privacyHref } from '../../src/lib/privacy.ts'

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
  // Demande de lien (story 3.9) : l'adresse e-mail, son empreinte et le fournisseur d'envoi.
  '2026-11-20': 'd2652a7f307185c59e2e15a6c9afa7db1a2c631bd6a172e11cdb940ddae40e4d',
  // Suites de la demande de lien (D72) : plus de confirmation promise au visiteur (D69), la limite
  // de l'e-mail d'accès saisi par un autre, une phrase française restée de la 3.10 retirée.
  '2026-11-20.2': '88116d4b97b351b235d00051a00e059be98db2f18fe4514a30574b67e3327905',
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

// Les formulaires renvoient à leur section de la politique : l'ancre doit exister dans la langue de
// la page (D72 : `#demande` et `#appel` n'existaient pas en anglais).
describe('ancres de la politique', () => {
  it('existent en FR et en EN, et le lien suit la langue', () => {
    for (const langue of ['fr', 'en'] as const) {
      const ids = (lire(langue) as { sections: { id: string }[] }).sections.map((s) => s.id)
      for (const ancres of Object.values(PRIVACY_ANCHORS)) {
        assert.ok(ids.includes(ancres[langue]), `${langue} : #${ancres[langue]}`)
      }
    }
    assert.equal(privacyHref('demande', 'fr'), '/fr/confidentialite#demande')
    assert.equal(privacyHref('demande', 'en'), '/en/privacy#enquiry')
    assert.equal(privacyHref('appel', 'fr'), '/fr/confidentialite#appel')
    assert.equal(privacyHref('appel', 'en'), '/en/privacy#call')
  })
})
