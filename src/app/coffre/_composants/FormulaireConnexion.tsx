'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorSummary } from '@/components/ui/ErrorSummary'
import { TextField } from '@/components/ui/TextField'

import { seConnecter } from '../actions'
import type { EtatConnexion } from '../actions'

// Connexion au coffre : adresse et mot de passe. Fonctionne sans JavaScript (POST natif).
// Les erreurs ne disent jamais lequel des deux était faux.

const INITIAL: EtatConnexion = { erreur: null, email: '' }

const MESSAGES: Record<NonNullable<EtatConnexion['erreur']>, string> = {
  saisie: 'Erreur : saisissez votre adresse e-mail et votre mot de passe.',
  identifiants: 'Erreur : adresse e-mail ou mot de passe incorrect.',
  'trop-de-tentatives': 'Erreur : trop de tentatives. Réessayez dans un quart d’heure.',
  indisponible: 'Erreur : la connexion n’a pas abouti. Réessayez dans un instant.',
}

export function FormulaireConnexion() {
  const [etat, envoyer, enCours] = useActionState(seConnecter, INITIAL)

  return (
    <form action={envoyer} className="flex max-w-measure flex-col gap-32">
      {etat.erreur ? (
        <ErrorSummary
          id="erreurs-connexion"
          title="La connexion n’a pas abouti"
          errors={[{ href: '#email', message: MESSAGES[etat.erreur] }]}
          focusOnMount
        />
      ) : null}
      <TextField
        id="email"
        name="email"
        label="Adresse e-mail"
        type="email"
        autoComplete="username"
        spellCheck={false}
        required
        defaultValue={etat.email}
      />
      <TextField
        id="mot-de-passe"
        name="mot-de-passe"
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        required
      />
      <div>
        <Button type="submit" pending={enCours ? 'Connexion en cours' : undefined}>
          Se connecter
        </Button>
      </div>
    </form>
  )
}
