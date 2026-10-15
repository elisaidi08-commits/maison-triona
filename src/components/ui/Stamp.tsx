// Cachet « K. » : serif display Regular, point or (champagne sur sapin). Décoratif (aria-hidden).
// Tailles : sm 24 px (fin du hero), md 48 px (pied de page), lg 64 px (confirmation).

const SIZES = {
  sm: 'text-stamp-sm',
  md: 'text-stamp-md',
  lg: 'text-stamp-lg',
} as const

type StampProps = {
  size?: keyof typeof SIZES
  onDark?: boolean
}

export function Stamp({ size = 'sm', onDark = false }: StampProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block font-display font-normal ${SIZES[size]} ${onDark ? 'text-ivoire' : 'text-sapin'}`}
    >
      K<span className={onDark ? 'text-champagne' : 'text-or'}>.</span>
    </span>
  )
}
