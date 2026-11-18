'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorSummary } from '@/components/ui/ErrorSummary'
import { TextField } from '@/components/ui/TextField'

import { enrolerTotp } from '../actions'
import type { EtatEnrolement } from '../actions'

// Enrôlement du TOTP (obligatoire) : mot de passe, puis secret à saisir dans l'application
// d'authentification, codes de secours, et premier code qui ouvre le coffre. Pas de QR code (aucune
// dépendance ajoutée) : le secret se saisit à la main, ou l'adresse otpauth se colle.

const INITIAL: EtatEnrolement = { etape: 'mot-de-passe', erreur: null }

const MESSAGES = {
  saisie: 'Erreur : ce champ est à remplir.',
  'mot-de-passe': 'Erreur : mot de passe incorrect.',
  code: 'Erreur : ce code n’est pas valable. Vérifiez l’heure de votre téléphone, puis réessayez.',
  'trop-de-tentatives': 'Erreur : trop de tentatives. Réessayez dans un quart d’heure.',
  indisponible: 'Erreur : l’enrôlement n’a pas abouti. Réessayez dans un instant.',
} as const

// Secret base32 de l'URI, groupé par quatre pour se lire et se taper sans erreur.
function secretLisible(uri: string): string | null {
  try {
    const secret = new URL(uri).searchParams.get('secret')
    return secret ? (secret.match(/.{1,4}/g) ?? []).join(' ') : null
  } catch {
    return null
  }
}

export function FormulaireEnrolement() {
  const [etat, envoyer, enCours] = useActionState(enrolerTotp, INITIAL)
  const pending = enCours ? 'Un instant' : undefined

  if (etat.etape === 'mot-de-passe') {
    return (
      <form action={envoyer} className="flex max-w-measure flex-col gap-32">
        {etat.erreur ? (
          <ErrorSummary
            id="erreurs-enrolement"
            title="L’enrôlement n’a pas abouti"
            errors={[{ href: '#mot-de-passe', message: MESSAGES[etat.erreur] }]}
            focusOnMount
          />
        ) : null}
        <input type="hidden" name="etape" value="mot-de-passe" />
        <TextField
          id="mot-de-passe"
          name="mot-de-passe"
          label="Mot de passe"
          hint="Chaque affichage crée un nouveau secret, qui remplace le précédent."
          type="password"
          autoComplete="current-password"
          required
        />
        <div>
          <Button type="submit" pending={pending}>
            Afficher le secret
          </Button>
        </div>
      </form>
    )
  }

  const secret = etat.uri ? secretLisible(etat.uri) : null

  return (
    <div className="flex max-w-measure flex-col gap-48">
      {etat.erreur ? (
        <ErrorSummary
          id="erreurs-enrolement"
          title="L’enrôlement n’a pas abouti"
          errors={[{ href: '#code', message: MESSAGES[etat.erreur] }]}
          focusOnMount
        />
      ) : null}

      {etat.uri && secret ? (
        <section aria-labelledby="secret-titre" className="flex flex-col gap-16">
          <h2 id="secret-titre" className="text-title-h3 text-encre">
            1. Enregistrez le secret
          </h2>
          <p>
            Dans votre application d’authentification, ajoutez un compte « Maison Triona » et
            saisissez ce secret, en mode « basé sur le temps » :
          </p>
          <p className="text-body-l break-all text-sapin">
            <code>{secret}</code>
          </p>
          <p className="text-body-s">Ou collez cette adresse, si l’application l’accepte :</p>
          <p className="text-body-s break-all">
            <code>{etat.uri}</code>
          </p>
        </section>
      ) : (
        <form action={envoyer} className="flex flex-col gap-16">
          <p>
            Le secret n’est plus affiché. Saisissez ci-dessous le code de votre application, ou
            recommencez : un nouveau secret remplacera le précédent.
          </p>
          <input type="hidden" name="etape" value="recommencer" />
          <div>
            <Button type="submit" variant="discret">
              Recommencer l’enrôlement
            </Button>
          </div>
        </form>
      )}

      {etat.codesSecours.length > 0 ? (
        <section aria-labelledby="secours-titre" className="flex flex-col gap-16">
          <h2 id="secours-titre" className="text-title-h3 text-encre">
            2. Notez les codes de secours
          </h2>
          <p>
            Ils remplacent l’application si vous la perdez. Chacun ne sert qu’une fois. Gardez-les
            hors ligne, à part du mot de passe : ils ne seront plus affichés.
          </p>
          <ul className="flex flex-col gap-4">
            {etat.codesSecours.map((code) => (
              <li key={code}>
                <code>{code}</code>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form action={envoyer} className="flex flex-col gap-32">
        <h2 className="text-title-h3 text-encre">3. Confirmez avec un premier code</h2>
        <input type="hidden" name="etape" value="code" />
        <TextField
          id="code"
          name="code"
          label="Code à six chiffres"
          inputMode="numeric"
          autoComplete="one-time-code"
          spellCheck={false}
          maxLength={12}
          required
        />
        <div>
          <Button type="submit" pending={pending}>
            Confirmer et ouvrir le coffre
          </Button>
        </div>
      </form>
    </div>
  )
}
