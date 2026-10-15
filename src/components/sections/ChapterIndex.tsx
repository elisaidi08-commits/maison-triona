// Sommaire de La Maison (D26) : six lignes en vrais liens vers les ancres des chapitres, numéro
// cyprès et titre, filets or entre les lignes, comme la liste d'entrée. Le chapitre en cours
// garde son filet or et porte `aria-current="location"` (suivi au défilement au lot 3). En mobile,
// il ouvre la page et sert de menu. Sans JavaScript, les ancres fonctionnent seules.

export type ChapterLink = {
  href: string
  number: string
  title: string
}

type ChapterIndexProps = {
  // Nom du repère de navigation, fourni par messages/*.json (« Sommaire », « Contents »).
  label: string
  chapters: ChapterLink[]
  currentHref?: string
}

export function ChapterIndex({ label, chapters, currentHref }: ChapterIndexProps) {
  return (
    <nav aria-label={label}>
      <ol className="border-t border-or">
        {chapters.map((chapter) => {
          const current = chapter.href === currentHref
          return (
            <li key={chapter.number} className="border-b border-or">
              <a
                href={chapter.href}
                aria-current={current ? 'location' : undefined}
                className="group flex min-h-touch items-baseline gap-24 py-12 text-encre"
              >
                <span aria-hidden="true" className="w-32 shrink-0 text-label text-cypres">
                  {chapter.number}
                </span>
                <span className={`filet-survol text-nav ${current ? 'text-sapin' : ''}`}>
                  {chapter.title}
                </span>
              </a>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
