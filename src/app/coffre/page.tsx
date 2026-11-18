import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { listeDuCoffre } from '@/lib/auth/acces'
import { lireAccesRequete } from '@/lib/auth/serveur'
import { getCoffrePool } from '@/lib/db/pool'
import type { VaultRequestSummary } from '@/lib/vault/repository'

import { seDeconnecter } from './actions'
import { EnTete } from './_composants/EnTete'

// Accueil du coffre (story 3.2, partie C) : liste des demandes, colonnes en clair seulement (jamais
// le contenu chiffré), lue par le repository et journalisée (`list`). Le déchiffrement viendra en
// partie D. Toutes les valeurs sont rendues comme texte.

export const metadata: Metadata = { title: 'Demandes' }

const TYPES: Record<string, string> = { request: 'Demande', urgent: 'Urgente' }
const STATUTS: Record<string, string> = {
  new: 'Nouvelle',
  in_progress: 'En cours',
  closed: 'Close',
}
const SERVICES: Record<string, string> = {
  conciergerie: 'Conciergerie',
  'grand-age': 'Grand âge',
  enfants: 'Enfants',
  indecis: 'À préciser',
}
const LANGUES: Record<string, string> = { fr: 'Français', en: 'Anglais' }
const URGENCES: Record<string, string> = {
  aucune: 'Aucune',
  semaines: 'Semaines à venir',
  urgent: 'Urgent',
}

const dateHeure = new Intl.DateTimeFormat('fr-BE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Brussels',
})
const date = new Intl.DateTimeFormat('fr-BE', { dateStyle: 'short', timeZone: 'Europe/Brussels' })

function libelle(valeurs: Record<string, string>, valeur: string | null): string {
  if (valeur === null) return '–'
  return valeurs[valeur] ?? valeur
}

const COLONNES = [
  'Reçue le',
  'Type',
  'Besoin',
  'Pays',
  'Langue',
  'Urgence',
  'Origine',
  'Statut',
  'Conservée jusqu’au',
]

function Ligne({ demande }: { demande: VaultRequestSummary }) {
  return (
    <tr className="border-b border-sapin-20">
      <td className="py-12 pr-16">{dateHeure.format(demande.createdAt)}</td>
      <td className="py-12 pr-16">{libelle(TYPES, demande.kind)}</td>
      <td className="py-12 pr-16">{libelle(SERVICES, demande.service)}</td>
      <td className="py-12 pr-16">{demande.country ?? '–'}</td>
      <td className="py-12 pr-16">{libelle(LANGUES, demande.locale)}</td>
      <td className="py-12 pr-16">{libelle(URGENCES, demande.urgency)}</td>
      <td className="py-12 pr-16">{demande.source ?? '–'}</td>
      <td className="py-12 pr-16">{libelle(STATUTS, demande.status)}</td>
      <td className="py-12">
        {date.format(demande.retentionUntil)}
        {demande.frozen ? ' (gelée)' : ''}
      </td>
    </tr>
  )
}

export default async function AccueilCoffre() {
  const acces = await lireAccesRequete()
  if (acces.etat === 'anonyme') redirect('/coffre/connexion')
  if (acces.etat === 'enrolement') redirect('/coffre/enrolement')
  const demandes = (await listeDuCoffre(getCoffrePool(), acces)) ?? []

  return (
    <>
      <EnTete titre="Demandes">
        <p>
          Session de {acces.compte.nom}. Seules les colonnes de tri s’affichent ici ; le contenu des
          demandes reste chiffré.
        </p>
      </EnTete>

      {demandes.length === 0 ? (
        <p>Aucune demande pour l’instant.</p>
      ) : (
        // Zone défilante en mobile, atteignable au clavier (WCAG 2.1.1).
        <div role="region" aria-label="Liste des demandes" tabIndex={0} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-body-s">
            <caption className="pb-16 text-left text-body">
              {demandes.length === 1 ? '1 demande' : `${demandes.length} demandes`}, de la plus
              récente à la plus ancienne
            </caption>
            <thead>
              <tr className="border-b border-or">
                {COLONNES.map((colonne) => (
                  <th key={colonne} scope="col" className="py-12 pr-16 text-label uppercase">
                    {colonne}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {demandes.map((demande) => (
                <Ligne key={demande.id} demande={demande} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form action={seDeconnecter}>
        <Button type="submit" variant="discret">
          Se déconnecter
        </Button>
      </form>
    </>
  )
}
