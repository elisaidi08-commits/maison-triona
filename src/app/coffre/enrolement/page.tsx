import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { lireAccesRequete } from '@/lib/auth/serveur'

import { seDeconnecter } from '../actions'
import { EnTete } from '../_composants/EnTete'
import { FormulaireEnrolement } from '../_composants/FormulaireEnrolement'

// Enrôlement du TOTP (story 3.2, partie C) : seule page ouverte à un compte qui n'a pas encore de
// second facteur. Aucun contenu du coffre n'est accessible avant la confirmation du premier code.

export const metadata: Metadata = { title: 'Second facteur' }

export default async function EnrolementCoffre() {
  const acces = await lireAccesRequete()
  if (acces.etat === 'anonyme') redirect('/coffre/connexion')
  if (acces.etat === 'autorise') redirect('/coffre')

  return (
    <>
      <EnTete titre="Second facteur">
        <p>
          Le coffre exige un code d’application d’authentification (TOTP) à chaque connexion. Le
          compte {acces.compte.email} n’en a pas encore : enregistrez-le maintenant.
        </p>
      </EnTete>
      <FormulaireEnrolement />
      <form action={seDeconnecter}>
        <Button type="submit" variant="discret">
          Se déconnecter
        </Button>
      </form>
    </>
  )
}
