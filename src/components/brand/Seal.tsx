import { SCEAU } from './sceau-paths'

// Sceau L1-D, logo de Maison Triona (D53) : le T en sillage dans un anneau fin, seul dans l'en-tête,
// au pied de page et dans le menu. Sapin sur ivoire, champagne sur sapin. Décoratif (aria-hidden) :
// le lien qui l'entoure porte le nom accessible. Tailles : md 48 px (en-tête, menu), lg 64 px (pied
// de page) ; lisible dès 16 px (favicon). Géométrie générée par scripts/kit-sceau.mjs.

const SIZES = {
  md: 'size-48',
  lg: 'size-64',
} as const

type SealProps = {
  size?: keyof typeof SIZES
  onDark?: boolean
}

export function Seal({ size = 'md', onDark = false }: SealProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={SCEAU.viewBox}
      className={`block shrink-0 ${SIZES[size]} ${onDark ? 'fill-champagne' : 'fill-sapin'}`}
    >
      <g transform={SCEAU.transform}>
        {SCEAU.paths.map((d, index) => (
          <path key={index} d={d} />
        ))}
      </g>
    </svg>
  )
}
