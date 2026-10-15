// Wordmark « Maison Triona » (docs/art-direction.md §7.1) : serif display Regular, sapin.
// Le logo « le sillage » n'existe pas encore : un emplacement de 28 × 28 px est réservé à sa place
// pour qu'il arrive sans décaler la mise en page. Remplacer le <span> vide par le SVG du logo.

type WordmarkProps = {
  href: string
  label: string
}

export function Wordmark({ href, label }: WordmarkProps) {
  return (
    <a
      href={href}
      aria-label={label}
      className="inline-flex min-h-touch items-center gap-12 font-display text-title-h3 font-normal text-sapin"
    >
      <span aria-hidden="true" className="block size-logo shrink-0" />
      <span aria-hidden="true">Maison Triona</span>
    </a>
  )
}
