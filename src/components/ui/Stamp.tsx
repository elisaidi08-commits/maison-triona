// Cachet « K. » : serif display, point or (champagne sur sapin). Décoratif (aria-hidden).
// Tailles : sm 24 px (fin du hero) et md 48 px (pied de page), Regular, validées avec l'accueil V4.
// lg (confirmation) : Light comme le h1, 48 px sous 1024 px et 64 px dès 1024 px.

const SIZES = {
  sm: 'font-normal text-stamp-sm',
  md: 'font-normal text-stamp-md',
  lg: 'font-light text-stamp-md lg:text-stamp-lg',
} as const

type StampProps = {
  size?: keyof typeof SIZES
  onDark?: boolean
}

export function Stamp({ size = 'sm', onDark = false }: StampProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block font-display ${SIZES[size]} ${onDark ? 'text-ivoire' : 'text-sapin'}`}
    >
      K<span className={onDark ? 'text-champagne' : 'text-or'}>.</span>
    </span>
  )
}
