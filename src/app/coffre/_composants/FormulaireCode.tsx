'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorSummary } from '@/components/ui/ErrorSummary'
import { TextField } from '@/components/ui/TextField'

import { verifierCode } from '../actions'
import type { EtatCode } from '../actions'

// Second facteur : code de l'application d'authentification, ou code de secours (chacun ne sert
// qu'une fois). Fonctionne sans JavaScript ; `<details>` s'ouvre sans script.

const INITIAL: EtatCode = { erreur: null, mode: 'totp' }

const MESSAGES: Record<NonNullable<EtatCode['erreur']>, string> = {
  saisie: 'Erreur : saisissez le code.',
  code: 'Erreur : ce code n’est pas valable. Vérifiez l’heure de votre téléphone, puis réessayez.',
  expire: 'Erreur : la connexion a expiré. Reprenez depuis le mot de passe.',
  verrouille: 'Erreur : trop de codes erronés. Le compte est verrouillé pour un quart d’heure.',
  'trop-de-tentatives': 'Erreur : trop de tentatives. Réessayez dans un quart d’heure.',
  indisponible: 'Erreur : la vérification n’a pas abouti. Réessayez dans un instant.',
}

export function FormulaireCode() {
  const [etat, envoyer, enCours] = useActionState(verifierCode, INITIAL)
  const champ = etat.mode === 'secours' ? 'code-secours' : 'code'
  const lien =
    etat.erreur === 'expire' || etat.erreur === 'verrouille' ? '/coffre/connexion' : `#${champ}`
  const pending = enCours ? 'Vérification en cours' : undefined

  return (
    <div className="flex max-w-measure flex-col gap-48">
      {etat.erreur ? (
        <ErrorSummary
          id="erreurs-code"
          title="La vérification n’a pas abouti"
          errors={[{ href: lien, message: MESSAGES[etat.erreur] }]}
          focusOnMount
        />
      ) : null}

      <form action={envoyer} className="flex flex-col gap-32">
        <input type="hidden" name="mode" value="totp" />
        <TextField
          id="code"
          name="code"
          label="Code à six chiffres"
          hint="Le code affiché par votre application d’authentification."
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          maxLength={12}
          required
        />
        <div>
          <Button type="submit" pending={etat.mode === 'totp' ? pending : undefined}>
            Vérifier le code
          </Button>
        </div>
      </form>

      <details open={etat.mode === 'secours'} className="flex flex-col gap-24">
        <summary className="inline-flex min-h-touch cursor-pointer items-center text-body text-sapin underline decoration-or decoration-1 underline-offset-8">
          Utiliser un code de secours
        </summary>
        <form action={envoyer} className="flex flex-col gap-32 pt-24">
          <input type="hidden" name="mode" value="secours" />
          <TextField
            id="code-secours"
            name="code"
            label="Code de secours"
            hint="Un des codes notés à l’enrôlement. Chacun ne sert qu’une fois."
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={32}
            required
          />
          <div>
            <Button type="submit" pending={etat.mode === 'secours' ? pending : undefined}>
              Vérifier le code de secours
            </Button>
          </div>
        </form>
      </details>
    </div>
  )
}
