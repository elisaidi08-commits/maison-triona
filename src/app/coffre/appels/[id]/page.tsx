import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'

import { Button } from '@/components/ui/Button'
import { CheckboxField } from '@/components/ui/CheckboxField'
import { appelDuCoffre } from '@/lib/auth/acces'
import { lireAccesRequete } from '@/lib/auth/serveur'
import { agendaStatus } from '@/lib/booking/agenda'
import type { Slot } from '@/lib/booking/slots'
import {
  estErreurAppel,
  heuresAppel,
  jourAppel,
  lireResultat,
  MESSAGES_APPEL,
  STATUTS_APPEL,
} from '@/lib/coffre/appels'
import { dateEnLettres, heureEnLettres } from '@/lib/coffre/disponibilites'
import { getCoffrePool } from '@/lib/db/pool'
import { lireIdentifiantAppel } from '@/lib/validation/agenda'

import { seDeconnecter } from '../../actions'
import { EnTete } from '../../_composants/EnTete'
import { LienCoffre } from '../../_composants/LienCoffre'
import { annulerAppelCoffre, deplacerAppelCoffre, effacerAppelCoffre } from '../actions'

// Page d'un appel dans le coffre (story 3.11 ; docs/reservation-appel.md §3.2) : déplacer et annuler
// un appel à venir, effacer un appel (procédure RGPD, droit à l'effacement). Adresse stable,
// /coffre/appels/<uuid> ; identifiant mal formé : 404 rendu par src/proxy.ts. Session ouverte par le
// TOTP exigée. La page ne montre que l'heure, le statut et les créneaux libres : rien de la personne
// (le nom ne s'ouvre que dans l'agenda, déchiffré dans le navigateur), donc sans journal, comme la
// page d'une demande. Chaque geste passe par une Server Action journalisée (`booking_move`,
// `booking_cancel`, `booking_delete`), formulaire natif, sans JavaScript ; le résultat revient dans
// l'adresse (`?resultat=`, liste fermée). Aucun message ne part vers la personne : l'e-mail courtois
// avec un lien pour choisir un autre créneau (§3.2) attend la boîte d'envoi (3.12) ; d'ici là, Cat
// prévient la personne par téléphone (D78). Rien du contenu scellé n'est remis ni ouvert ici : pas
// de ligne `booking_read` à l'affichage (D78, point 6). Les créneaux
// proposés suivent les mêmes règles que la page publique (délai minimal, horizon, plafond, absences).

export const metadata: Metadata = { title: 'Appel' }

const CHAMP =
  'min-h-touch w-full rounded-none border-0 border-b border-encre-68 bg-transparent px-0 py-8 text-body text-encre'

// Créneaux groupés par jour local, pour une liste à `optgroup`.
function parJour(slots: Slot[]): { jour: string; slots: Slot[] }[] {
  const jours: { jour: string; slots: Slot[] }[] = []
  for (const slot of slots) {
    const dernier = jours.at(-1)
    if (dernier?.jour === slot.localDate) dernier.slots.push(slot)
    else jours.push({ jour: slot.localDate, slots: [slot] })
  }
  return jours
}

