// Sceau L1-D, logo de Maison Triona (D53) : anneau, T et sillage, retracés par potrace depuis la
// génération Recraft (brand/sources/L1-D-trace.svg). Produit, sans retoucher le dessin :
// - src/components/brand/sceau-paths.ts : géométrie pour les composants du site (couleur par jetons) ;
// - brand/kit/sceau-d-*.svg et brand/kit/png/sceau-d-*.png (2 048 px, sur fond et transparents) ;
// - src/app/icon.svg, src/app/apple-icon.png (180 px) et public/brand/og.png (1 200 × 630).
// Rendu et mesure du dessin par Chromium (Playwright, déjà en dépendance de développement).
// Usage : node scripts/kit-sceau.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const SOURCE = 'brand/sources/L1-D-trace.svg'
const COULEURS = { sapin: '#26382F', champagne: '#C6A96B', ivoire: '#F3EDE1' }

const source = readFileSync(SOURCE, 'utf8')
const transform = source
  .match(/<g transform="([^"]+)"/)[1]
  .replace(/translate\(([\d.]+),([\d.]+)\)/, (_, x, y) => `translate(${+x} ${+y})`)
  .replace(/scale\(([\d.]+),(-?[\d.]+)\)/, (_, x, y) => `scale(${+x} ${+y})`)
const paths = [...source.matchAll(/<path d="([^"]+)"/g)].map((m) =>
  m[1].replace(/\s+/g, ' ').trim(),
)

const browser = await chromium.launch()
const page = await browser.newPage()

// Cadre carré autour du dessin, 2 % de marge : le sceau remplit sa boîte.
const brut = `<svg id="s" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4096 4096"><g transform="${transform}">${paths.map((d) => `<path d="${d}"/>`).join('')}</g></svg>`
await page.setContent(brut)
const [x1, y1, x2, y2] = await page.evaluate(() => {
  const svg = document.getElementById('s')
  const g = svg.querySelector('g')
  const b = g.getBBox()
  const versSvg = (x, y) =>
    Object.assign(svg.createSVGPoint(), { x, y })
      .matrixTransform(g.getScreenCTM())
      .matrixTransform(svg.getScreenCTM().inverse())
  const a = versSvg(b.x, b.y)
  const c = versSvg(b.x + b.width, b.y + b.height)
  return [Math.min(a.x, c.x), Math.min(a.y, c.y), Math.max(a.x, c.x), Math.max(a.y, c.y)]
})
const cote = Math.max(x2 - x1, y2 - y1)
const marge = cote * 0.02
const r = (v) => Math.round(v * 10) / 10
const viewBox = [
  x1 - (cote - (x2 - x1)) / 2 - marge,
  y1 - (cote - (y2 - y1)) / 2 - marge,
  cote + 2 * marge,
  cote + 2 * marge,
]
  .map(r)
  .join(' ')

const dessin = (couleur) =>
  `<g fill="${couleur}" transform="${transform}">${paths.map((d) => `<path d="${d}"/>`).join('')}</g>`
const sceau = (couleur, fond) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img"><title>Maison Triona</title>` +
  (fond
    ? `<rect x="${viewBox.split(' ')[0]}" y="${viewBox.split(' ')[1]}" width="${r(cote + 2 * marge)}" height="${r(cote + 2 * marge)}" fill="${fond}"/>`
    : '') +
  `${dessin(couleur)}</svg>`

// Composants du site
writeFileSync(
  'src/components/brand/sceau-paths.ts',
  '// Généré par scripts/kit-sceau.mjs (D53) : ne pas modifier à la main.\n' +
    '// Sceau L1-D (anneau, T, sillage), retracé par potrace depuis la génération Recraft.\n' +
    `export const SCEAU = ${JSON.stringify({ viewBox, transform, paths }, null, 2)} as const\n`,
)

// Kit : SVG transparents
const kit = { 'sceau-d-or': COULEURS.champagne, 'sceau-d-sapin': COULEURS.sapin }
const fondDe = { 'sceau-d-or': COULEURS.sapin, 'sceau-d-sapin': COULEURS.ivoire }
for (const [nom, couleur] of Object.entries(kit))
  writeFileSync(`brand/kit/${nom}.svg`, sceau(couleur))

// Rendu PNG d'un contenu SVG (fond transparent possible) à une taille donnée.
const png = async (fichier, largeur, hauteur, contenu) => {
  await page.setViewportSize({ width: largeur, height: hauteur })
  await page.setContent(
    `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${contenu}`,
  )
  await page.screenshot({ path: fichier, omitBackground: true })
}
const carre = (taille, couleur, fond, part = 1) => {
  const interieur = taille * part
  const decalage = (taille - interieur) / 2
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}">` +
    (fond ? `<rect width="${taille}" height="${taille}" fill="${fond}"/>` : '') +
    `<svg x="${decalage}" y="${decalage}" width="${interieur}" height="${interieur}" viewBox="${viewBox}">${dessin(couleur)}</svg></svg>`
  )
}
for (const [nom, couleur] of Object.entries(kit)) {
  await png(`brand/kit/png/${nom}-transparent.png`, 2048, 2048, carre(2048, couleur, null, 0.9))
  await png(`brand/kit/png/${nom}-fond.png`, 2048, 2048, carre(2048, couleur, fondDe[nom], 0.7))
}

// Site : favicon (sapin, sceau champagne à 84 %), icône Apple, image de partage.
writeFileSync(
  'src/app/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img"><title>Maison Triona</title><rect width="64" height="64" fill="${COULEURS.sapin}"/><svg x="5" y="5" width="54" height="54" viewBox="${viewBox}">${dessin(COULEURS.champagne)}</svg></svg>\n`,
)
await png('src/app/apple-icon.png', 180, 180, carre(180, COULEURS.champagne, COULEURS.sapin, 0.72))
await png(
  'public/brand/og.png',
  1200,
  630,
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="${COULEURS.sapin}"/><svg x="440" y="155" width="320" height="320" viewBox="${viewBox}">${dessin(COULEURS.champagne)}</svg></svg>`,
)

await browser.close()
console.log(`viewBox ${viewBox} · ${paths.length} tracés`)
