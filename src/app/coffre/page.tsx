import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { listeDuCoffre } from '@/lib/auth/acces'
import { lireAccesRequete } from '@/lib/auth/serveur'
import { getCoffrePool } from '@/lib/db/pool'
import {
  date,
  dateHeure,
  LANGUES,
  libelle,
  SERVICES,
  STATUTS,
  TYPES,
  URGENCES,
} from '@/lib/coffre/libelles'
import type { VaultRequestSummary } from '@/lib/vault/repository'

import { seDeconnecter } from './actions'
import { EnTete } from './_composants/EnTete'
import { LienCoffre } from './_composants/LienCoffre'

// Accueil du coffre (story 3.2, parties C et D) : liste des demandes, colonnes en clair seulement
// (jamais le contenu chiffré), lue par le repository et journalisée (`list`). La date de chaque
// demande mène à sa page de lecture (/coffre/demandes/<uuid>, déchiffrement dans le navigateur),
// par un lien simple, sans préchargement. Toutes les valeurs sont rendues comme texte.

export const metadata: Metadata = { title: 'Demandes' }

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
      <td className="py-12 pr-16">
        <LienCoffre href={`/coffre/demandes/${demande.id}`}>
          <span className="sr-only">Lire la demande du </span>
          {dateHeure.format(demande.createdAt)}
        </LienCoffre>
      </td>
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

export default async function AccueilCoffre({ searchParams }: PageProps<'/coffre'>) {
  const { effacee } = await searchParams
  const acces = await lireAccesRequete()
  if (acces.etat === 'anonyme') redirect('/coffre/connexion')
  if (acces.etat === 'enrolement') redirect('/coffre/enrolement')
  const demandes = (await listeDuCoffre(getCoffrePool(), acces)) ?? []

  return (
    <>
      <EnTete titre="Demandes">
        <p>
          Session de {acces.compte.nom}. Seules les colonnes de tri s’affichent ici ; le contenu
          d’une demande s’ouvre sur sa page, dans ce navigateur, avec votre paquet de clé.
        </p>
      </EnTete>

      {effacee === '1' ? (
        <p role="status" className="max-w-measure border-l-2 border-or py-8 pl-24">
          La demande a été effacée. Le journal d’accès garde la trace de l’effacement, sans contenu.
        </p>
      ) : null}

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
