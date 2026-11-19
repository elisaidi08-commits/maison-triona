import type { SealedFields } from '../vault/seal.ts'
import { CHAMPS_SCELLES, dateHeure, valeurScellee, type Colonne } from './libelles.ts'

// Export d'une demande (story 3.2, partie D) : un fichier texte composé **dans le navigateur**, à
// partir des colonnes en clair et des champs déchiffrés ; il ne passe jamais par le serveur, qui
// ne reçoit que l'identifiant pour inscrire `export` au journal. Texte brut (UTF-8) : lisible
// partout, rien d'exécutable. Sert notamment à répondre à une demande d'accès ou de portabilité.
// Imports relatifs seulement : testé par node --test.

export function nomFichierExport(id: string): string {
  return `demande-${id}.txt`
}

export function texteExport({
  id,
  colonnes,
  champs,
  exporteLe,
}: {
  id: string
  colonnes: readonly Colonne[]
  champs: SealedFields
  exporteLe: Date
}): string {
  const lignes = [
    'Maison Triona · Coffre',
    `Demande ${id}`,
    `Exportée le ${dateHeure.format(exporteLe)}`,
    '',
    ...colonnes.map(({ libelle, valeur }) => `${libelle} : ${valeur}`),
    '',
  ]
  for (const { cle, libelle } of CHAMPS_SCELLES) {
    const valeur = valeurScellee(cle, champs[cle])
    // Le mot libre garde ses retours à la ligne, sous son libellé.
    lignes.push(cle === 'message' ? `${libelle} :\n${valeur}` : `${libelle} : ${valeur}`)
  }
  return `${lignes.join('\n')}\n`
}
