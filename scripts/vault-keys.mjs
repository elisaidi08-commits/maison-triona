// Génère la paire de clés du coffre des demandes (story 3.2, partie B ; procédure complète :
// docs/coffre-cles.md). À lancer à la main, sur un poste de confiance, de préférence hors ligne :
//
//   npm run vault:keys -- "/Volumes/CLE COFFRE/maison-triona-coffre.json"
//
// - La phrase de passe se saisit au clavier, deux fois, sans écho : jamais en argument (elle
//   resterait dans l'historique du terminal). Sans terminal, elle est lue sur l'entrée standard
//   (deux lignes).
// - Le paquet (sel et paramètres d'Argon2id, nonce, clé privée chiffrée, clé publique) est écrit
//   en 0600, **hors du dépôt** (refus sinon), sans jamais écraser un fichier existant.
// - Seule la clé publique s'affiche, en base64, sur la sortie standard : la valeur de
//   VAULT_PUBLIC_KEY. Ni la clé privée ni la phrase ne sont affichées ou journalisées.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createKeyPacket } from '../src/lib/vault/key-packet.ts'
import { checkOutputPath, OutputPathError } from './lib/vault-keys.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const USAGE = 'Usage : npm run vault:keys -- <chemin du paquet, hors du dépôt>'

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

// Sans terminal (tests, tube) : les deux premières lignes de l'entrée standard.
async function lireEntree() {
  let texte = ''
  process.stdin.setEncoding('utf8')
  for await (const bloc of process.stdin) texte += bloc
  const [phrase = '', confirmation = ''] = texte.split(/\r?\n/)
  return { phrase, confirmation }
}

async function lirePhrase() {
  if (!process.stdin.isTTY) return lireEntree()
  const phrase = await lireMasque('Phrase de passe (16 caractères au moins, rien ne s’affiche) : ')
  const confirmation = await lireMasque('La même, une seconde fois : ')
  return { phrase, confirmation }
}

const args = process.argv.slice(2)
if (args.length > 1) {
  echouer(
    `${USAGE}\nLa phrase de passe se saisit au clavier, jamais en argument. Si vous l’avez tapée ` +
      'dans la commande, elle est dans l’historique du terminal : choisissez-en une autre.',
    2,
  )
}
if (args.length === 0 || args[0].startsWith('-')) echouer(USAGE, 2)

try {
  const sortie = checkOutputPath(args[0], ROOT)
  const { phrase, confirmation } = await lirePhrase()
  if (phrase !== confirmation) throw new OutputPathError('Les deux saisies diffèrent : rien écrit.')

  const { packet, publicKey } = await createKeyPacket(phrase)
  // `wx` : jamais d'écrasement, même si le fichier apparaît entre la vérification et l'écriture.
  writeFileSync(sortie, `${JSON.stringify(packet, null, 2)}\n`, { flag: 'wx', mode: 0o600 })

  process.stderr.write(
    `Paquet écrit : ${sortie} (lecture réservée à votre compte).\n` +
      'Gardez-en deux copies hors ligne (docs/coffre-cles.md). Clé publique, pour VAULT_PUBLIC_KEY :\n',
  )
  process.stdout.write(`${publicKey}\n`)
} catch (error) {
  // Seulement nos propres messages : jamais une trace, jamais une valeur saisie.
  const lisible = error instanceof OutputPathError || error instanceof RangeError
  echouer(lisible ? error.message : 'Échec de la génération des clés : aucun paquet écrit.')
}
