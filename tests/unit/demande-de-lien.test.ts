import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { localizedPath, switchLocalePath } from '../../src/i18n/pathnames.ts'
import {
  cleDebitAdresse,
  empreinteAdresse,
  normaliserAdresse,
  secretEmpreinteAdresse,
  verifierSecretAdresseAuBuild,
} from '../../src/lib/booking/email-hmac.ts'
import { generateToken } from '../../src/lib/booking/tokens.ts'
import { lienValide, renderAccessLink } from '../../src/lib/email/access-link.ts'
import {
  lireValeursLien,
  piegeRempli,
  validerDemandeLien,
} from '../../src/lib/validation/booking-link.ts'

// Demande de lien de réservation (story 3.9 ; docs/reservation-appel.md §2, §4.1, §4.4) : empreinte
// d'adresse (secret serveur stable, jamais l'adresse), clé de limitation distincte, garde du build,
// e-mail d'accès minimal en FR et EN, validation de l'adresse, chemins localisés.

const SECRET = 'secret-de-test-des-empreintes-d-adresse-0123456789'
const ORIGINE = 'https://maisontriona.test'

function formulaire(champs: Record<string, string>): FormData {
  const donnees = new FormData()
  for (const [nom, valeur] of Object.entries(champs)) donnees.set(nom, valeur)
  return donnees
}

describe('empreinte d’adresse', () => {
  it('ne dépend que de l’adresse normalisée et du secret', () => {
    assert.equal(normaliserAdresse('  Camille.Martin@Exemple.TEST '), 'camille.martin@exemple.test')
    const a = empreinteAdresse('camille@exemple.test', SECRET)
    assert.equal(a.length, 32)
    assert.deepEqual(empreinteAdresse(' CAMILLE@exemple.test', SECRET), a)
    assert.notDeepEqual(empreinteAdresse('camille2@exemple.test', SECRET), a)
    assert.notDeepEqual(empreinteAdresse('camille@exemple.test', `${SECRET}x`), a)
    // Stable d'un jour à l'autre (contrairement au sel du jour des limites du formulaire).
    assert.deepEqual(empreinteAdresse('camille@exemple.test', SECRET), a)
  })

  it('la clé de limitation n’est pas la valeur de la base, et ne contient pas l’adresse', () => {
    const cle = cleDebitAdresse('camille@exemple.test', SECRET)
    assert.match(cle, /^[A-Za-z0-9_-]{43}$/)
    assert.notEqual(cle, empreinteAdresse('camille@exemple.test', SECRET).toString('base64url'))
    assert.equal(cle, cleDebitAdresse('Camille@Exemple.test', SECRET))
    assert.ok(!cle.includes('camille'))
  })

  it('refuse un secret vide', () => {
    assert.throws(() => empreinteAdresse('camille@exemple.test', ''), RangeError)
  })
})

describe('secret des empreintes (BOOKING_EMAIL_HMAC_SECRET)', () => {
  it('valable : 32 caractères visibles au moins, sans espace', () => {
    assert.equal(secretEmpreinteAdresse({ BOOKING_EMAIL_HMAC_SECRET: SECRET }), SECRET)
    assert.equal(
      secretEmpreinteAdresse({ BOOKING_EMAIL_HMAC_SECRET: SECRET, VERCEL_ENV: 'production' }),
      SECRET,
    )
    for (const mauvais of ['court', 'a'.repeat(31), `${'a'.repeat(20)} ${'b'.repeat(20)}`]) {
      assert.equal(secretEmpreinteAdresse({ BOOKING_EMAIL_HMAC_SECRET: mauvais }), null, mauvais)
      assert.equal(
        secretEmpreinteAdresse({ BOOKING_EMAIL_HMAC_SECRET: mauvais, VERCEL_ENV: 'preview' }),
        null,
      )
    }
  })

  it('absent : repli de développement hors Vercel et hors production, rien sinon', () => {
    const repli = secretEmpreinteAdresse({})
    assert.ok(repli && repli.length >= 32)
    assert.equal(secretEmpreinteAdresse({ BOOKING_EMAIL_HMAC_SECRET: '  ' }), repli)
    for (const VERCEL_ENV of ['production', 'preview', 'development']) {
      assert.equal(secretEmpreinteAdresse({ VERCEL_ENV }), null, VERCEL_ENV)
    }
    // Serveur de production lancé hors de Vercel : pas de repli non plus.
    assert.equal(secretEmpreinteAdresse({ NODE_ENV: 'production' }), null)
  })

  it('garde du build : exigé en production dès que la base et les e-mails sont posés', () => {
    const configure = {
      VERCEL_ENV: 'production',
      DATABASE_URL: 'postgres://site:mot-de-passe@base/maison',
      TEM_SECRET_KEY: 'cle-tem-de-test',
    }
    for (const env of [configure, { ...configure, BOOKING_EMAIL_HMAC_SECRET: 'court' }]) {
      assert.throws(
        () => verifierSecretAdresseAuBuild(env),
        (error: unknown) =>
          error instanceof Error &&
          error.message.includes('BOOKING_EMAIL_HMAC_SECRET') &&
          !error.message.includes('mot-de-passe') &&
          !error.message.includes('cle-tem-de-test') &&
          !error.message.includes('court'),
      )
    }
    for (const env of [
      { ...configure, BOOKING_EMAIL_HMAC_SECRET: SECRET },
      { ...configure, VERCEL_ENV: 'preview' },
      { ...configure, VERCEL_ENV: undefined },
      { ...configure, DATABASE_URL: undefined },
      { ...configure, TEM_SECRET_KEY: ' ' },
    ]) {
      assert.doesNotThrow(() => verifierSecretAdresseAuBuild(env), JSON.stringify(env))
    }
  })
})

