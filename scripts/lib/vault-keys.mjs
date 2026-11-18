// Garde-fous du script de génération des clés du coffre (scripts/vault-keys.mjs, story 3.2 B).
// Le paquet de la clé privée ne doit jamais être écrit dans le dépôt : ni à la racine, ni dans un
// sous-dossier, ni au bout d'un lien symbolique qui y mène. Aucune dépendance.
import { existsSync, realpathSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

/** Refus lisible, sans secret : le script l'affiche tel quel. */
export class OutputPathError extends Error {
  constructor(message) {
    super(message)
    this.name = 'OutputPathError'
  }
}

// Chemin réel d'un fichier qui n'existe pas encore : son plus proche parent existant, liens
// symboliques résolus, suivi du reste du chemin.
function realTarget(path) {
  let existing = resolve(path)
  const rest = []
  while (!existsSync(existing)) {
    const parent = dirname(existing)
    if (parent === existing) break
    rest.unshift(basename(existing))
    existing = parent
  }
  return join(realpathSync.native(existing), ...rest)
}

/**
 * Vrai si `target` est `root` ou se trouve dessous. Comparaison par appareil et inode, en remontant
 * le chemin réel : ni la casse (disque du Mac insensible à la casse) ni un lien ne trompent le test.
 */
export function isInsideDirectory(target, root) {
  const rootStat = statSync(root)
  let current = realTarget(target)
  for (;;) {
    if (existsSync(current)) {
      const stat = statSync(current)
      if (stat.dev === rootStat.dev && stat.ino === rootStat.ino) return true
    }
    const parent = dirname(current)
    if (parent === current) return false
    current = parent
  }
}

/** Chemin absolu du paquet à écrire, ou refus : dans le dépôt, déjà existant, dossier absent. */
export function checkOutputPath(target, root) {
  if (typeof target !== 'string' || target.trim() === '') {
    throw new OutputPathError('Chemin du paquet manquant.')
  }
  const absolute = resolve(target)
  if (isInsideDirectory(absolute, root)) {
    throw new OutputPathError(
      'Refusé : le paquet de la clé privée doit être écrit hors du dépôt (clé USB, coffre chiffré).',
    )
  }
  if (existsSync(absolute)) {
    throw new OutputPathError(
      'Refusé : ce fichier existe déjà. Un paquet n’est jamais écrasé (docs/coffre-cles.md).',
    )
  }
  const parent = dirname(absolute)
  if (!existsSync(parent) || !statSync(parent).isDirectory()) {
    throw new OutputPathError('Refusé : le dossier de destination n’existe pas.')
  }
  return absolute
}
