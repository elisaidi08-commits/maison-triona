// Champ souligné (docs/art-direction.md §7.7) : label au-dessus, ligne encre 68 % de 1 px (5,3:1) ;
// erreur = ligne encre pleine de 2 px (13,14:1, deux fois plus épaisse) + message « Erreur : … » en
// encre au-dessus du champ : l'erreur ne repose jamais sur la seule couleur (WCAG 1.4.1, 1.4.11).
// Terracotta, hors kit, retiré par D64.
// `multiline` : zone de texte (« Un mot libre »), encadrée d'un filet pour qu'on voie où écrire,
// redimensionnable en hauteur seulement. `defaultValue` : valeur conservée après une erreur
// serveur (WCAG 3.3.7, aucune ressaisie). `maxLength` : limite native, annoncée dans l'aide.
// `password`, `inputMode`, `autoCapitalize`, `spellCheck` : formulaires du coffre (story 3.2 C),
// mot de passe et codes du second facteur.

type TextFieldProps = {
  id: string
  name: string
  label: string
  type?: 'text' | 'email' | 'tel' | 'password'
  autoComplete?: string
  inputMode?: 'numeric' | 'text'
  autoCapitalize?: 'off' | 'none'
  spellCheck?: boolean
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
  inputMode,
  autoCapitalize,
  spellCheck,
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
    inputMode,
    autoCapitalize,
    spellCheck,
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
        // En erreur, le cadre reste ; seul le bord bas devient la ligne d'erreur des champs.
        <textarea
          {...common}
          rows={rows}
          className={`w-full resize-y rounded-none border border-encre-68 bg-transparent p-16 text-body text-encre ${
            error ? 'border-b-2 border-b-encre' : ''
          }`}
        />
      ) : (
        <input
          {...common}
          type={type}
          className={`min-h-touch w-full rounded-none border-0 bg-transparent px-0 py-8 text-body text-encre ${
            error ? 'border-b-2 border-encre' : 'border-b border-encre-68'
          }`}
        />
      )}
    </div>
  )
}
