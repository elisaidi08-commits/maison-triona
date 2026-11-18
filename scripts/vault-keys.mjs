// Génère la paire de clés du coffre des demandes (story 3.2, partie B ; procédure complète :
// docs/coffre-cles.md). À lancer à la main, sur un poste de confiance, de préférence hors ligne :
//
//   npm run vault:keys -- "/Volumes/COFFRE SADY/maison-triona-coffre-sady.json"
//   npm run vault:keys -- --ajouter "/Volumes/COFFRE SADY/…-sady.json" "/Volumes/COFFRE CAT/…-cat.json"
//
// La première forme crée la paire de clés et un premier paquet. La seconde donne à une autre
// personne son propre paquet de la même paire, chiffré par sa propre phrase : la phrase du paquet
// existant est saisie par son détenteur, puis la nouvelle, deux fois, par la nouvelle personne.
// - Les phrases se saisissent au clavier, sans écho : jamais en argument (elles resteraient dans
//   l'historique du terminal). Sans terminal, elles sont lues sur l'entrée standard, une par ligne.
//   Les chemins doivent finir par .json.
// - Le paquet (sel et paramètres d'Argon2id, nonce, clé privée chiffrée, clé publique) est écrit
//   en 0600, **hors du dépôt** (refus sinon), sans jamais écraser un fichier existant.
// - Seule la clé publique s'affiche, en base64, sur la sortie standard : la valeur de
//   VAULT_PUBLIC_KEY. Ni la clé privée ni la phrase ne sont affichées ou journalisées.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createKeyPacket } from '../src/lib/vault/key-packet.ts'
import { addPassphrase, VaultOpenError } from '../src/lib/vault/open.ts'
import { checkOutputPath, OutputPathError } from './lib/vault-keys.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const USAGE =
  'Usage : npm run vault:keys -- <paquet.json, hors du dépôt>\n' +
  '        npm run vault:keys -- --ajouter <paquet existant.json> <nouveau paquet.json>'

function echouer(message, code = 1) {
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

// Saisie masquée au terminal : rien ne s'affiche, Retour arrière efface, Ctrl+C interrompt.
function lireMasque(invite) {
  return new Promise((resolve, reject) => {
    const { stdin } = process
    process.stderr.write(invite)
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    let saisie = ''
    const terminer = () => {
      stdin.off('data', surDonnees)
      stdin.setRawMode(false)
      stdin.pause()
      process.stderr.write('\n')
    }
    function surDonnees(bloc) {
      for (const caractere of bloc) {
        if (caractere === '\r' || caractere === '\n') {
          terminer()
          resolve(saisie)
          return
        }
        if (caractere === '\u0003' || caractere === '\u0004') {
          terminer()
          reject(new OutputPathError('Interrompu : aucun paquet écrit.'))
          return
        }
        if (caractere === '\u007f' || caractere === '\b') {
          saisie = [...saisie].slice(0, -1).join('')
          continue
        }
        saisie += caractere
      }
    }
    stdin.on('data', surDonnees)
  })
}

// Sans terminal (tests, tube) : une ligne par saisie, dans l'ordre des questions.
let lignes
async function ligneSuivante() {
  if (!lignes) {
    let texte = ''
    process.stdin.setEncoding('utf8')
    for await (const bloc of process.stdin) texte += bloc
    lignes = texte.split(/\r?\n/)
  }
  return lignes.shift() ?? ''
}

function saisir(invite) {
  return process.stdin.isTTY ? lireMasque(invite) : ligneSuivante()
}

// Nouvelle phrase, saisie deux fois.
async function nouvellePhrase(invite) {
  const phrase = await saisir(`${invite} (16 caractères au moins, rien ne s’affiche) : `)
  const confirmation = await saisir('La même, une seconde fois : ')
  if (phrase !== confirmation) throw new OutputPathError('Les deux saisies diffèrent : rien écrit.')
  return phrase
}

function ecrire(sortie, packet) {
  // `wx` : jamais d'écrasement, même si le fichier apparaît entre la vérification et l'écriture.
  writeFileSync(sortie, `${JSON.stringify(packet, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
  process.stderr.write(
    `Paquet écrit : ${sortie} (lecture réservée à votre compte).\n` +
      'Rangez-le hors ligne (docs/coffre-cles.md). Clé publique, pour VAULT_PUBLIC_KEY :\n',
  )
  process.stdout.write(`${packet.publicKey}\n`)
}

// Les chemins finissent par .json : un argument qui n'en est pas un est peut-être une phrase.
const args = process.argv.slice(2)
const ajout = args[0] === '--ajouter'
const chemins = ajout ? args.slice(1) : args
const attendus = ajout ? 2 : 1
if (chemins.length !== attendus || !chemins.every((chemin) => /\.json$/i.test(chemin))) {
  echouer(
    `${USAGE}\nLa phrase de passe se saisit au clavier, jamais en argument. Si vous l’avez tapée ` +
      'dans la commande, elle est dans l’historique du terminal : choisissez-en une autre.',
    2,
  )
}

try {
  if (ajout) {
    const [existant, cible] = chemins
    const sortie = checkOutputPath(cible, ROOT)
    let paquet
    try {
      paquet = JSON.parse(readFileSync(existant, 'utf8'))
    } catch {
      throw new OutputPathError('Paquet existant illisible : rien écrit.')
    }
    const actuelle = await saisir('Phrase de passe du paquet existant (rien ne s’affiche) : ')
    const nouvelle = await nouvellePhrase('Phrase de passe de la nouvelle personne')
    ecrire(sortie, await addPassphrase(paquet, actuelle, nouvelle))
  } else {
    const sortie = checkOutputPath(chemins[0], ROOT)
    const phrase = await nouvellePhrase('Phrase de passe')
    ecrire(sortie, (await createKeyPacket(phrase)).packet)
  }
} catch (error) {
  // Seulement nos propres messages : jamais une trace, jamais une valeur saisie.
  const lisible =
    error instanceof OutputPathError ||
    error instanceof RangeError ||
    error instanceof VaultOpenError
  echouer(lisible ? error.message : 'Échec : aucun paquet écrit.')
}