describe('e-mail d’accès', () => {
  const { token } = generateToken()

  it('porte le lien de la page de réservation, 48 heures, en français et en anglais', () => {
    for (const locale of ['fr', 'en'] as const) {
      const link = `${ORIGINE}/${locale}/contact/appel/${token}`
      const mail = renderAccessLink({ locale, link })
      assert.ok(mail.text.split('\n').includes(link), locale)
      assert.match(mail.text, /48 (heures|hours)/)
      assert.match(mail.subject, / · Maison Triona$/)
      // Une seule adresse web : celle du lien ; aucun pixel, aucun lien traqué, aucun HTML.
      assert.equal(mail.text.match(/https?:\/\//g)?.length, 1)
      assert.ok(!/[<>]/.test(mail.text + mail.subject))
      // Sujet neutre : ni le jeton, ni rien qui dise la situation.
      assert.ok(!mail.subject.includes(token))
    }
  })

  it('ne nomme aucun service, aucune situation, aucun mot banni', () => {
    for (const locale of ['fr', 'en'] as const) {
      const mail = renderAccessLink({ locale, link: `${ORIGINE}/${locale}/contact/appel/${token}` })
      const texte = `${mail.subject}\n${mail.text}`.replace(token, '')
      assert.ok(
        !/concierg|grand.?[âa]ge|enfant|child|garde|nanny|senior|elder|sant[ée]|health|soin|care|aide|help|m[ée]dic|b[ée]n[ée]ficiaire|d[ée]pendance|personnes? [âa]g[ée]es?/i.test(
          texte,
        ),
        locale,
      )
      // Pas de tiret cadratin ; espace insécable avant « : » en français.
      assert.ok(!texte.includes('—'))
      if (locale === 'fr') assert.ok(!/ [:;?!]/.test(texte), 'espace ordinaire avant ponctuation')
    }
  })

  it('refuse tout autre lien', () => {
    for (const [locale, link] of [
      ['fr', `${ORIGINE}/en/contact/appel/${token}`],
      ['fr', `${ORIGINE}/fr/contact/appel/court`],
      ['fr', `${ORIGINE}/fr/contact/appel/${token}?suivi=1`],
      ['fr', `${ORIGINE}/fr/contact/appel/${token}#x`],
      ['fr', `https://intrus@maisontriona.test/fr/contact/appel/${token}`],
      ['fr', `javascript:alert(1)//${token}`],
      ['fr', `/fr/contact/appel/${token}`],
      ['en', `${ORIGINE}/en/contact/appel/${token}/confirmation`],
    ] as const) {
      assert.equal(lienValide(link, locale), false, link)
      assert.throws(() => renderAccessLink({ locale, link }), RangeError, link)
    }
    assert.throws(
      () =>
        renderAccessLink({
          locale: 'de' as 'fr',
          link: `${ORIGINE}/fr/contact/appel/${token}`,
        }),
      RangeError,
    )
  })
})

describe('validation de la demande', () => {
  it('lit l’adresse, la langue et l’horodatage, rien d’autre', () => {
    const valeurs = lireValeursLien(
      formulaire({ email: '  camille@exemple.test ', locale: 'en', jeton: 'x', nom: 'Camille' }),
    )
    assert.deepEqual(valeurs, { email: 'camille@exemple.test', locale: 'en', jeton: 'x' })
    assert.equal(lireValeursLien(formulaire({ email: 'a'.repeat(5000) })).email?.length, 1000)
  })

  it('exige une adresse valable de 254 caractères au plus', () => {
    assert.deepEqual(validerDemandeLien({}), { succes: false, erreur: 'emailRequis' })
    for (const email of [
      'camille',
      'camille@',
      '@exemple.test',
      `${'a'.repeat(250)}@exemple.test`,
    ]) {
      assert.deepEqual(
        validerDemandeLien({ email }),
        { succes: false, erreur: 'emailFormat' },
        email,
      )
    }
    assert.deepEqual(validerDemandeLien({ email: 'camille@exemple.test', locale: 'xx' }), {
      succes: true,
      demande: { email: 'camille@exemple.test', locale: 'fr' },
    })
    assert.deepEqual(validerDemandeLien({ email: 'camille@exemple.test', locale: 'en' }), {
      succes: true,
      demande: { email: 'camille@exemple.test', locale: 'en' },
    })
  })

  it('repère le piège à robots', () => {
    assert.equal(piegeRempli(formulaire({ reference_interne: 'https://exemple.test' })), true)
    assert.equal(piegeRempli(formulaire({ reference_interne: '  ' })), false)
    assert.equal(piegeRempli(formulaire({})), false)
  })
})

describe('chemins de la demande de lien', () => {
  it('sont localisés et passent d’une langue à l’autre', () => {
    assert.equal(localizedPath('/contact/appel', 'fr'), '/fr/contact/appel')
    assert.equal(localizedPath('/contact/appel', 'en'), '/en/contact/call')
    assert.equal(localizedPath('/contact/appel/envoye', 'fr'), '/fr/contact/appel/envoye')
    assert.equal(localizedPath('/contact/appel/envoye', 'en'), '/en/contact/call/sent')
    assert.equal(switchLocalePath('/fr/contact/appel', 'en'), '/en/contact/call')
    assert.equal(switchLocalePath('/en/contact/call/sent', 'fr'), '/fr/contact/appel/envoye')
  })
})
