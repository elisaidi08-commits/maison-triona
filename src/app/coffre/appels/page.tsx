import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { agendaDuCoffre, demandesRecentesDuCoffre } from '@/lib/auth/acces'
import { lireAccesRequete } from '@/lib/auth/serveur'
import type { AgendaCall } from '@/lib/booking/agenda-repository'
import {
  AGENDA_VIEWS,
  AUCUNE_DEMANDE,
  agendaStatus,
  canQualify,
  viewBounds,
} from '@/lib/booking/agenda'
import type { AgendaView } from '@/lib/booking/agenda'
import {
  adresseAppel,
  adresseVue,
  estErreurAppel,
  FUSEAU_AGENDA,
  heuresAppel,
  jourAppel,
  lireResultat,
  lireVue,
  MESSAGES_APPEL,
  optionsDemandes,
  STATUTS_APPEL,
  VUES,
} from '@/lib/coffre/appels'
import { dateEnLettres } from '@/lib/coffre/disponibilites'
import { dateHeure } from '@/lib/coffre/libelles'
import { isCancelled } from '@/lib/booking/manage'
import { getCoffrePool } from '@/lib/db/pool'
import type { VaultRequestSummary } from '@/lib/vault/repository'

import { seDeconnecter } from '../actions'
import { DeverrouillageAppels } from '../_composants/DeverrouillageAppels'
import { EnTete } from '../_composants/EnTete'
import { LienCoffre } from '../_composants/LienCoffre'
import { PersonneAppel } from '../_composants/PersonneAppel'
import { QualifierAppel } from '../_composants/QualifierAppel'
import { RattacherAppel } from '../_composants/RattacherAppel'

// Agenda des appels de Cat (story 3.13 ; docs/reservation-appel.md §3.2). Session ouverte par le TOTP
// exigée. Vues « Aujourd'hui » et « Cette semaine » (`?vue=semaine`), heure de Bruxelles, puis les
// appels d'avant restés « à qualifier ». Sans clé : l'heure, le statut (« à qualifier » déduit :
// confirmé, fin passée) et le rattachement. Le nom, le numéro (lien `tel:`), la langue, « pas de
// message vocal » et l'origine ne s'affichent qu'après le déverrouillage dans le navigateur
// (DeverrouillageAppels, PersonneAppel), comme une demande : la page n'en reçoit rien.
// Lecture journalisée au rendu (`booking_list`, une ligne par affichage, src/lib/booking/
// agenda-repository.ts) ; statut et rattachement par des actions serveur journalisées
// (./actions.ts). Liens simples, sans préchargement. Sans icône ; textes internes, en français.
// Story 3.11 : chaque appel mène à sa page (./[id]), où il se déplace, s'annule ou s'efface ; les
// appels annulés restent affichés (heure, statut), sans être déchiffrés : leur nombre n'a pas de
// borne, celui des autres ne dépasse jamais le plafond (LECTURE_MAX, src/lib/validation/agenda.ts).
// Hors périmètre : messages et SMS à la personne (3.12), notifications à Cat et invitations Google
// (boîte d'envoi, Key Manager).

export const metadata: Metadata = { title: 'Appels' }

function premiereMinuscule(texte: string): string {
  return texte.charAt(0).toLowerCase() + texte.slice(1)
}

function titreVue(vue: AgendaView, jours: string[]): string {
  const premier = jours[0] ?? ''
  const dernier = jours.at(-1) ?? premier
  if (vue === 'jour') return `Aujourd’hui, ${premiereMinuscule(dateEnLettres(premier))}`
  return `Cette semaine, du ${premiereMinuscule(dateEnLettres(premier))} au ${premiereMinuscule(dateEnLettres(dernier))}`
}

