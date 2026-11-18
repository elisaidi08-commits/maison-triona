import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { unlockPrivateKey } from '../../src/lib/vault/open.ts'
import {
  checkOutputPath,
  isInsideDirectory,
  OutputPathError,
} from '../../scripts/lib/vault-keys.mjs'

// Script hors ligne de génération des clés (story 3.2, partie B ; docs/coffre-cles.md) : refus de
// tout chemin de sortie dans le dépôt, phrase de passe lue sur l'entrée standard, jamais affichée.

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const SCRIPT = join(ROOT, 'scripts/vault-keys.mjs')
const PHRASE = 'une phrase de passe factice, assez longue'

let dehors: string

function lancer(args: string[], input = '') {
  return spawnSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', SCRIPT, ...args],
    { cwd: ROOT, input, encoding: 'utf8' },
  )
}

describe('chemin de sortie du paquet', () => {
  before(() => {
    dehors = mkdtempSync(join(tmpdir(), 'mt-cles-'))
  })
  after(() => rmSync(dehors, { recursive: true, force: true }))

  it('reconnaît un chemin dans le dépôt, même absent ou profond', () => {
    assert.equal(isInsideDirectory(ROOT, ROOT), true)
    assert.equal(isInsideDirectory(join(ROOT, 'paquet.json'), ROOT), true)
    assert.equal(isInsideDirectory(join(ROOT, 'a/b/c/paquet.json'), ROOT), true)
    assert.equal(isInsideDirectory(join(ROOT, 'docs/../paquet.json'), ROOT), true)
    assert.equal(isInsideDirectory(join(dehors, 'paquet.json'), ROOT), false)
    assert.equal(isInsideDirectory(join(ROOT, '../paquet.json'), ROOT), false)
  })

  it('suit les liens symboliques qui mènent dans le dépôt', () => {
    const versRacine = join(dehors, 'vers-racine')
    const versDocs = join(dehors, 'vers-docs')
    symlinkSync(ROOT, versRacine)
    symlinkSync(join(ROOT, 'docs'), versDocs)
    assert.equal(isInsideDirectory(join(versRacine, 'paquet.json'), ROOT), true)
    assert.equal(isInsideDirectory(join(versDocs, 'paquet.json'), ROOT), true)
    assert.equal(isInsideDirectory(join(versDocs, 'x/y/paquet.json'), ROOT), true)
  })

  it('refuse un fichier existant ou un dossier introuvable', () => {
    const existant = join(dehors, 'existant.json')
    writeFileSync(existant, '{}')
    assert.throws(() => checkOutputPath(existant, ROOT), OutputPathError)
    assert.throws(() => checkOutputPath(join(dehors, 'absent/paquet.json'), ROOT), OutputPathError)
    assert.throws(() => checkOutputPath('', ROOT), OutputPathError)
    assert.equal(checkOutputPath(join(dehors, 'neuf.json'), ROOT), join(dehors, 'neuf.json'))
  })
})

