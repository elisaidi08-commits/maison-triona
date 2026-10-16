// Champ souligné (docs/art-direction.md §7.7) : label au-dessus, ligne encre 68 %,
// erreur = ligne terracotta 2 px + message en encre (la couleur n'est jamais le seul signal).
// `multiline` : zone de texte (« Un mot libre »), encadrée d'un filet pour qu'on voie où écrire,
// redimensionnable en hauteur seulement. `defaultValue` : valeur conservée après une erreur
// serveur (WCAG 3.3.7, aucune ressaisie). `maxLength` : limite native, annoncée dans l'aide.

type TextFieldProps = {
  id: string
  name: string
  label: string
  type?: 'text' | 'email' | 'tel'
  autoComplete?: string
  required?: boolean
  hint?: string
  error?: string
  defaultValue?: string
  maxLength?: number
  multiline?: boolean
  rows?: number
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
  defaultValue,
  maxLength,
  multiline = false,
  rows = 6,
}: TextFieldProps) {
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') ||
    undefined

  const common = {
    id,
    name,
    autoComplete,
    required,
    defaultValue,
    maxLength,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
  }

  return (
    <div className="flex flex-col gap-8">
      <label htmlFor={id} className="text-label text-encre uppercase">
        {label}
      </label>
      {/* Aide et erreur avant le champ : on les lit avant d'écrire (« Inutile de nous donner des
          détails médicaux ») et le message reste visible au-dessus du clavier sur mobile. */}
      {hint ? (
        <p id={`${id}-hint`} className="text-body-s text-encre">
          {hint}
        </p>
      ) : null}
      {/* Le message d'erreur, le texte le plus utile à ce moment-là, en corps 18 px. */}
      {error ? (
        <p id={`${id}-error`} className="text-body text-encre">
          {error}
        </p>
      ) : null}
      {multiline ? (
        // En erreur, le cadre reste ; seul le bord bas devient la ligne terracotta des champs.
        <textarea
          {...common}
          rows={rows}
          className={`w-full resize-y rounded-none border border-encre-68 bg-transparent p-16 text-body text-encre ${
            error ? 'border-b-2 border-b-terracotta' : ''
          }`}
        />
      ) : (
        <input
          {...common}
          type={type}
          className={`min-h-touch w-full rounded-none border-0 bg-transparent px-0 py-8 text-body text-encre ${
            error ? 'border-b-2 border-terracotta' : 'border-b border-encre-68'
          }`}
        />
      )}
    </div>
  )
}
