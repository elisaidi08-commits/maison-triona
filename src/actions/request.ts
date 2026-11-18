'use server'

import type { EtatDemande } from '@/lib/demande/champs'
import { lireValeurs, validerDemande } from '@/lib/validation/demande'

// Envoi du formulaire de contact (story 3.1, docs/architecture.md §6.1). Une Server Action est un
// point d'entrée POST public : la demande entière est revalidée ici (Zod). L'envoi est fermé : le
// coffre n'existe pas encore (lot E). Rien n'est enregistré, envoyé ni journalisé ; le formulaire
// affiche l'état « L'envoi des demandes ouvrira bientôt ». La saisie revient telle quelle.

export async function envoyerDemande(
  _precedent: EtatDemande,
  donnees: FormData,
): Promise<EtatDemande> {
  const valeurs = lireValeurs(donnees)
  const resultat = validerDemande(valeurs)
  if (!resultat.succes) return { statut: 'erreurs', erreurs: resultat.erreurs, valeurs }
  // Le coffre (lot E) écrira ici la demande chiffrée. D'ici là : rien n'est enregistré, envoyé ni
  // journalisé.
  return { statut: 'ferme', valeurs }
}
