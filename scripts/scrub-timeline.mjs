// node scripts/scrub-timeline.mjs <vidéo> [points=33] [part linéaire=0.35]
// Courbe « progression du défilement → temps » d'une vidéo pilotée par le défilement (ScrubVideo,
// prop `timeline`) : un même défilement montre à peu près autant de changement à l'image partout,
// au lieu de passer d'un coup sur les passages rapides du plan. Mesure : écart moyen d'une image à
// la suivante (192 × 108, niveaux de gris, via ffmpeg), lissé sur une seconde, mélangé à une part
// linéaire (pour garder la lenteur voulue des passages calmes), cumulé puis inversé. Sortie : les
// fractions de la durée à pas de progression réguliers (première 0, dernière 1). Aucune dépendance.
import { spawnSync } from 'node:child_process'

const [video, pointsArg = '33', linearArg = '0.35'] = process.argv.slice(2)
if (!video) {
  console.error('usage : node scripts/scrub-timeline.mjs <vidéo> [points] [part linéaire]')
  process.exit(2)
}
const points = Number(pointsArg)
const linear = Number(linearArg)
const W = 192
const H = 108

const probe = spawnSync(
  'ffprobe',
  [
    '-v',
    'error',
    '-select_streams',
    'v',
    '-show_entries',
    'stream=r_frame_rate',
    '-of',
    'csv=p=0',
    video,
  ],
  { encoding: 'utf8' },
)
const [num, den] = probe.stdout.trim().split('/').map(Number)
const fps = num / (den || 1)

const raw = spawnSync(
  'ffmpeg',
  [
    '-v',
    'error',
    '-i',
    video,
    '-vf',
    `scale=${W}:${H}:flags=area,format=gray`,
    '-f',
    'rawvideo',
    '-',
  ],
  { maxBuffer: 1 << 30 },
).stdout
const size = W * H
const count = Math.floor(raw.length / size)
if (count < 3) {
  console.error('vidéo illisible ou trop courte')
  process.exit(1)
}

// Écart d'une image à la suivante.
const diffs = []
for (let i = 1; i < count; i++) {
  let sum = 0
  for (let k = 0; k < size; k++) sum += Math.abs(raw[i * size + k] - raw[(i - 1) * size + k])
  diffs.push(sum / size)
}
// Lissage sur une seconde, puis mélange avec la vitesse moyenne.
const half = Math.max(1, Math.round(fps / 2))
const smooth = diffs.map((_, i) => {
  const from = Math.max(0, i - half)
  const to = Math.min(diffs.length, i + half + 1)
  let sum = 0
  for (let j = from; j < to; j++) sum += diffs[j]
  return sum / (to - from)
})
const mean = smooth.reduce((a, b) => a + b, 0) / smooth.length
const speed = smooth.map((s) => linear * mean + (1 - linear) * s)

// Progression cumulée à chaque image (0 → 1), puis temps (fraction de la durée) à pas réguliers.
const cumulative = [0]
for (const s of speed) cumulative.push(cumulative.at(-1) + s)
const total = cumulative.at(-1)
const timeline = []
for (let p = 0; p < points; p++) {
  const target = (p / (points - 1)) * total
  let i = 1
  while (i < cumulative.length - 1 && cumulative[i] < target) i++
  const span = cumulative[i] - cumulative[i - 1] || 1
  const frame = i - 1 + (target - cumulative[i - 1]) / span
  timeline.push(Math.round((frame / (count - 1)) * 1000) / 1000)
}
timeline[0] = 0
timeline[timeline.length - 1] = 1
console.log(JSON.stringify(timeline))
