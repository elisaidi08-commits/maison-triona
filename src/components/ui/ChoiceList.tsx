// Liste d'entrée par besoin (docs/art-direction.md §7.2) : vrais liens, filet or entre les lignes,
// numéro en cyprès aligné sur la première ligne, libellé Inter Medium 19-20 px (D76), catégorie en
// label capitales. Survol et focus : un filet or se dessine sous le libellé (mouvement M4).
// Aucune icône, aucune flèche. Le choix sans numéro est une porte de sortie, moins appuyée :
// libellé en graisse normale et phrase de conversation en corps de texte.
// Un lien vers une autre page passe par la navigation interne de Next.js (D37) ; une ancre de la
// même page reste un lien simple, pour que le focus suive le saut (M12, AnchorFocus).

import Link from 'next/link'
import type { ReactNode } from 'react'

export type Choice = {
  href: string
  label: string
  number?: string
  category?: string
  note?: string
  // Besoin présélectionné dans le formulaire de contact (D26, story 3.4) : `data-besoin`.
  besoin?: string
  // Événement de la mesure d'audience (story 5.2, liste fermée de src/lib/mesure/evenements.ts).
  mesure?: string
}

type ChoiceListProps = {
  choices: Choice[]
  // En ligne à partir de 1024 px (seuil de l'accueil, D19) : 4 colonnes, filets or verticaux,
  // la première colonne sur la marge.
  rowOnDesktop?: boolean
}

function ChoiceLink({
  href,
  besoin,
  mesure,
  className,
  children,
}: {
  href: string
  besoin?: string
  mesure?: string
  className: string
  children: ReactNode
}) {
  return href.startsWith('#') ? (
    <a href={href} data-besoin={besoin} data-mesure={mesure} className={className}>
      {children}
    </a>
  ) : (
    <Link href={href} data-besoin={besoin} data-mesure={mesure} className={className}>
      {children}
    </Link>
  )
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
          <ChoiceLink
            href={choice.href}
            besoin={choice.besoin}
            mesure={choice.mesure}
            className={`group flex min-h-touch-lg items-baseline gap-24 py-16 text-encre ${
              rowOnDesktop
                ? `lg:h-full lg:flex-col lg:gap-8 lg:px-24 lg:py-16 ${index === 0 ? 'lg:pl-0' : ''}`
                : ''
            }`}
          >
            {/* Sans numéro, la ligne garde sa place : les libellés partagent la même ligne de base. */}
            <span aria-hidden="true" className="w-32 shrink-0 text-label text-sapin">
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
          </ChoiceLink>
        </li>
      ))}
    </ul>
  )
}
