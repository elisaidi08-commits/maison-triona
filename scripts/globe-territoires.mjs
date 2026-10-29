// Globe des Territoires (D55) : terres en points, contours, les cinq pays de la maison et leurs
// repères, en longitude et latitude, calculés une fois et figés dans src/lib/globe-territoires.ts.
// Lancé à la main, jamais au build ni en CI :
//   node scripts/globe-territoires.mjs
// Sources : Natural Earth (domaine public), archives vérifiées par leur empreinte : terres au
// 1:110 000 000 (points et contours), pays au 1:10 000 000 (les cinq pays, comme la carte au trait).
// Outil : mapshaper à version figée, appelé par npx (rien dans package.json, rien au navigateur).
// Encodage : entiers 16 bits (centièmes de degré), petit-boutiste, en base64 : le navigateur ne
// télécharge rien, il décode quelques dizaines de kilo-octets embarqués dans la page.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ROOT } from './lib/walk.mjs'

const SOURCES = {
  terres: {
    url: 'https://naciscdn.org/naturalearth/110m/physical/ne_110m_land.zip',
    sha256: '1926c621afd6ac67c3f36639bb1236134a48d82226dc675d3e3df53d02d2a3de',
    version: '4.1.0',
    shp: 'ne_110m_land.shp',
  },
  pays: {
    url: 'https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip',
    sha256: 'ce1ac7036499a0edd641fbc093cd209a98f96a49d2eca8480aaacad35138a7f6',
    version: '5.1.1',
    shp: 'ne_10m_admin_0_countries.shp',
  },
}
const MAPSHAPER = 'mapshaper@0.7.72'
const PAYS = ['BE', 'FR', 'LU', 'MC', 'CH']
// Écart entre deux points des terres, en degrés de latitude ; en longitude, l'écart grandit vers
// les pôles pour garder des points également espacés sur la sphère.
const PAS = 1.5
// Part des sommets gardés : contours du monde (globe entier, environ 600 px), puis les cinq pays et
// leurs voisins assez fins pour les vues rapprochées (Monaco et Luxembourg remplissent la vue).
const SIMPLIFICATION_TERRES = '60%'
const SIMPLIFICATION_PAYS = '15%'
const SIMPLIFICATION_VOISINS = '8%'
// Europe de l'Ouest autour des cinq pays (degrés) : voisins tracés dans les vues rapprochées.
const EUROPE = '-15,34,30,62'

const travail = join(tmpdir(), 'maison-triona-globe')
mkdirSync(travail, { recursive: true })

for (const source of Object.values(SOURCES)) {
  const archive = join(travail, source.url.split('/').at(-1))
  if (!existsSync(archive)) {
    console.log(`Téléchargement de ${source.url}`)
    const reponse = await fetch(source.url)
    if (!reponse.ok) throw new Error(`Téléchargement refusé : ${reponse.status}`)
    writeFileSync(archive, Buffer.from(await reponse.arrayBuffer()))
  }
  const empreinte = createHash('sha256').update(readFileSync(archive)).digest('hex')
  if (empreinte !== source.sha256) {
    throw new Error(`Empreinte inattendue (${empreinte}) : archive modifiée, rien n'est écrit.`)
  }
  execFileSync('unzip', ['-o', '-q', archive, '-d', travail])
}

const mapshaper = (...args) =>
  execFileSync('npx', ['--yes', MAPSHAPER, ...args], { stdio: ['ignore', 'ignore', 'inherit'] })

const terresBrutes = join(travail, 'terres.json')
mapshaper('-i', join(travail, SOURCES.terres.shp), '-o', 'format=geojson', terresBrutes)
const terresSimplifiees = join(travail, 'terres-simplifiees.json')
mapshaper(
  '-i', join(travail, SOURCES.terres.shp),
  '-simplify', SIMPLIFICATION_TERRES, 'keep-shapes',
  '-o', 'format=geojson', terresSimplifiees,
) // prettier-ignore
const paysContours = join(travail, 'pays.json')
mapshaper(
  '-i', join(travail, SOURCES.pays.shp),
  '-filter-fields', 'ISO_A2_EH',
  '-filter', `${JSON.stringify(PAYS)}.indexOf(ISO_A2_EH) > -1`,
  '-clip', 'bbox=-12,38,20,56',
  '-simplify', SIMPLIFICATION_PAYS, 'keep-shapes',
  '-o', 'format=geojson', paysContours,
) // prettier-ignore
const voisinsContours = join(travail, 'voisins.json')
mapshaper(
  '-i', join(travail, SOURCES.pays.shp),
  '-filter-fields', 'ISO_A2_EH',
  '-filter', `${JSON.stringify(PAYS)}.indexOf(ISO_A2_EH) === -1`,
  '-clip', `bbox=${EUROPE}`,
  '-simplify', SIMPLIFICATION_VOISINS, 'keep-shapes',
  '-o', 'format=geojson', voisinsContours,
) // prettier-ignore
const paysPoints = join(travail, 'reperes.json')
mapshaper(
  '-i', join(travail, SOURCES.pays.shp),
  '-filter-fields', 'ISO_A2_EH',
  '-filter', `${JSON.stringify(PAYS)}.indexOf(ISO_A2_EH) > -1`,
  '-clip', 'bbox=-12,38,20,56',
  '-points', 'inner',
  '-o', 'format=geojson', paysPoints,
) // prettier-ignore