describe('script vault-keys', () => {
  before(() => {
    dehors = mkdtempSync(join(tmpdir(), 'mt-cles-'))
  })
  after(() => rmSync(dehors, { recursive: true, force: true }))

  it('refuse un chemin de sortie dans le dépôt, sans rien écrire', () => {
    for (const cible of [
      join(ROOT, 'paquet-refuse.json'),
      join(ROOT, 'docs/paquet-refuse.json'),
      'paquet-refuse.json',
    ]) {
      const resultat = lancer([cible], `${PHRASE}\n${PHRASE}\n`)
      assert.equal(resultat.status, 1, cible)
      assert.match(resultat.stderr, /hors du dépôt/)
      assert.equal(resultat.stdout, '')
    }
    assert.equal(existsSync(join(ROOT, 'paquet-refuse.json')), false)
    assert.equal(existsSync(join(ROOT, 'docs/paquet-refuse.json')), false)
  })

  it('refuse une phrase de passe passée en argument, sans la répéter', () => {
    const resultat = lancer([join(dehors, 'paquet.json'), PHRASE])
    assert.equal(resultat.status, 2)
    assert.match(resultat.stderr, /jamais en argument/)
    assert.ok(!resultat.stderr.includes(PHRASE))
    assert.equal(existsSync(join(dehors, 'paquet.json')), false)
  })

  it('refuse deux saisies différentes', () => {
    const resultat = lancer([join(dehors, 'paquet.json')], `${PHRASE}\n${PHRASE}!\n`)
    assert.equal(resultat.status, 1)
    assert.equal(existsSync(join(dehors, 'paquet.json')), false)
  })

  it('écrit le paquet hors du dépôt et n’affiche que la clé publique', async () => {
    const sortie = join(dehors, 'sous-dossier', 'paquet.json')
    mkdirSync(join(dehors, 'sous-dossier'))
    const resultat = lancer([sortie], `${PHRASE}\n${PHRASE}\n`)
    assert.equal(resultat.status, 0, resultat.stderr)

    const clePublique = resultat.stdout.trim()
    assert.match(clePublique, /^[A-Za-z0-9+/]{43}=$/)
    assert.equal(resultat.stdout, `${clePublique}\n`)
    for (const flux of [resultat.stdout, resultat.stderr]) assert.ok(!flux.includes(PHRASE))

    assert.equal(statSync(sortie).mode & 0o777, 0o600)
    const texte = readFileSync(sortie, 'utf8')
    const paquet = JSON.parse(texte) as { publicKey: string }
    assert.equal(paquet.publicKey, clePublique)
    const cles = await unlockPrivateKey(paquet, PHRASE)
    const privee = Buffer.from(cles.privateKey)
    assert.ok(!texte.includes(privee.toString('base64')))
    assert.ok(!texte.includes(privee.toString('hex')))

    // Jamais d'écrasement : une clé perdue rendrait les demandes illisibles.
    const encore = lancer([sortie], `${PHRASE}\n${PHRASE}\n`)
    assert.equal(encore.status, 1)
    assert.equal(readFileSync(sortie, 'utf8'), texte)
  })

  it('ajoute le paquet d’une seconde personne : même clé publique, sa propre phrase', async () => {
    const premier = join(dehors, 'paquet-sady.json')
    const second = join(dehors, 'paquet-cat.json')
    const AUTRE = 'la phrase de la seconde personne, factice'
    assert.equal(lancer([premier], `${PHRASE}\n${PHRASE}\n`).status, 0)

    const resultat = lancer(['--ajouter', premier, second], `${PHRASE}\n${AUTRE}\n${AUTRE}\n`)
    assert.equal(resultat.status, 0, resultat.stderr)
    const paquet = JSON.parse(readFileSync(premier, 'utf8')) as { publicKey: string }
    assert.equal(resultat.stdout, `${paquet.publicKey}\n`)
    for (const flux of [resultat.stdout, resultat.stderr]) {
      assert.ok(!flux.includes(PHRASE) && !flux.includes(AUTRE))
    }
    assert.equal(statSync(second).mode & 0o777, 0o600)
    const sien = JSON.parse(readFileSync(second, 'utf8')) as unknown
    await assert.rejects(unlockPrivateKey(sien, PHRASE))
    const cles = await unlockPrivateKey(sien, AUTRE)
    assert.equal(Buffer.from(cles.publicKey).toString('base64'), paquet.publicKey)

    // Mauvaise phrase actuelle, sortie dans le dépôt : refus, rien d'écrit.
    const refus = join(dehors, 'paquet-refus.json')
    assert.equal(lancer(['--ajouter', premier, refus], `faux\n${AUTRE}\n${AUTRE}\n`).status, 1)
    assert.equal(existsSync(refus), false)
    const dedans = join(ROOT, 'paquet-refuse.json')
    assert.equal(
      lancer(['--ajouter', premier, dedans], `${PHRASE}\n${AUTRE}\n${AUTRE}\n`).status,
      1,
    )
    assert.equal(existsSync(dedans), false)
  })

  it('exige un chemin en .json : une phrase tapée à la place est refusée sans être répétée', () => {
    const resultat = lancer([PHRASE])
    assert.equal(resultat.status, 2)
    assert.match(resultat.stderr, /jamais en argument/)
    assert.ok(!resultat.stderr.includes(PHRASE))
  })
})
