import { LOGO } from './logo-paths'

// Sceau (D49) : le T de l'en-tête dans un anneau fin, une seule famille avec le logo. Sapin sur
// ivoire, champagne sur sapin. Décoratif (aria-hidden). Tailles : md 48 px (minimum), lg 64 px.

const SIZES = {
  md: 'size-48',
  lg: 'size-64',
} as const

type SealProps = {
  size?: keyof typeof SIZES
  onDark?: boolean
}

export function Seal({ size = 'md', onDark = false }: SealProps) {
  const fill = onDark ? 'fill-champagne' : 'fill-sapin'
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1000 1000"
      className={`block shrink-0 ${SIZES[size]}`}
    >
      <path className={fill} fillRule="evenodd" d={LOGO.seal.ring} />
      <path
        className={fill}
        transform={`translate(${LOGO.seal.markX} ${LOGO.seal.markY}) scale(${LOGO.seal.markScale})`}
        d={LOGO.mark}
      />
    </svg>
  )
}
