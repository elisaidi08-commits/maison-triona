// Projection de la carte des Territoires (story 1.7, src/lib/carte-territoires.ts) : Lambert
// azimutale équivalente européenne (EPSG:3035, ellipsoïde GRS80, centre 52° N 10° E), puis le cadre
// de scripts/carte-territoires.mjs (carré de 1 400 km depuis (3083542, 1898387), viewBox de 1 000
// unités, y vers le bas). Sert à placer des lieux sur la carte ; vérifiée sur Monaco (1,4 unité du
// repère calculé par mapshaper).

const RAD = Math.PI / 180
const A = 6378137
const APLATISSEMENT = 1 / 298.257222101
const E2 = 2 * APLATISSEMENT - APLATISSEMENT * APLATISSEMENT
const E = Math.sqrt(E2)
const PHI0 = 52 * RAD
const LAMBDA0 = 10 * RAD
const FAUX_EST = 4321000
const FAUX_NORD = 3210000
const CADRE = { xmin: 3083542, ymin: 1898387, taille: 1400000, cote: 1000 }

const q = (phi: number) => {
  const s = Math.sin(phi)
  return (1 - E2) * (s / (1 - E2 * s * s) - (1 / (2 * E)) * Math.log((1 - E * s) / (1 + E * s)))
}
const QP = q(Math.PI / 2)
const BETA0 = Math.asin(q(PHI0) / QP)
const RQ = A * Math.sqrt(QP / 2)
const D = (A * Math.cos(PHI0)) / (Math.sqrt(1 - E2 * Math.sin(PHI0) ** 2) * RQ * Math.cos(BETA0))

/** Longitude et latitude (degrés) → coordonnées dans le viewBox de la carte des Territoires. */
export function versCarte(lon: number, lat: number): [number, number] {
  const beta = Math.asin(q(lat * RAD) / QP)
  const ecart = lon * RAD - LAMBDA0
  const b =
    RQ *
    Math.sqrt(
      2 /
        (1 + Math.sin(BETA0) * Math.sin(beta) + Math.cos(BETA0) * Math.cos(beta) * Math.cos(ecart)),
    )
  const est = FAUX_EST + b * D * Math.cos(beta) * Math.sin(ecart)
  const nord =
    FAUX_NORD +
    (b / D) *
      (Math.cos(BETA0) * Math.sin(beta) - Math.sin(BETA0) * Math.cos(beta) * Math.cos(ecart))
  const echelle = CADRE.cote / CADRE.taille
  return [(est - CADRE.xmin) * echelle, (CADRE.ymin + CADRE.taille - nord) * echelle]
}
