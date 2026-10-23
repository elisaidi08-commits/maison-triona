// Liste d'entrée par besoin (docs/art-direction.md §7.2) : vrais liens, filet or entre les lignes,
// numéro en cyprès aligné sur la première ligne, libellé Manrope Medium 20-22 px, catégorie en
// label capitales. Survol et focus : un filet or se dessine sous le libellé (mouvement M4).
// Aucune icône, aucune flèche. Le choix sans numéro est une porte de sortie, moins appuyée :
// libellé en graisse normale et phrase de conversation en corps de texte.

export type Choice = {
  href: string
  label: string
  number?: string
  category?: string
  note?: string
}

type ChoiceListProps = {
  choices: Choice[]
  // En ligne à partir de 1024 px (seuil de l'accueil, D19) : 4 colonnes, filets or verticaux,
  // la première colonne sur la marge.
  rowOnDesktop?: boolean
}

export function ChoiceList({ choices, rowOnDesktop = false }: ChoiceListProps) {
  return (
    <ul
      className={`border-t border-or ${rowOnDesktop ? 'lg:grid lg:grid-cols-4 lg:border-b' : ''}`}
    >
      {choices.map((choice, index) => (
        <li
          key={choice.href + choice.label}
          className={`border-b border-or ${rowOnDesktop ? 'lg:border-b-0 lg:border-l lg:first:border-l-0' : ''}`}
        >
          <a
            href={choice.href}
            className={`group flex min-h-touch-lg items-baseline gap-24 py-16 text-encre ${
              rowOnDesktop
                ? `lg:h-full lg:flex-col lg:gap-8 lg:px-24 lg:py-16 ${index === 0 ? 'lg:pl-0' : ''}`
                : ''
            }`}
          >
            {/* Sans numéro, la ligne garde sa place : les libellés partagent la même ligne de base. */}
            <span aria-hidden="true" className="w-32 shrink-0 text-label text-cypres">
              {choice.number ?? ' '}
            </span>
            <span className="flex flex-col gap-4">
              <span
                className={`filet-survol self-start text-choix ${choice.number ? '' : 'font-normal'}`}
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
