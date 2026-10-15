// Parcours de fichiers partagé par les scripts de contrôle (aucune dépendance).
import { readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// fileURLToPath décode les espaces du chemin (le dossier du projet finit par une espace).
export const ROOT = fileURLToPath(new URL('../../', import.meta.url))

export const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.json',
  '.html',
  '.svg',
  '.txt',
  '.xml',
  '.webmanifest',
  '.md',
])

/** Liste récursive des fichiers texte sous `dir` (chemin relatif à la racine), sans node_modules. */
export function listTextFiles(dir, extensions = TEXT_EXTENSIONS) {
  const start = join(ROOT, dir)
  const out = []
  const visit = (path) => {
    let stats
    try {
      stats = statSync(path)
    } catch {
      return
    }
    if (stats.isDirectory()) {
      for (const name of readdirSync(path)) {
        if (name === 'node_modules' || name === '.DS_Store') continue
        visit(join(path, name))
      }
    } else if (extensions.has(extname(path))) {
      out.push(path)
    }
  }
  visit(start)
  return out
}

export const rel = (path) => relative(ROOT, path)
