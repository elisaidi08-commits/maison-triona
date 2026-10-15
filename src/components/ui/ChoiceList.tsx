// Liste d'entrée par besoin (docs/art-direction.md §7.2) : vrais liens, filet or entre les lignes,
// numéro en cyprès aligné sur la première ligne, libellé Manrope Medium, catégorie en label capitales.
// Survol et focus : le libellé se souligne d'un filet or (tracé animé en story 2.4, mouvement M4).
// Aucune icône, aucune flèche. Le choix sans numéro est une porte de sortie, moins appuyée :
// libellé plus petit et phrase de conversation en corps de texte.

export type Choice = {
  href: string
  label: string
  number?: string
  category?: string
  note?: string
}

export function ChoiceList({ choices }: { choices: Choice[] }) {
  return (
    <ul className="border-t border-or">
      {choices.map((choice) => (
        <li key={choice.href + choice.label} className="border-b border-or">
          <a
            href={choice.href}
            className="group flex min-h-touch-lg items-baseline gap-24 py-16 text-encre"
          >
            <span aria-hidden="true" className="w-32 shrink-0 text-label text-cypres">
              {choice.number}
            </span>
            <span className="flex flex-col gap-4">
              <span
                className={`${choice.number ? 'text-title-h3' : 'text-body-l font-medium'} decoration-or decoration-1 underline-offset-8 group-hover:underline group-focus-visible:underline`}
              >
                {choice.label}
              </span>
              {choice.category ? (
                <span className="text-label text-encre uppercase">{choice.category}</span>
              ) : null}
              {choice.note ? <span className="text-body text-encre">{choice.note}</span> : null}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}
