import { EnTete } from './EnTete'
import { LienCoffre } from './LienCoffre'

// Contenu de la page introuvable du coffre (story 3.2, partie D) : identifiant mal formé ou demande
// inconnue (effacée, par exemple). Rien ne cite l'adresse demandée.
export function Introuvable() {
  return (
    <EnTete titre="Introuvable">
      <p>Cette demande n’existe pas, ou elle a été effacée.</p>
      <p>
        <LienCoffre href="/coffre">Retour à la liste des demandes</LienCoffre>
      </p>
    </EnTete>
  )
}
