import QRCode from 'qrcode'

// QR code d'enrôlement du TOTP (story 3.2, partie D ; D68). Produit sur le serveur, dans la Server
// Action d'enrôlement, à partir de l'URI `otpauth` que Better Auth vient de rendre : un SVG en
// texte, affiché en ligne sur /coffre/enrolement à côté du secret en clair. Aucun service externe,
// aucun script côté navigateur, aucun fichier écrit. Dépendance `qrcode` (docs/architecture.md §1),
// moteur de rendu SVG seulement (ni PNG, ni canvas, ni terminal).
// Le SVG est contrôlé avant d'être rendu : une balise `<svg>` et deux tracés, rien d'autre (il est
// inséré tel quel dans la page). Les erreurs ne citent jamais l'URI : elle contient le secret.
// Imports relatifs seulement : testé par node --test.

// Couleurs du kit (tokens.css : --color-encre sur --color-ivoire, 13,9:1), recopiées parce que
// `qrcode` n'accepte que des valeurs hexadécimales ; un test vérifie qu'elles suivent tokens.css.
export const COULEURS_QR = { fonce: '#2a241f', clair: '#f3ede1' } as const
// 240 px : lisible par un téléphone à bout de bras, tient dans 390 px avec les marges.
export const TAILLE_QR = 240

const SVG_ATTENDU =
  /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+" viewBox="0 0 \d+ \d+" shape-rendering="crispEdges"><path fill="#[0-9a-f]{6}" d="M0 0h\d+v\d+H0z"\/><path stroke="#[0-9a-f]{6}" d="[Mmh0-9. ]+"\/><\/svg>$/

// Le SVG d'un QR code tel que `qrcode` le produit ici, et rien d'autre : une balise `<svg>` (taille,
// viewBox), un fond et un tracé (chiffres et commandes M, m, h). Appliqué à la production et à tout
// SVG qui revient du navigateur (état précédent de l'enrôlement, src/app/coffre/actions.ts) avant
// d'être inséré tel quel dans la page.
export function estSvgQrValide(svg: unknown): svg is string {
  return typeof svg === 'string' && svg.length <= 64 * 1024 && SVG_ATTENDU.test(svg)
}

export class QrCodeError extends Error {
  constructor() {
    super('QR code d’enrôlement impossible à produire')
    this.name = 'QrCodeError'
  }
}

export async function qrCodeSvg(uri: string): Promise<string> {
  if (!uri.startsWith('otpauth://totp/')) throw new QrCodeError()
  let svg: string
  try {
    svg = await QRCode.toString(uri, {
      type: 'svg',
      // Niveau M (15 % de redondance) : un QR court pour une URI de 120 caractères environ.
      errorCorrectionLevel: 'M',
      // Zone de silence de 4 modules, celle de la norme (ISO/IEC 18004).
      margin: 4,
      width: TAILLE_QR,
      color: { dark: COULEURS_QR.fonce, light: COULEURS_QR.clair },
    })
  } catch {
    throw new QrCodeError()
  }
  svg = svg.trim()
  if (!estSvgQrValide(svg)) throw new QrCodeError()
  return svg
}
