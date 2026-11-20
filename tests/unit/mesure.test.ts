import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NOMS_EVENEMENTS,
  cheminMesurable,
  construireEvenement,
  referentExterne,
} from '../../src/lib/mesure/evenements.ts'

const SITE = 'https://maisontriona.com'

test('les événements sont une liste fermée, sans identifiant', () => {
  assert.deepEqual(Object.keys(NOMS_EVENEMENTS).sort(), [
    'entree:conciergerie',
    'entree:enfants',
    'entree:grand-age',
    'entree:indecis',
    'langue:en',
    'langue:fr',
    'partage:email',
    'partage:lien',
  ])
})

test('le chemin perd ses paramètres et son ancre', () => {
  assert.equal(cheminMesurable('/fr/contact?service=grand-age&s=salon'), '/fr/contact')
  assert.equal(cheminMesurable('/en/faq#question-3'), '/en/faq')
  assert.equal(cheminMesurable('/fr'), '/fr')
})

test('les liens de réservation ne sont jamais comptés (le jeton partirait)', () => {
  assert.equal(cheminMesurable('/fr/contact/appel/Zm9vYmFyYmF6'), null)
  assert.equal(cheminMesurable('/en/contact/appel/Zm9vYmFyYmF6/confirmation'), null)
  assert.equal(cheminMesurable('/fr/contact/appel/gerer/Zm9vYmFy'), null)
  // La demande de lien et sa page d'envoi, sans jeton, restent comptées dans les deux langues.
  assert.equal(cheminMesurable('/fr/contact/appel'), '/fr/contact/appel')
  assert.equal(cheminMesurable('/fr/contact/appel/envoye'), '/fr/contact/appel/envoye')
  assert.equal(cheminMesurable('/en/contact/call/sent'), '/en/contact/call/sent')
})

test('un chemin hors de la liste des pages est compté comme /404', () => {
  assert.equal(cheminMesurable('/fr/n-importe-quoi-de-forge'), '/404')
  assert.equal(cheminMesurable('/fr/<script>'), '/404')
  assert.equal(cheminMesurable('/en/the-house'), '/en/the-house')
  assert.equal(cheminMesurable('/fr/the-house'), '/404')
})

test('le coffre, la démo et tout chemin hors des deux langues sont refusés', () => {
  assert.equal(cheminMesurable('/coffre'), null)
  assert.equal(cheminMesurable('/coffre/demandes/abc'), null)
  assert.equal(cheminMesurable('/fr/demo'), null)
  assert.equal(cheminMesurable('/de/accueil'), null)
  assert.equal(cheminMesurable('https://example.org/fr'), null)
  assert.equal(cheminMesurable(`/fr/${'a'.repeat(300)}`), null)
})

test('le référent : l’origine d’un site externe seulement', () => {
  assert.equal(
    referentExterne('https://www.google.be/search?q=conciergerie+bruxelles', SITE),
    'https://www.google.be',
  )
  assert.equal(referentExterne('https://maisontriona.com/fr/contact/appel/jeton', SITE), null)
  assert.equal(referentExterne('', SITE), null)
  assert.equal(referentExterne('pas une adresse', SITE), null)
})

test('une page vue devient un événement Plausible complet, sans propriété', () => {
  assert.deepEqual(
    construireEvenement({
      evenement: 'pageview',
      chemin: '/fr/faq?x=1',
      referent: 'https://duckduckgo.com/?q=x',
      siteUrl: SITE,
      domaine: 'maisontriona.com',
    }),
    {
      name: 'pageview',
      url: 'https://maisontriona.com/fr/faq',
      domain: 'maisontriona.com',
      referrer: 'https://duckduckgo.com',
    },
  )
})

test('un événement est rattaché à la racine de la langue, jamais à la page', () => {
  assert.deepEqual(
    construireEvenement({
      evenement: 'partage:email',
      chemin: '/fr/services/grand-age',
      referent: null,
      siteUrl: SITE,
      domaine: 'maisontriona.com',
    }),
    { name: 'Partage e-mail', url: 'https://maisontriona.com/fr', domain: 'maisontriona.com' },
  )
})

test('un choix d’entrée porte son nom d’événement, pas de propriété (offre Business)', () => {
  assert.deepEqual(
    construireEvenement({
      evenement: 'entree:grand-age',
      chemin: '/fr',
      referent: null,
      siteUrl: SITE,
      domaine: 'maisontriona.com',
    }),
    { name: 'Entrée grand âge', url: 'https://maisontriona.com/fr', domain: 'maisontriona.com' },
  )
})

test('un événement inconnu ou un chemin exclu ne produit rien', () => {
  const base = { chemin: '/fr', referent: null, siteUrl: SITE, domaine: 'maisontriona.com' }
  assert.equal(construireEvenement({ ...base, evenement: 'clic:bouton' }), null)
  assert.equal(
    construireEvenement({ ...base, evenement: 'pageview', chemin: '/fr/contact/appel/jeton' }),
    null,
  )
})
