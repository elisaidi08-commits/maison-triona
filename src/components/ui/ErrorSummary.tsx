import { ErrorSummaryFocus } from './ErrorSummaryFocus'

// Résumé d'erreurs en tête d'étape (maquette Figma 110:7, docs/architecture.md §6.1) : filet
// terracotta 2 px à gauche, titre qui dit combien d'erreurs, un lien par champ fautif, dans
// l'ordre des champs. Le résumé reçoit le focus quand il apparaît (`focusOnMount`) et le lecteur
// d'écran le lit en entier (`role="alert"`, comme le résumé d'erreurs de GOV.UK). Un lien place
// le focus sur son champ, label visible (ErrorSummaryFocus) ; sans JavaScript, l'ancre y mène.
// Les messages viennent de messages/*.json et commencent par « Erreur : » (jamais la couleur seule).

export type FieldError = {
  // Ancre du champ : `#id` de l'input, ou de la première option d'un ChoiceRow (choiceInputId).
  href: string
  message: string
}

type ErrorSummaryProps = {
  id: string
  title: string
  errors: FieldError[]
  focusOnMount?: boolean
}

export function ErrorSummary({ id, title, errors, focusOnMount = false }: ErrorSummaryProps) {
  if (errors.length === 0) return null

  return (
    <div id={id} tabIndex={-1} className="border-l-2 border-terracotta py-8 pl-24">
      <div role="alert" className="flex flex-col gap-12">
        <h2 id={`${id}-titre`} className="text-title-h3 text-encre">
          {title}
        </h2>
        <ul className="flex flex-col">
          {errors.map((error) => (
            <li key={error.href}>
              <a
                href={error.href}
                className="inline-flex min-h-touch items-center text-body text-sapin underline decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:text-cypres"
              >
                {error.message}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <ErrorSummaryFocus summaryId={id} focusOnMount={focusOnMount} />
    </div>
  )
}
