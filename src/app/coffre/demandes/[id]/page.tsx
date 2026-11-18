import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { demandeDuCoffre } from '@/lib/auth/acces'
import { lireAccesRequete } from '@/lib/auth/serveur'
import { colonnesEnClair, date } from '@/lib/coffre/libelles'
import { getCoffrePool } from '@/lib/db/pool'
import { isRequestId } from '@/lib/vault/repository'
import { isExpired } from '@/lib/vault/retention'

import { basculerGel, effacerDemande, seDeconnecter } from '../../actions'
import { EnTete } from '../../_composants/EnTete'
import { LienCoffre } from '../../_composants/LienCoffre'
import { LectureDemande } from '../../_composants/LectureDemande'

// Lecture d'une demande (story 3.2, partie D ; docs/architecture.md §6.5). Adresse stable,
// /coffre/demandes/<uuid> : la notification à Cat (story 3.3) y mènera. Rien ne cite l'identifiant.
// - Identifiant mal formé : 404, rendu par src/proxy.ts avant tout rendu (le format ne révèle rien).
// - Demande inconnue mais bien formée : page « Introuvable » (notFound) en **200** avec `noindex`.
//   Avec Cache Components, l'en-tête est déjà parti quand la page interroge la base ; choix gardé :
//   aucune fuite, la session (mot de passe et TOTP) est vérifiée avant, et sans session toute
//   adresse bien formée mène à la connexion, que la demande existe ou non.
// La page ne rend que
// les colonnes de tri, celles de la liste, sans journal : Next 16 (Cache Components) peut rendre une
// page deux fois par requête. La lecture, c'est-à-dire la remise des octets scellés, passe par une
// Server Action appelée au déverrouillage et journalisée (`read`), une ligne par lecture. Le
// déchiffrement, puis l'export, se font dans le navigateur (LectureDemande). Gel et effacement :
// formulaires natifs vers des Server Actions journalisées. Liens simples, sans préchargement.

export const metadata: Metadata = { title: 'Demande' }

export default async function PageDemande({ params }: PageProps<'/coffre/demandes/[id]'>) {
  const { id } = await params
  // Doublon du proxy (404 avant tout rendu), au cas où la page serait atteinte autrement.
  if (!isRequestId(id)) notFound()
  const acces = await lireAccesRequete()
  if (acces.etat === 'anonyme') redirect('/coffre/connexion')
  if (acces.etat === 'enrolement') redirect('/coffre/enrolement')
  const demande = await demandeDuCoffre(getCoffrePool(), acces, id)
  if (!demande) notFound()

  const echue = isExpired(demande, new Date())
  const conservation = demande.frozen
    ? 'Gelée : la conservation automatique ne l’effacera pas, même échue. Dégelez-la quand la limitation n’a plus lieu d’être.'
    : echue
      ? 'Échue : la conservation automatique l’effacera à son prochain passage (chaque nuit).'
      : `La conservation automatique l’effacera à son premier passage après le ${date.format(demande.retentionUntil)}, sauf si elle est gelée.`

  return (
    <>
      <EnTete titre="Demande">
        <p>
          Session de {acces.compte.nom}. Chaque lecture, export, gel ou effacement est inscrit au
          journal d’accès, sans contenu.
        </p>
        <p>
          <LienCoffre href="/coffre">Retour à la liste des demandes</LienCoffre>
        </p>
      </EnTete>

      <section aria-labelledby="colonnes-titre" className="flex max-w-measure flex-col gap-24">
        <h2 id="colonnes-titre" className="text-title-h3 text-encre">
          Colonnes de tri
        </h2>
        <dl className="flex flex-col gap-12">
          {colonnesEnClair(demande).map(({ libelle, valeur }) => (
            <div key={libelle} className="flex flex-wrap gap-x-16 border-b border-sapin-20 pb-12">
              <dt className="text-label text-encre uppercase">{libelle}</dt>
              <dd className="text-body text-encre">{valeur}</dd>
            </div>
          ))}
        </dl>
      </section>

      <LectureDemande id={demande.id} colonnes={colonnesEnClair(demande)} />

      <section aria-labelledby="conservation-titre" className="flex max-w-measure flex-col gap-24">
        <h2 id="conservation-titre" className="text-title-h3 text-encre">
          Conservation
        </h2>
        <p>{conservation}</p>
        <form action={basculerGel}>
          <input type="hidden" name="id" value={demande.id} />
          <input type="hidden" name="gel" value={demande.frozen ? 'non' : 'oui'} />
          <Button type="submit" variant="discret">
            {demande.frozen ? 'Dégeler la demande' : 'Geler la demande'}
          </Button>
        </form>
      </section>

      <section aria-labelledby="effacement-titre" className="flex max-w-measure flex-col gap-24">
        <h2 id="effacement-titre" className="text-title-h3 text-encre">
          Effacement
        </h2>
        <p>
          L’effacement est définitif et inscrit au journal, sans contenu. La demande subsiste dans
          les sauvegardes de la base jusqu’à la fin de leur fenêtre.
        </p>
        <form action={effacerDemande} className="flex flex-col gap-24">
          <input type="hidden" name="id" value={demande.id} />
          <CheckboxField
            id="confirmation"
            name="confirmation"
            label="Je confirme l’effacement définitif de cette demande."
            required
          />
          <div>
            <Button type="submit">Effacer la demande</Button>
          </div>
        </form>
      </section>

      <form action={seDeconnecter}>
        <Button type="submit" variant="discret">
          Se déconnecter
        </Button>
      </form>
    </>
  )
}