function Appel({
  appel,
  maintenant,
  demandes,
  titre,
  jour,
}: {
  appel: AgendaCall
  maintenant: Date
  demandes: VaultRequestSummary[]
  titre: 'h3' | 'h4'
  jour?: string
}) {
  const statut = agendaStatus(appel, maintenant)
  const heures = heuresAppel(appel.startsAt, appel.endsAt)
  const libelleHeures = jour ? `${premiereMinuscule(dateEnLettres(jour))}, ${heures}` : heures
  const Titre = titre
  const rattachee =
    appel.requestId && appel.requestCreatedAt
      ? { id: appel.requestId, createdAt: appel.requestCreatedAt }
      : null

  return (
    <li
      className={`flex flex-col gap-16 border-b border-sapin-20 py-24 ${statut === 'to_qualify' ? 'border-l-2 border-l-or pl-24' : ''}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-24 gap-y-8">
        <Titre className="text-body-l text-encre">{jour ? libelleHeures : heures}</Titre>
        <p className="text-label text-encre uppercase">{STATUTS_APPEL[statut]}</p>
      </div>
      {isCancelled(appel.status) ? null : <PersonneAppel id={appel.id} />}
      {canQualify(appel, maintenant) ? (
        <QualifierAppel id={appel.id} statut={appel.status} heures={libelleHeures} />
      ) : null}
      <RattacherAppel
        id={appel.id}
        options={optionsDemandes(demandes, rattachee)}
        actuelle={appel.requestId ?? AUCUNE_DEMANDE}
        heures={libelleHeures}
      />
      <p>
        <LienCoffre href={adresseAppel(appel.id)}>
          {isCancelled(appel.status) ? 'Effacer cet appel' : 'Déplacer, annuler ou effacer'}
          <span className="sr-only"> : appel de {libelleHeures}</span>
        </LienCoffre>
      </p>
      {rattachee ? (
        <p>
          <LienCoffre href={`/coffre/demandes/${rattachee.id}`}>
            Lire la demande rattachée, reçue le {dateHeure.format(rattachee.createdAt)}
          </LienCoffre>
        </p>
      ) : null}
    </li>
  )
}

function Liste({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col border-t border-sapin-20">{children}</ul>
}

export default async function PageAppels({ searchParams }: PageProps<'/coffre/appels'>) {
  const recherche = await searchParams
  const vue = lireVue(recherche.vue)
  const resultat = lireResultat(recherche.resultat)
  const acces = await lireAccesRequete()
  if (acces.etat === 'anonyme') redirect('/coffre/connexion')
  if (acces.etat === 'enrolement') redirect('/coffre/enrolement')

  const maintenant = new Date()
  const bornes = viewBounds(vue, maintenant, FUSEAU_AGENDA)
  const pool = getCoffrePool()
  const agenda = await agendaDuCoffre(pool, acces, {
    from: bornes.from,
    to: bornes.to,
    now: maintenant,
  })
  if (!agenda) redirect('/coffre/connexion')
  const demandes = (await demandesRecentesDuCoffre(pool, acces)) ?? []
  // Les appels annulés ne se déchiffrent pas (voir plus haut).
  const ids = [...agenda.calls, ...agenda.earlierToQualify]
    .filter((appel) => !isCancelled(appel.status))
    .map((appel) => appel.id)

  // Vue de la semaine : un titre par jour qui a des appels.
  const parJour = bornes.days
    .map((jour) => ({
      jour,
      appels: agenda.calls.filter((appel) => jourAppel(appel.startsAt) === jour),
    }))
    .filter(({ appels }) => appels.length > 0)

  return (
    <>
      <EnTete titre="Appels">
        <p>
          Session de {acces.compte.nom}. Heures de Bruxelles. L’heure et le statut de chaque appel
          s’affichent sans clé ; le nom, le numéro, la langue et l’origine de la personne ne
          s’ouvrent qu’ici, dans ce navigateur, avec votre paquet de clé. Chaque lecture et chaque
          action est inscrite au journal d’accès, sans contenu.
        </p>
        <p className="flex flex-wrap gap-x-24">
          <LienCoffre href="/coffre">Retour à la liste des demandes</LienCoffre>
          <LienCoffre href="/coffre/disponibilites">Disponibilités des appels</LienCoffre>
        </p>
      </EnTete>

      {resultat ? (
        <div aria-live="polite">
          <p
            className={
              estErreurAppel(resultat)
                ? 'border-l-2 border-encre py-8 pl-24 text-body-s'
                : 'text-body-s'
            }
          >
            {MESSAGES_APPEL[resultat]}
          </p>
        </div>
      ) : null}

      <nav aria-label="Vue de l’agenda" className="flex flex-wrap gap-x-24">
        {AGENDA_VIEWS.map((une) =>
          une === vue ? (
            <span
              key={une}
              aria-current="page"
              className="inline-flex min-h-touch items-center text-encre"
            >
              {VUES[une]}
            </span>
          ) : (
            <LienCoffre key={une} href={adresseVue(une)}>
              {VUES[une]}
            </LienCoffre>
          ),
        )}
      </nav>

      <DeverrouillageAppels ids={ids}>
        <section aria-labelledby="vue-titre" className="flex max-w-measure flex-col gap-24">
          <h2 id="vue-titre" className="text-title-h3 text-encre">
            {titreVue(vue, bornes.days)}
          </h2>
          {agenda.calls.length === 0 ? (
            <p>{vue === 'jour' ? 'Aucun appel aujourd’hui.' : 'Aucun appel cette semaine.'}</p>
          ) : vue === 'jour' ? (
            <Liste>
              {agenda.calls.map((appel) => (
                <Appel
                  key={appel.id}
                  appel={appel}
                  maintenant={maintenant}
                  demandes={demandes}
                  titre="h3"
                />
              ))}
            </Liste>
          ) : (
            parJour.map(({ jour, appels }) => (
              <div key={jour} className="flex flex-col gap-16">
                <h3 className="text-body-l text-encre">{dateEnLettres(jour)}</h3>
                <Liste>
                  {appels.map((appel) => (
                    <Appel
                      key={appel.id}
                      appel={appel}
                      maintenant={maintenant}
                      demandes={demandes}
                      titre="h4"
                    />
                  ))}
                </Liste>
              </div>
            ))
          )}
        </section>

        {agenda.earlierToQualify.length > 0 ? (
          <section aria-labelledby="avant-titre" className="flex max-w-measure flex-col gap-24">
            <h2 id="avant-titre" className="text-title-h3 text-encre">
              Restent à qualifier
            </h2>
            <p>
              Appels passés avant {vue === 'jour' ? 'aujourd’hui' : 'cette semaine'}, encore
              confirmés : choisissez « Fait » ou « Pas de réponse ».
            </p>
            <Liste>
              {agenda.earlierToQualify.map((appel) => (
                <Appel
                  key={appel.id}
                  appel={appel}
                  maintenant={maintenant}
                  demandes={demandes}
                  titre="h3"
                  jour={jourAppel(appel.startsAt)}
                />
              ))}
            </Liste>
          </section>
        ) : null}
      </DeverrouillageAppels>

      <form action={seDeconnecter}>
        <Button type="submit" variant="discret">
          Se déconnecter
        </Button>
      </form>
    </>
  )
}
