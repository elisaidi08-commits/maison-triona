// Carte des Territoires (story 1.7, D26) : tracé au trait de l'Europe de l'Ouest, calculé une fois
// et figé dans src/lib/carte-territoires.ts. Lancé à la main, jamais au build ni en CI :
//   node scripts/carte-territoires.mjs
// Source : Natural Earth, pays au 1:10 000 000 (domaine public), archive vérifiée par son empreinte.
// Outil : mapshaper à version figée, appelé par npx (rien dans package.json, rien au navigateur).
// Projection : Lambert azimutale équivalente européenne (EPSG:3035).
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ROOT } from './lib/walk.mjs'

const SOURCE = {
  url: 'https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip',
  sha256: 'ce1ac7036499a0edd641fbc093cd209a98f96a49d2eca8480aaacad35138a7f6',
  version: '5.1.1',
}
// Version publiée depuis plus de deux semaines au moment du choix (16/10/2026).
const MAPSHAPER = 'mapshaper@0.7.72'

// Les cinq pays de la maison ; Monaco, trop petit à cette échelle, n'est qu'un point.
const PAYS = ['BE', 'FR', 'LU', 'MC', 'CH']
// Cadre carré en mètres EPSG:3035 : les cinq pays (≈ 1 150 km de côté) et 12 % d'air autour.
const CADRE = { xmin: 3083542, ymin: 1898387, taille: 1400000 }
// Découpe 60 km au-delà du cadre : les bords créés par la découpe tombent hors du viewBox et ne
// dessinent pas de faux trait le long de la carte.
const DEBORD = 60000
const COTE = 1000 // unités du viewBox
// Part des sommets gardés : assez pour des côtes souples à 640 px, bien sous les 60 ko.
const SIMPLIFICATION = '20%'

const travail = join(tmpdir(), 'maison-triona-carte')
mkdirSync(travail, { recursive: true })
const archive = join(travail, 'ne_10m_admin_0_countries.zip')

if (!existsSync(archive)) {
  console.log(`Téléchargement de ${SOURCE.url}`)
  const reponse = await fetch(SOURCE.url)
  if (!reponse.ok) throw new Error(`Téléchargement refusé : ${reponse.status}`)
  writeFileSync(archive, Buffer.from(await reponse.arrayBuffer()))
}
const empreinte = createHash('sha256').update(readFileSync(archive)).digest('hex')
if (empreinte !== SOURCE.sha256) {
  throw new Error(`Empreinte inattendue (${empreinte}) : archive modifiée, rien n'est écrit.`)
}

execFileSync('unzip', ['-o', '-q', archive, '-d', travail])
const shp = join(travail, 'ne_10m_admin_0_countries.shp')
const bbox = [
  CADRE.xmin - DEBORD,
  CADRE.ymin - DEBORD,
  CADRE.xmin + CADRE.taille + DEBORD,
  CADRE.ymin + CADRE.taille + DEBORD,
].join(',')
const mapshaper = (...args) =>
  execFileSync('npx', ['--yes', MAPSHAPER, ...args], { stdio: ['ignore', 'ignore', 'inherit'] })

// Contours : découpe large en degrés (écarte l'outre-mer), projection, découpe au cadre, simplification.
const contours = join(travail, 'contours.json')
mapshaper(
  '-i', shp,
  '-filter-fields', 'ISO_A2_EH',
  '-clip', 'bbox=-12,38,20,56',
  '-proj', 'EPSG:3035',
  '-clip', `bbox=${bbox}`,
  '-filter', 'ISO_A2_EH !== "MC"',
  '-simplify', SIMPLIFICATION, 'keep-shapes',
  '-o', 'format=geojson', contours,
) // prettier-ignore

// Points : un par pays de la maison, au point le plus intérieur de son territoire.
const points = join(travail, 'points.json')
mapshaper(
  '-i', shp,
  '-filter-fields', 'ISO_A2_EH',
  '-filter', `${JSON.stringify(PAYS)}.indexOf(ISO_A2_EH) > -1`,
  '-clip', 'bbox=-12,38,20,56',
  '-proj', 'EPSG:3035',
  '-points', 'inner',
  '-o', 'format=geojson', points,
) // prettier-ignore

