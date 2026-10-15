// Aplat de remplacement tant que le visuel de la scène n'est pas généré (lot 2 de la piste B).
// Jamais une image du moodboard (docs/plan-implementation.md §1). Remplit son conteneur.

export function MediaPlaceholder({ tone = 'pierre' }: { tone?: 'pierre' | 'sapin' }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-0 block ${tone === 'sapin' ? 'bg-sapin' : 'bg-pierre'}`}
    />
  )
}
