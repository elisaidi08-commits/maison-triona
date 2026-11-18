import type { ReactNode } from 'react'

// Case à cocher seule (consentement du formulaire, story 3.1) : une ligne de 56 px au moins, toute
// cliquable, sans filet (ce n'est pas un choix dans une liste). Case native teintée sapin
// (clavier, contrastes forcés et usage sans JavaScript gratuits), libellé en corps de texte. Même
// grammaire d'erreur que ChoiceRow : message « Erreur : » en encre au-dessus, filet encre 2 px à
// gauche (jamais la couleur seule). L'aide (lien vers la politique de confidentialité) suit la case,
// hors du libellé : un lien dans un label se cliquerait à la place de la case.

type CheckboxFieldProps = {
  id: string
  name: string
  label: string
  value?: string
  required?: boolean
  defaultChecked?: boolean
  error?: string
  hint?: ReactNode
}

export function CheckboxField({
  id,
  name,
  label,
  value = 'oui',
  required = false,
  defaultChecked = false,
  error,
  hint,
}: CheckboxFieldProps) {
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') ||
    undefined

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p id={`${id}-error`} className="text-body text-encre">
          {error}
        </p>
      ) : null}
      <div className={error ? 'border-l-2 border-encre pl-16' : ''}>
        <label htmlFor={id} className="flex min-h-touch-lg cursor-pointer items-start gap-24 py-16">
          <input
            id={id}
            type="checkbox"
            name={name}
            value={value}
            required={required}
            defaultChecked={defaultChecked}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className="mt-4 size-24 shrink-0 cursor-pointer accent-sapin"
          />
          <span className="text-body text-encre">{label}</span>
        </label>
      </div>
      {hint ? (
        <div id={`${id}-hint`} className="text-body-s text-encre">
          {hint}
        </div>
      ) : null}
    </div>
  )
}