const echelle = COTE / CADRE.taille
const vers = ([x, y]) => [(x - CADRE.xmin) * echelle, (CADRE.ymin + CADRE.taille - y) * echelle]
const arrondi = (n) => Math.round(n * 10) / 10

/** Anneau → « M x y l dx dy … z », en coordonnées relatives arrondies au dixième. */
function chemin(anneau) {
  let precedent = null
  let d = ''
  for (const point of anneau) {
    const [x, y] = vers(point).map(arrondi)
    if (!precedent) d += `M${x} ${y}l`
    else {
      const dx = arrondi(x - precedent[0])
      const dy = arrondi(y - precedent[1])
      if (dx === 0 && dy === 0) continue
      d += `${dx} ${dy} `
    }
    precedent = [x, y]
  }
  return `${d.trim()}z`
}

const formes = JSON.parse(readFileSync(contours, 'utf8')).features.flatMap((feature) => {
  const { type, coordinates } = feature.geometry ?? {}
  if (!type) return []
  const polygones = type === 'Polygon' ? [coordinates] : coordinates
  return [
    {
      code: feature.properties.ISO_A2_EH,
      d: polygones.flatMap((anneaux) => anneaux.map(chemin)).join(''),
    },
  ]
})

const reperes = Object.fromEntries(
  JSON.parse(readFileSync(points, 'utf8')).features.map((feature) => [
    feature.properties.ISO_A2_EH,
    vers(feature.geometry.coordinates).map(Math.round),
  ]),
)

const maison = formes.filter((forme) => PAYS.includes(forme.code))
const voisins = formes.filter((forme) => !PAYS.includes(forme.code))
const date = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())

const fichier = `// Fichier généré par scripts/carte-territoires.mjs le ${date} : ne pas modifier à la main.
// Provenance : Natural Earth ${SOURCE.version}, Admin 0 Countries au 1:10 000 000 (domaine public,
// « Made with Natural Earth »), archive SHA-256 ${SOURCE.sha256} (adresse dans le script : aucune
// URL externe dans src/, check:third-party).
// Traitement : ${MAPSHAPER}, projection EPSG:3035, découpe ${bbox} (m), viewBox =
// carré de ${CADRE.taille / 1000} km depuis (${CADRE.xmin}, ${CADRE.ymin}), simplification ${SIMPLIFICATION}.
// Aucune ville, adresse ni partenaire ; aucune image générée par IA (D26).

export type CodePays = ${PAYS.map((code) => `'${code}'`).join(' | ')}

export const CARTE_VIEWBOX = '0 0 ${COTE} ${COTE}'

// Les cinq pays de la maison (Monaco : point seul).
export const PAYS_MAISON: { code: CodePays; d: string }[] = ${JSON.stringify(maison, null, 2)}

// Pays voisins, découpés au cadre.
export const PAYS_VOISINS: { code: string; d: string }[] = ${JSON.stringify(voisins, null, 2)}

// Point de chaque pays de la maison, en unités du viewBox.
export const REPERES: Record<CodePays, [number, number]> = ${JSON.stringify(reperes, null, 2)}
`

const cible = join(ROOT, 'src', 'lib', 'carte-territoires.ts')
writeFileSync(cible, fichier)
// Mise au format du dépôt, sinon format:check échoue en CI.
execFileSync('npx', ['prettier', '--write', cible], { cwd: ROOT, stdio: 'ignore' })

// Aperçu hors dépôt, pour juger le tracé avant de figer (ivoire, sauge, sapin, or).
const apercu = join(travail, 'apercu.svg')
writeFileSync(
  apercu,
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COTE} ${COTE}" width="${COTE}" height="${COTE}">
<rect width="100%" height="100%" fill="#f4ede0"/>
${voisins.map((f) => `<path d="${f.d}" fill="none" stroke="#9aae8f" stroke-width="1"/>`).join('\n')}
${maison.map((f) => `<path d="${f.d}" fill="none" stroke="#1c3b2a" stroke-width="1.5"/>`).join('\n')}
${Object.values(reperes)
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#b8944d"/>`)
  .join('\n')}
</svg>`,
)
console.log(`Aperçu : ${apercu}`)
console.log(
  `Écrit ${cible} : ${maison.length} pays de la maison, ${voisins.length} voisins, ${Buffer.byteLength(fichier)} octets.`,
)