const lire = (fichier) => JSON.parse(readFileSync(fichier, 'utf8')).features
const polygones = (feature) => {
  const { type, coordinates } = feature.geometry ?? {}
  if (type === 'Polygon') return [coordinates]
  if (type === 'MultiPolygon') return coordinates
  return []
}

// Points des terres : grille de pas constant sur la sphère, gardée si le point tombe dans une terre.
const dansAnneau = ([x, y], anneau) => {
  let dedans = false
  for (let i = 0, j = anneau.length - 1; i < anneau.length; j = i++) {
    const [xi, yi] = anneau[i]
    const [xj, yj] = anneau[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dedans = !dedans
  }
  return dedans
}
const terres = lire(terresBrutes)
  .flatMap(polygones)
  .map((anneaux) => {
    const xs = anneaux[0].map((p) => p[0])
    const ys = anneaux[0].map((p) => p[1])
    return { anneaux, boite: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }
  })
const surTerre = (point) =>
  terres.some(
    ({ anneaux, boite: [x0, y0, x1, y1] }) =>
      point[0] >= x0 &&
      point[0] <= x1 &&
      point[1] >= y0 &&
      point[1] <= y1 &&
      dansAnneau(point, anneaux[0]) &&
      !anneaux.slice(1).some((trou) => dansAnneau(point, trou)),
  )
const points = []
for (let lat = -90 + PAS / 2; lat < 90; lat += PAS) {
  const pasLon = PAS / Math.max(Math.cos((lat * Math.PI) / 180), 0.05)
  for (let lon = -180 + pasLon / 2; lon < 180; lon += pasLon) {
    if (surTerre([lon, lat])) points.push([lon, lat])
  }
}

// Encodage : centièmes de degré, entiers 16 bits petit-boutistes, base64.
const encoder = (paires) => {
  const tampon = Buffer.alloc(paires.length * 4)
  paires.forEach(([lon, lat], i) => {
    tampon.writeInt16LE(Math.round(lon * 100), i * 4)
    tampon.writeInt16LE(Math.round(lat * 100), i * 4 + 2)
  })
  return tampon.toString('base64')
}
const anneauxDe = (features) => features.flatMap(polygones).flat()
const contours = anneauxDe(lire(terresSimplifiees))
const pays = lire(paysContours).map((feature) => {
  const anneaux = polygones(feature).flat()
  return {
    code: feature.properties.ISO_A2_EH,
    anneaux: encoder(anneaux.flat()),
    longueurs: anneaux.map((anneau) => anneau.length),
  }
})
const arrondi = (n) => Math.round(n * 100) / 100
const reperes = Object.fromEntries(
  lire(paysPoints).map((feature) => [
    feature.properties.ISO_A2_EH,
    feature.geometry.coordinates.map(arrondi),
  ]),
)
const voisins = anneauxDe(lire(voisinsContours))
const tous = Object.values(reperes)
const centre = [0, 1].map((axe) => arrondi(tous.reduce((s, p) => s + p[axe], 0) / tous.length))

const date = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())
const donnees = {
  terres: encoder(points),
  contours: encoder(contours.flat()),
  contoursLongueurs: contours.map((anneau) => anneau.length),
  pays,
  voisins: encoder(voisins.flat()),
  voisinsLongueurs: voisins.map((anneau) => anneau.length),
  reperes,
  centre,
}
const fichier = `// Fichier généré par scripts/globe-territoires.mjs le ${date} : ne pas modifier à la main.
// Provenance : Natural Earth (domaine public, « Made with Natural Earth ») : terres ${SOURCES.terres.version} au
// 1:110 000 000 (SHA-256 ${SOURCES.terres.sha256}) ; pays ${SOURCES.pays.version} au
// 1:10 000 000 (SHA-256 ${SOURCES.pays.sha256}). Adresses dans le script : aucune URL externe
// dans src/ (check:third-party).
// Traitement : ${MAPSHAPER} ; ${points.length} points des terres (pas de ${PAS}°), contours simplifiés à
// ${SIMPLIFICATION_TERRES}, cinq pays à ${SIMPLIFICATION_PAYS}, voisins d'Europe de l'Ouest (${EUROPE}) à ${SIMPLIFICATION_VOISINS}.
// Encodage : paires (longitude, latitude) en centièmes de degré, entiers 16 bits petit-boutistes, base64.
// Aucune ville, adresse ni partenaire ; aucune image générée par IA.

export type CodePaysGlobe = ${PAYS.map((code) => `'${code}'`).join(' | ')}

export const GLOBE = ${JSON.stringify(donnees, null, 2)} as const
`
writeFileSync(join(ROOT, 'src/lib/globe-territoires.ts'), fichier)
console.log(
  `src/lib/globe-territoires.ts : ${points.length} points, ${contours.length} contours, ` +
    `${pays.length} pays, ${voisins.length} anneaux voisins, ${(fichier.length / 1024).toFixed(1)} ko`,
)
