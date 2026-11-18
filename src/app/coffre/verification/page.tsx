import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { TextLink } from '@/components/ui/TextLink'
import { defiEnCours, lireAccesRequete } from '@/lib/auth/serveur'

import { EnTete } from '../_composants/EnTete'
import { FormulaireCode } from '../_composants/FormulaireCode'

// Second facteur (story 3.2, partie C) : après le mot de passe, le code TOTP ou un code de secours
// ouvre la session. Le défi expire après 5 minutes et 5 essais.

export const metadata: Metadata = { title: 'Vérification' }

export default async function VerificationCoffre() {
  const acces = await lireAccesRequete()
  if (acces.etat === 'autorise') redirect('/coffre')
  if (acces.etat === 'enrolement') redirect('/coffre/enrolement')

  if (!(await defiEnCours())) {
    return (
      <EnTete titre="Vérification">
        <p>
          Aucune connexion en cours.{' '}
          <TextLink href="/coffre/connexion">Commencer par le mot de passe</TextLink>
        </p>
      </EnTete>
    )
  }

  return (
    <>
      <EnTete titre="Vérification">
        <p>Saisissez le code de votre application d’authentification.</p>
      </EnTete>
      <FormulaireCode />
    </>
  )
}
