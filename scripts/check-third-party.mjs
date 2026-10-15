// check:third-party — échoue si une ressource externe ou une référence au moodboard apparaît
// dans ce qui est publié (CLAUDE.md § Discrétion).
// 1. Sources (src/, public/, messages/) : toute URL absolue hors liste blanche.
// 2. HTML produit par le build : tout attribut src, href, srcset, action ou poster qui sort du domaine.
// Le JavaScript compilé n'est pas lu : il contient des URL de documentation (messages d'erreur de
// React et Next) qui ne déclenchent aucune requête. Le test E2E vérifie les requêtes réelles.
import { readFileSync } from 'node:fs'
import { listTextFiles, rel } from './lib/walk.mjs'

const siteOrigin = (() => {
  try {
    return new URL(process.env.SITE_URL ?? 'http://localhost:3000').origin
  } catch {
    return 'http://localhost:3000'
  }
})()

// Chaînes qui ressemblent à des URL sans provoquer de requête (espaces de noms, vocabulaires).
const ALLOWED_PREFIXES = [
  siteOrigin,
  'http://localhost',
  'http://www.w3.org/',
  'https://www.w3.org/',
  'https://schema.org',
]

const MOODBOARD = [/cosmos_/i, /docs\/moodboard/i, /MOODBOARD/, /ASSETS PHOTO MAQUETTE/i]

const findings = []
const isAllowed = (url) => ALLOWED_PREFIXES.some((prefix) => url.startsWith(prefix))

function scan(file, urlPattern) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, index) => {
    const where = `${rel(file)}:${index + 1}`
    for (const match of line.matchAll(urlPattern)) {
      const url = match[1] ?? match[0]
      if (!isAllowed(url)) findings.push(`${where}  ressource externe : ${url}`)
    }
    for (const pattern of MOODBOARD) {
      if (pattern.test(line)) findings.push(`${where}  référence au moodboard : ${pattern}`)
    }
  })
}

// 1. Sources publiées
const ABSOLUTE_URL = /(?:https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}[^\s'"`)<>]*/gi
const sources = [...listTextFiles('src'), ...listTextFiles('public'), ...listTextFiles('messages')]
for (const file of sources) scan(file, ABSOLUTE_URL)

// 2. HTML produit (après `npm run build`)
const ATTRIBUTE_URL = /\b(?:src|href|srcset|action|poster)=["']((?:https?:)?\/\/[^"'\s,]+)/gi
const html = listTextFiles('.next/server/app', new Set(['.html']))
for (const file of html) scan(file, ATTRIBUTE_URL)

if (findings.length > 0) {
  console.error(`check:third-party : ${findings.length} problème(s).`)
  for (const finding of findings) console.error(`  ${finding}`)
  process.exit(1)
}
const note =
  html.length === 0 ? ' Aucun HTML produit : lancer `npm run build` pour un contrôle complet.' : ''
console.log(
  `check:third-party : rien d'externe ni de moodboard (${sources.length} sources, ${html.length} pages HTML).${note}`,
)
