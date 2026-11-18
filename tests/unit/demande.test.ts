import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { ETAPES, premiereEtapeEnErreur, type Valeurs } from '../../src/lib/demande/champs.ts'
import {
  lireValeurs,
  telephoneValide,
  validerDemande,
  validerEtape,
} from '../../src/lib/validation/demande.ts'

// Schéma de la demande (stories 3.1 et 3.4, docs/architecture.md §6.2, D41).

const COMPLETE: Valeurs = {
  besoin: 'grand-age',
  pays: 'BE',
  urgence: 'aucune',
  nom: 'Camille Martin',
  email: 'camille@example.com',
  langue: 'fr',
  consentement: 'oui',
  locale: 'fr',
}

function sans(valeurs: Valeurs, champ: keyof Valeurs): Valeurs {
  const copie = { ...valeurs }
  delete copie[champ]
  return copie
}

function formData(entrees: Record<string, string>): FormData {
  const donnees = new FormData()
  for (const [cle, valeur] of Object.entries(entrees)) donnees.append(cle, valeur)
  return donnees
}

describe('validerDemande', () => {
  test('une demande complète passe', () => {
    const resultat = validerDemande(COMPLETE)
    assert.equal(resultat.succes, true)
  })

  test('un formulaire vide signale chaque champ requis, et le moyen de vous joindre', () => {
    const resultat = validerDemande({})
    assert.equal(resultat.succes, false)
    if (resultat.succes) return
    assert.deepEqual(resultat.erreurs, {
      besoin: 'besoin',
      pays: 'pays',
      urgence: 'urgence',
      nom: 'nomRequis',
      email: 'contactRequis',
      langue: 'langue',
      consentement: 'consentement',
    })
  })

  test('e-mail ou téléphone : l’un des deux suffit, aucun ne passe pas', () => {
    const sansEmail = sans(COMPLETE, 'email')
    assert.equal(validerDemande({ ...sansEmail, telephone: '+32 470 00 00 00' }).succes, true)
    const aucun = validerDemande(sansEmail)
    assert.equal(aucun.succes, false)
    if (!aucun.succes) assert.equal(aucun.erreurs.email, 'contactRequis')
  })

  test('nom de 2 à 120 caractères', () => {
    const court = validerDemande({ ...COMPLETE, nom: 'A' })
    const long = validerDemande({ ...COMPLETE, nom: 'A'.repeat(121) })
    assert.equal(court.succes || court.erreurs.nom, 'nomCourt')
    assert.equal(long.succes || long.erreurs.nom, 'nomLong')
    assert.equal(validerDemande({ ...COMPLETE, nom: 'Al' }).succes, true)
    assert.equal(validerDemande({ ...COMPLETE, nom: 'A'.repeat(120) }).succes, true)
  })

  test('mot libre : 2 000 caractères au plus, facultatif', () => {
    assert.equal(validerDemande({ ...COMPLETE, message: 'a'.repeat(2000) }).succes, true)
    const long = validerDemande({ ...COMPLETE, message: 'a'.repeat(2001) })
    assert.equal(long.succes || long.erreurs.message, 'messageLong')
  })

  test('le consentement est requis', () => {
    const resultat = validerDemande(sans(COMPLETE, 'consentement'))
    assert.equal(resultat.succes || resultat.erreurs.consentement, 'consentement')
  })

  test('listes fermées : pays de D41, origine sans texte libre, valeur inconnue refusée', () => {
    for (const pays of ['BE', 'FR', 'LU', 'MC', 'CH', 'ailleurs', 'non-dit']) {
      assert.equal(validerDemande({ ...COMPLETE, pays }).succes, true, pays)
    }
    const pays = validerDemande({ ...COMPLETE, pays: 'DE' })
    assert.equal(pays.succes || pays.erreurs.pays, 'pays')
    assert.equal(validerDemande({ ...COMPLETE, origine: 'salon' }).succes, true)
    const origine = validerDemande({ ...COMPLETE, origine: 'Clinique des Lilas' })
    assert.equal(origine.succes || origine.erreurs.origine, 'origine')
    const urgence = validerDemande({ ...COMPLETE, urgence: 'immediat' })
    assert.equal(urgence.succes || urgence.erreurs.urgence, 'urgence')
  })

  test('la langue de l’interface inconnue retombe sur le français, sans erreur', () => {
    const resultat = validerDemande({ ...COMPLETE, locale: 'de' })
    assert.equal(resultat.succes, true)
    if (resultat.succes) assert.equal(resultat.demande.locale, 'fr')
  })

  test('aucun champ santé dans la demande validée', () => {
    const resultat = validerDemande({ ...COMPLETE, sante: 'x' } as Valeurs)
    assert.equal(resultat.succes, true)
    if (resultat.succes) assert.equal('sante' in resultat.demande, false)
  })
})

describe('validerEtape', () => {
  test('chaque étape ne signale que ses propres champs', () => {
    ETAPES.forEach((champs, etape) => {
      const erreurs = validerEtape(etape, {})
      for (const champ of Object.keys(erreurs)) {
        assert.ok(
          (champs as readonly string[]).includes(champ),
          `${champ} hors de l’étape ${etape}`,
        )
      }
    })
  })

  test('étape 3 : le moyen de vous joindre est vérifié avec elle', () => {
    assert.deepEqual(validerEtape(2, { nom: 'Camille', langue: 'fr' }), { email: 'contactRequis' })
    assert.deepEqual(
      validerEtape(2, { nom: 'Camille', langue: 'fr', telephone: '+352 22 33 44' }),
      {},
    )
  })

  test('première étape en erreur', () => {
    assert.equal(premiereEtapeEnErreur({ consentement: 'consentement', pays: 'pays' }), 1)
    assert.equal(premiereEtapeEnErreur({}), null)
  })
})

describe('lireValeurs', () => {
  test('nettoie les espaces, ignore les champs vides et inconnus', () => {
    const valeurs = lireValeurs(
      formData({ nom: '  Camille  ', email: '   ', besoin: 'enfants', site: 'x', jeton: 'y' }),
    )
    assert.deepEqual(valeurs, { nom: 'Camille', besoin: 'enfants' })
  })

  test('les retours à la ligne du mot libre comptent pour un caractère', () => {
    const message = `${'a'.repeat(999)}\r\n${'b'.repeat(1000)}`
    const valeurs = lireValeurs(formData({ message }))
    assert.equal(valeurs.message?.length, 2000)
    assert.equal(validerDemande({ ...COMPLETE, ...valeurs }).succes, true)
  })
})

describe('telephoneValide', () => {
  test('numéros des cinq pays, avec ou sans indicatif', () => {
    for (const numero of [
      '+32 470 12 34 56',
      '0470 12.34.56',
      '+33 6 12 34 56 78',
      '+352 22 33 44',
      '+377 93 15 00 00',
      '+41 (0)22 123 45 67',
    ]) {
      assert.equal(telephoneValide(numero), true, numero)
    }
  })

  test('refuse lettres, trop peu ou trop de chiffres', () => {
    for (const numero of ['appelez-moi', '12345', '+1234567890123456', '06 12 AB 56 78']) {
      assert.equal(telephoneValide(numero), false, numero)
    }
  })
})
