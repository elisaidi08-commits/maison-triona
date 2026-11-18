import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { lireAccesRequete } from '@/lib/auth/serveur'

import { EnTete } from '../_composants/EnTete'
import { FormulaireConnexion } from '../_composants/FormulaireConnexion'

// Connexion au coffre (story 3.2, partie C) : première étape, adresse et mot de passe. Sans cookie
// de session, la page s'affiche sans interroger la base.

export const metadata: Metadata = { title: 'Connexion' }

export default async function ConnexionCoffre() {
  const acces = await lireAccesRequete()
  if (acces.etat === 'autorise') redirect('/coffre')
  if (acces.etat === 'enrolement') redirect('/coffre/enrolement')

  return (
    <>
      <EnTete titre="Connexion">
        <p>Espace réservé aux deux comptes nominatifs de la maison.</p>
      </EnTete>
      <FormulaireConnexion />
    </>
  )
}
