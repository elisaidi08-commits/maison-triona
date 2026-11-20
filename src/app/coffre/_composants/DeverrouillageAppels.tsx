'use client'

import { createContext, use, useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorSummary } from '@/components/ui/ErrorSummary'
import type { SealedBookingFields } from '@/lib/vault/seal'

import { lireScellesAppels } from '../appels/actions'
import { ChampsCle } from './ChampsCle'
import { etatTrousseau, useHydrate, useTrousseau } from './useTrousseau'

// Noms et numéros de l'agenda (story 3.13 ; docs/reservation-appel.md §3.2), déchiffrés dans le
// navigateur seulement, avec le trousseau de la lecture des demandes (useTrousseau : mêmes
// garanties, mêmes verrouillages, clés remises à zéro). Au déverrouillage, les octets scellés des
// appels affichés sont demandés au serveur (`lireScellesAppels`, qui ne reçoit que leurs identifiants
// et inscrit `booking_read` pour chacun), ouverts ici (`openSealedBooking`), puis remis à zéro.
// Le contenu (nom, numéro, langue, origine) ne vit que dans l'état de ce composant, partagé par un
// contexte avec les PersonneAppel de la page : rien ne va au serveur ni dans le stockage du
// navigateur, et tout disparaît au verrouillage. Rendu comme texte, jamais comme HTML.

/** Appels ouverts : identifiant → champs, ou null si aucune clé déverrouillée ne l'ouvre. */
export type AppelsOuverts = ReadonlyMap<string, SealedBookingFields | null>

const AppelsDechiffres = createContext<AppelsOuverts | null>(null)

export function useAppelsDechiffres(): AppelsOuverts | null {
  return use(AppelsDechiffres)
}

type Erreur = 'saisie' | 'paquet' | 'phrase' | 'autre-cle' | 'lecture' | 'chargement'

const MESSAGES: Record<Erreur, { href: string; message: string }> = {
  saisie: {
    href: '#paquet',
    message: 'Erreur : déposez votre paquet de clé et saisissez votre phrase de passe.',
  },
  paquet: {
    href: '#paquet',
    message: 'Erreur : aucun des fichiers déposés n’est un paquet de clé du coffre.',
  },
  phrase: {
    href: '#phrase',
    message: 'Erreur : cette phrase de passe n’ouvre aucun des paquets déposés.',
  },
  'autre-cle': {
    href: '#paquet',
    message:
      'Erreur : aucune des clés déverrouillées n’ouvre ces appels. Après un changement de paire, déposez aussi l’ancien paquet.',
  },
  lecture: {
    href: '#paquet',
    message:
      'Erreur : les appels n’ont pas pu être lus (session expirée, ou base indisponible). Rechargez la page.',
  },
  chargement: {
    href: '#paquet',
    message: 'Erreur : le déchiffrement n’a pas pu démarrer. Rechargez la page, puis réessayez.',
  },
}

export function DeverrouillageAppels({ ids, children }: { ids: string[]; children: ReactNode }) {
  const hydrate = useHydrate()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<Erreur | null>(null)
  const titre = useRef<HTMLHeadingElement>(null)
  const {
    contenu,
    setContenu,
    nombreCles,
    verrouillage,
    trousseau,
    fichiers,
    phrase,
    verrouiller,
    ouvrirCles,
  } = useTrousseau<AppelsOuverts>()

  // Appels ouverts : le formulaire disparaît, le focus va au titre de la section.
  useEffect(() => {
    if (contenu) titre.current?.focus()
  }, [contenu])

  async function deverrouiller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enCours) return
    setErreur(null)
    setEnCours(true)
    try {
      const cles = await ouvrirCles()
      if (cles.etat !== 'pret') {
        setErreur(cles.etat)
        return
      }
      const { lib, ouverts } = cles
      const [{ openSealedBooking }, { fromBase64 }] = await Promise.all([
        import('@/lib/vault/open'),
        import('@/lib/vault/sodium'),
      ])
      const lus = await lireScellesAppels(ids)
      if (!lus) {
        setErreur('lecture')
        return
      }
      const appels = new Map<string, SealedBookingFields | null>()
      for (const { id, scelle } of lus.appels) {
        let champs: SealedBookingFields | null = null
        const octets = fromBase64(lib, scelle)
        if (octets) {
          try {
            for (const cle of trousseau.current) {
              try {
                champs = await openSealedBooking(octets, cle)
                break
              } catch {
                // Autre paire (avant ou après une rotation) : clé suivante.
              }
            }
          } finally {
            lib.memzero(octets)
          }
        }
        appels.set(id, champs)
      }
      if (lus.appels.length > 0 && [...appels.values()].every((champs) => champs === null)) {
        setErreur(ouverts === 0 ? 'phrase' : 'autre-cle')
        return
      }
      setContenu(appels)
    } catch {
      setErreur('chargement')
    } finally {
      setEnCours(false)
    }
  }

  const etat = etatTrousseau({
    enCours,
    ouvert: contenu
      ? 'Noms et numéros déchiffrés dans ce navigateur : ils s’affichent sous chaque appel.'
      : null,
    nombreCles,
    verrouillage,
  })

  return (
    <AppelsDechiffres value={contenu}>
      {ids.length > 0 ? (
        <section
          aria-labelledby="dechiffrement-titre"
          className="flex max-w-measure flex-col gap-24"
        >
          <h2
            id="dechiffrement-titre"
            ref={titre}
            tabIndex={-1}
            className="text-title-h3 text-encre"
          >
            Noms et numéros
          </h2>
          <p role="status" className="text-body-s text-encre">
            {etat}
          </p>
          {contenu ? (
            <div className="flex flex-col gap-24">
              <p className="text-body-s text-encre">
                Rien de ce contenu n’a été envoyé au serveur. Il disparaît quand vous verrouillez ou
                quittez la page.
              </p>
              <div>
                <Button variant="discret" onClick={() => verrouiller('bouton')}>
                  Verrouiller
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={deverrouiller} className="flex flex-col gap-32">
              {erreur ? (
                <ErrorSummary
                  id="erreurs-lecture"
                  title="Les appels n’ont pas pu être ouverts"
                  errors={[MESSAGES[erreur]]}
                  focusOnMount
                />
              ) : null}
              <p className="text-body text-encre">
                Le nom, le numéro, la langue et l’origine de chaque personne sont chiffrés. Ils
                s’ouvrent ici, dans ce navigateur, avec votre paquet de clé et votre phrase de passe
                ; ni l’un ni l’autre n’est envoyé.
              </p>
              <ChampsCle fichiers={fichiers} phrase={phrase} />
              <div>
                <Button
                  type="submit"
                  disabled={!hydrate}
                  pending={enCours ? 'Déverrouillage en cours' : undefined}
                >
                  Déverrouiller et lire
                </Button>
              </div>
            </form>
          )}
        </section>
      ) : null}
      {children}
    </AppelsDechiffres>
  )
}
