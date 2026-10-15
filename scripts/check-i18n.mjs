// check:i18n — échoue si une clé de messages existe dans une langue et pas dans l'autre,
// ou si une valeur est vide. Champs du CMS : contrôlés en story 4.2.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT } from './lib/walk.mjs'

const LOCALES = ['fr', 'en']
const dir = join(ROOT, 'messages')

if (!existsSync(dir)) {
  console.log('check:i18n : pas encore de dossier messages/ (créé en story 1.4), rien à comparer.')
  process.exit(0)
}

/** Aplatit { a: { b: 'x' } } en Map { 'a.b' => 'x' }. */
function flatten(value, prefix = '', out = new Map()) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out)
    }
  } else {
    out.set(prefix, value)
  }
  return out
}

const catalogs = new Map()
const problems = []
for (const locale of LOCALES) {
  const file = join(dir, `${locale}.json`)
  if (!existsSync(file)) {
    problems.push(`messages/${locale}.json manquant`)
    continue
  }
  catalogs.set(locale, flatten(JSON.parse(readFileSync(file, 'utf8'))))
}

for (const [locale, keys] of catalogs) {
  for (const [key, value] of keys) {
    if (typeof value === 'string' && value.trim() === '')
      problems.push(`${locale} : « ${key} » est vide`)
    for (const other of LOCALES) {
      if (other !== locale && catalogs.has(other) && !catalogs.get(other).has(key)) {
        problems.push(`« ${key} » existe en ${locale} mais pas en ${other}`)
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`check:i18n : ${problems.length} écart(s) entre les langues.`)
  for (const problem of problems) console.error(`  ${problem}`)
  process.exit(1)
}
console.log(`check:i18n : parité FR/EN respectée (${catalogs.get('fr')?.size ?? 0} clés).`)