export default async function PageAppel({
  params,
  searchParams,
}: PageProps<'/coffre/appels/[id]'>) {
  const id = lireIdentifiantAppel((await params).id)
  // Doublon du proxy (404 avant tout rendu), au cas où la page serait atteinte autrement.
  if (!id) notFound()
  const acces = await lireAccesRequete()
  if (acces.etat === 'anonyme') redirect('/coffre/connexion')
  if (acces.etat === 'enrolement') redirect('/coffre/enrolement')
  const maintenant = new Date()
  const lu = await appelDuCoffre(getCoffrePool(), acces, id, maintenant)
  if (!lu) notFound()

  const resultat = lireResultat((await searchParams).resultat)
  const { call, phase, slots } = lu
  const statut =
    STATUTS_APPEL[
      agendaStatus({ status: call.status, startsAt: call.start, endsAt: call.end }, maintenant)
    ]
  const quand = `${dateEnLettres(jourAppel(call.start))}, ${heuresAppel(call.start, call.end)}`

  return (
    <>
      <EnTete titre="Appel">
        <p>
          Session de {acces.compte.nom}. Heures de Bruxelles. Chaque déplacement, annulation ou
          effacement est inscrit au journal d’accès, sans contenu.
        </p>
        {/* Brouillon à valider par Cat (D78) : vrai jusqu'aux e-mails des appels (3.12). */}
        <p className="border-l border-or pl-16">
          Aucun message ne part encore : après un déplacement ou une annulation, prévenez la
          personne par téléphone.
        </p>
        <p>
          <LienCoffre href="/coffre/appels">Retour à l’agenda des appels</LienCoffre>
        </p>
      </EnTete>

      <section aria-labelledby="appel-titre" className="flex max-w-measure flex-col gap-16">
        <h2 id="appel-titre" className="text-title-h3 text-encre">
          {quand}
        </h2>
        <p className="text-label text-encre uppercase">{statut}</p>
        <div aria-live="polite">
          {resultat ? (
            <p
              className={
                estErreurAppel(resultat)
                  ? 'border-l-2 border-encre py-8 pl-24 text-body-s'
                  : 'text-body-s'
              }
            >
              {MESSAGES_APPEL[resultat]}
            </p>
          ) : null}
        </div>
      </section>

      {phase === 'upcoming' ? (
        <section aria-labelledby="deplacer-titre" className="flex max-w-measure flex-col gap-24">
          <h2 id="deplacer-titre" className="text-title-h3 text-encre">
            Déplacer
          </h2>
          {slots.length === 0 ? (
            <p>Aucun autre créneau n’est libre dans l’horizon de réservation.</p>
          ) : (
            <form action={deplacerAppelCoffre} className="flex flex-col gap-24">
              <input type="hidden" name="id" value={call.id} />
              <div className="flex flex-col gap-8">
                <label htmlFor="creneau" className="text-label text-encre uppercase">
                  Nouveau créneau
                </label>
                <select id="creneau" name="creneau" required className={CHAMP}>
                  {parJour(slots).map(({ jour, slots: duJour }) => (
                    <optgroup key={jour} label={dateEnLettres(jour)}>
                      {duJour.map((slot) => (
                        <option key={slot.start.toISOString()} value={slot.start.toISOString()}>
                          {dateEnLettres(jour)}, {heureEnLettres(slot.localTime)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <p className="text-body-s">
                L’heure actuelle reste réservée jusqu’à ce que le nouveau créneau soit pris. Mêmes
                règles que la page publique : délai minimal, horizon, plafond du jour, absences.
              </p>
              <div>
                <Button type="submit">Déplacer l’appel</Button>
              </div>
            </form>
          )}
        </section>
      ) : null}

      {phase === 'upcoming' ? (
        <section aria-labelledby="annuler-titre" className="flex max-w-measure flex-col gap-24">
          <h2 id="annuler-titre" className="text-title-h3 text-encre">
            Annuler
          </h2>
          <p>
            L’appel passe à « Annulé par la maison » et son créneau se libère. Une annulation ne se
            retire pas.
          </p>
          <form action={annulerAppelCoffre} className="flex flex-col gap-24">
            <input type="hidden" name="id" value={call.id} />
            <CheckboxField
              id="confirmation-annulation"
              name="confirmation"
              label="Je confirme l’annulation de cet appel."
              required
            />
            <div>
              <Button type="submit">Annuler l’appel</Button>
            </div>
          </form>
        </section>
      ) : phase === 'started' ? (
        <p className="max-w-measure">
          L’appel a commencé : il ne se déplace plus et ne s’annule plus. Qualifiez-le depuis
          l’agenda.
        </p>
      ) : null}

      <section aria-labelledby="effacement-titre" className="flex max-w-measure flex-col gap-24">
        <h2 id="effacement-titre" className="text-title-h3 text-encre">
          Effacement
        </h2>
        <p>
          À la demande de la personne (droit à l’effacement) : l’appel, son contenu chiffré et ses
          liens sont effacés, définitivement. L’effacement est inscrit au journal avec l’identifiant
          de l’appel, pour le rejouer après une restauration de sauvegarde. L’appel subsiste dans
          les sauvegardes de la base jusqu’à la fin de leur fenêtre.
        </p>
        <form action={effacerAppelCoffre} className="flex flex-col gap-24">
          <input type="hidden" name="id" value={call.id} />
          <CheckboxField
            id="confirmation-effacement"
            name="confirmation"
            label="Je confirme l’effacement définitif de cet appel."
            required
          />
          <div>
            <Button type="submit">Effacer l’appel</Button>
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
