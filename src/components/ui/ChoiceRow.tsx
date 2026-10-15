// Choix en lignes du formulaire (docs/architecture.md §6.1, wireframe A) : un `fieldset` et sa
// `legend`, une ligne de 56 px par option, filets or entre les lignes, comme la liste d'entrée de
// l'accueil. Toute la ligne est le label : on clique n'importe où. Contrôles natifs (radio ou case),
// teintés sapin : flèches et espace au clavier, mode contrastes forcés et usage sans JavaScript
// gratuits. L'option choisie garde son filet or sous le libellé (en plus de la pastille cochée).
// Erreur : filet terracotta 2 px à gauche du groupe et message en encre (jamais la couleur seule).

export type ChoiceOption = {
  value: string
  label: string
  category?: string
  note?: string
}

type ChoiceRowProps = {
  id: string
  name: string
  legend: string
  options: ChoiceOption[]
  type?: 'radio' | 'checkbox'
  defaultValue?: string | string[]
  required?: boolean
  hint?: string
  error?: string
  // Trois colonnes à partir de 768 px (pays : BE · FR · LU · MC · CH · Ailleurs).
  columns?: 1 | 3
}

// Identifiant de l'input d'une option : cible des liens du résumé d'erreurs (la première option).
export function choiceInputId(groupId: string, value: string) {
  return `${groupId}-${value}`
}

export function ChoiceRow({
  id,
  name,
  legend,
  options,
  type = 'radio',
  defaultValue,
  required = false,
  hint,
  error,
  columns = 1,
}: ChoiceRowProps) {
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined
  const checked = new Set(
    defaultValue === undefined ? [] : Array.isArray(defaultValue) ? defaultValue : [defaultValue],
  )

  return (
    <fieldset id={id} aria-describedby={describedBy} className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-16 p-0 text-title-h3 text-sapin">{legend}</legend>
      {hint ? (
        <p id={`${id}-hint`} className="mb-16 text-body-s text-encre">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mb-16 text-body-s text-encre">
          {error}
        </p>
      ) : null}
      <div
        className={`border-t border-or ${columns === 3 ? 'md:grid md:grid-cols-3' : ''} ${
          error ? 'border-l-2 border-l-terracotta pl-16' : ''
        }`}
      >
        {options.map((option) => {
          const inputId = choiceInputId(id, option.value)
          return (
            <div key={option.value} className="border-b border-or">
              <label
                htmlFor={inputId}
                className={`group flex min-h-touch-lg cursor-pointer items-start gap-24 py-16 ${
                  columns === 3 ? 'md:pr-24' : ''
                }`}
              >
                <input
                  id={inputId}
                  type={type}
                  name={name}
                  value={option.value}
                  defaultChecked={checked.has(option.value)}
                  // Pour un groupe radio, `required` sur chaque option rend le groupe requis.
                  required={type === 'radio' ? required : undefined}
                  aria-invalid={error ? true : undefined}
                  className="mt-4 size-24 shrink-0 cursor-pointer accent-sapin"
                />
                {/* 12 px entre libellé et catégorie : le filet de l'option choisie (6 px sous le
                    libellé) ne touche pas les capitales. */}
                <span className="flex flex-col gap-12">
                  <span className="filet-survol self-start text-choix text-encre">
                    {option.label}
                  </span>
                  {option.category ? (
                    <span className="text-label text-encre uppercase">{option.category}</span>
                  ) : null}
                  {option.note ? <span className="text-body text-encre">{option.note}</span> : null}
                </span>
              </label>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
