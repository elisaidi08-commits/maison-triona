import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import type { AccesCoffre } from '@/lib/auth/acces'
import { dernierPassageConservation, etatEnvoiDuCoffre, listeDuCoffre } from '@/lib/auth/acces'
import { lireAccesRequete } from '@/lib/auth/serveur'
import { getCoffrePool } from '@/lib/db/pool'
import { emailSendingState, outboxHealthLines } from '@/lib/outbox/health'
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
import { RETENTION_RUN_ALERT_HOURS, retentionRunStatus } from '@/lib/vault/retention'

import { seDeconnecter } from './actions'
import { CreerLienReservation } from './_composants/CreerLienReservation'
import { EnTete } from './_composants/EnTete'
import { LienCoffre } from './_composants/LienCoffre'

// Accueil du coffre (story 3.2, parties C et D) : liste des demandes, colonnes en clair seulement
// (jamais le contenu chiffré), lue par le repository et journalisée (`list`). La date de chaque
// demande mène à sa page de lecture (/coffre/demandes/<uuid>, déchiffrement dans le navigateur),
// par un lien simple, sans préchargement. Toutes les valeurs sont rendues comme texte. La date du
// dernier passage de la conservation planifiée s'affiche, avec une alerte au-delà de 48 heures.
// Juste après, l'état de l'envoi des e-mails (story 3.3, suites C, src/lib/outbox/health.ts) :
// envoi coupé ou mal configuré, messages en retard ou en échec, demandes de la semaine sans
// notification, avec une alerte en texte quand quelque chose ne va pas. Des comptes seulement :
// aucune demande n'est ouverte ni affichée, d'où aucune ligne au journal d'accès (comme pour la
// date de la conservation), mais lus comme elle derrière la vérification de l'accès
// (etatEnvoiDuCoffre). Si la requête échoue : « État de l'envoi indisponible. », sans l'erreur.
// Depuis la story 3.10 : « Créer un lien de réservation » (CreerLienReservation), le lien affiché une
// fois. Depuis la story 3.13 : lien vers l'agenda des appels (/coffre/appels).

export const metadata: Metadata = { title: 'Demandes' }

// État de l'envoi : les phrases du bloc, ou null si la lecture échoue (erreur ni affichée ni citée)
// ou si l'accès n'est pas autorisé.
async function etatEnvoi(
  acces: AccesCoffre,
  maintenant: Date,
): Promise<{ lines: string[]; alert: boolean } | null> {
  try {
    const sante = await etatEnvoiDuCoffre(getCoffrePool(), acces, maintenant)
    return sante ? outboxHealthLines(sante, emailSendingState(process.env)) : null
  } catch {
    return null
  }
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
  const dernierPassage = await dernierPassageConservation(getCoffrePool(), acces)
  const conservation = retentionRunStatus(dernierPassage, new Date())
  const envoi = await etatEnvoi(acces, new Date())

  return (
    <>
      <EnTete titre="Demandes">
        <p>
          Session de {acces.compte.nom}. Seules les colonnes de tri s’affichent ici ; le contenu
          d’une demande s’ouvre sur sa page, dans ce navigateur, avec votre paquet de clé.
        </p>
        <p className="flex flex-wrap gap-x-24">
          <LienCoffre href="/coffre/appels">Agenda des appels</LienCoffre>
          <LienCoffre href="/coffre/disponibilites">Disponibilités des appels</LienCoffre>
        </p>
      </EnTete>

      {effacee === '1' ? (
        <p role="status" className="max-w-measure border-l-2 border-or py-8 pl-24">
          La demande a été effacée. Le journal d’accès garde la trace de l’effacement, sans contenu.
        </p>
      ) : null}

      {/* Conservation planifiée (partie D) : une date, et une alerte en texte si elle ne passe plus. */}
      <div className="flex max-w-measure flex-col gap-16">
        <p className="text-body-s">
          {dernierPassage
            ? `Dernier passage de la conservation automatique : ${dateHeure.format(dernierPassage)}.`
            : 'Aucun passage de la conservation automatique n’est inscrit au journal.'}
        </p>
        {conservation === 'recent' ? null : (
          <p className="border-l-2 border-encre py-8 pl-24">
            Attention : la conservation automatique{' '}
            {conservation === 'never'
              ? 'n’a encore jamais tourné'
              : `n’a pas tourné depuis plus de ${RETENTION_RUN_ALERT_HOURS} heures`}
            . Les demandes échues ne sont pas effacées tant qu’elle ne passe pas : vérifier la tâche
            planifiée (variable CRON_SECRET, journaux de Vercel).
          </p>
        )}
      </div>

      {/* État de l'envoi des e-mails (3.3, suites C) : même tenue, alertes comme celle du dessus. */}
      <div className="flex max-w-measure flex-col gap-16">
        {envoi === null ? (
          <p className="text-body-s">État de l’envoi indisponible.</p>
        ) : (
          envoi.lines.map((ligne) => (
            <p
              key={ligne}
              className={envoi.alert ? 'border-l-2 border-encre py-8 pl-24' : 'text-body-s'}
            >
              {ligne}
            </p>
          ))
        )}
      </div>

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

      {/* Réservation d'appel (story 3.10) : lien créé à la main, en attendant l'e-mail (story 3.9). */}
      <CreerLienReservation />

      <form action={seDeconnecter}>
        <Button type="submit" variant="discret">
          Se déconnecter
        </Button>
      </form>
    </>
  )
}
