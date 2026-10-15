// Champ souligné (docs/art-direction.md §7.7) : label au-dessus, ligne encre 68 %,
// erreur = ligne terracotta 2 px + message en encre (la couleur n'est jamais le seul signal).

type TextFieldProps = {
  id: string
  name: string
  label: string
  type?: 'text' | 'email' | 'tel'
  autoComplete?: string
  required?: boolean
  hint?: string
  error?: string
}

export function TextField({
  id,
  name,
  label,
  type = 'text',
  autoComplete,
  required = false,
  hint,
  error,
}: TextFieldProps) {
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined

  return (
    <div className="flex flex-col gap-8">
      <label htmlFor={id} className="text-label text-encre uppercase">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-touch w-full rounded-none border-0 bg-transparent px-0 py-8 text-body text-encre ${
          error ? 'border-b-2 border-terracotta' : 'border-b border-encre-68'
        }`}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-body-s text-encre">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-body-s text-encre">
          {error}
        </p>
      ) : null}
    </div>
  )
}
