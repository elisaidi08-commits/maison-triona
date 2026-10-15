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

type ChoiceListProps = {
  choices: Choice[]
  // En ligne à partir de 1024 px (seuil de l'accueil, D19) : 4 colonnes, filets or verticaux.
  rowOnDesktop?: boolean
}

export function ChoiceList({ choices, rowOnDesktop = false }: ChoiceListProps) {
  return (
    <ul
      className={`border-t border-or ${rowOnDesktop ? 'lg:grid lg:grid-cols-4 lg:border-b' : ''}`}
    >
      {choices.map((choice) => (
        <li
          key={choice.href + choice.label}
          className={`border-b border-or ${rowOnDesktop ? 'lg:border-b-0 lg:border-l lg:first:border-l-0' : ''}`}
        >
          <a
            href={choice.href}
            className={`group flex min-h-touch-lg items-baseline gap-24 py-16 text-encre ${
              rowOnDesktop ? 'lg:h-full lg:flex-col lg:gap-12 lg:px-24 lg:py-24' : ''
            }`}
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
