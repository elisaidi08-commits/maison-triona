// check:content — échoue s'il reste un contenu provisoire dans ce qui sera publié
// (règle d'or n° 2 de CLAUDE.md). À lancer avant toute mise en production.
// Contenus du CMS : branchés en story 4.2.
import { readFileSync } from 'node:fs'
import { listTextFiles, rel } from './lib/walk.mjs'

const MARKERS = [
  '[CONTENU À FOURNIR PAR CAT]',
  '[À VALIDER',
  '[À CONFIRMER',
  '[À TRANCHER',
  '[À DÉFINIR',
  '[SI VRAI]',
  '[BROUILLON',
  '[TO BE CONFIRMED]',
  '[CONTENT TO BE PROVIDED',
  '[DRAFT',
]

// Sources publiées + HTML produit par le build (s'il existe).
const files = [
  ...listTextFiles('src'),
  ...listTextFiles('messages'),
  ...listTextFiles('public'),
  ...listTextFiles('.next/server/app', new Set(['.html', '.rsc'])),
]

const findings = []
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    for (const marker of MARKERS) {
      if (line.includes(marker)) findings.push(`${rel(file)}:${index + 1}  ${marker}`)
    }
  })
}

// Brouillons balisés hors de l'interface : content/brouillons.json liste les clés non validées.
try {
  const drafts = JSON.parse(
    readFileSync(new URL('../content/brouillons.json', import.meta.url), 'utf8'),
  )
  for (const locale of ['fr', 'en']) {
    for (const key of drafts[locale] ?? [])
      findings.push(`messages/${locale}.json  brouillon : ${key}`)
  }
} catch {
  // Pas de registre de brouillons : rien à signaler.
}

if (findings.length > 0) {
  console.error(
    `check:content : ${findings.length} contenu(s) provisoire(s) à remplacer avant publication.`,
  )
  for (const finding of findings) console.error(`  ${finding}`)
  process.exit(1)
}
console.log(`check:content : aucun contenu provisoire (${files.length} fichiers lus).`)
