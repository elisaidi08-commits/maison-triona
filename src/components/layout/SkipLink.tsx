// Lien d'évitement : premier élément focalisable, visible au focus (WCAG 2.4.1).

export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#contenu"
      className="sr-only z-30 bg-ivoire px-16 py-12 text-nav text-sapin focus:not-sr-only focus:fixed focus:top-16 focus:left-16"
    >
      {label}
    </a>
  )
}
