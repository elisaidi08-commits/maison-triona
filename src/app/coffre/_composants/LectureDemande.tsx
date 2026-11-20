'use client'

import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorSummary } from '@/components/ui/ErrorSummary'
import { nomFichierExport, texteExport } from '@/lib/coffre/export'
import { CHAMPS_SCELLES, valeurScellee } from '@/lib/coffre/libelles'
import type { Colonne } from '@/lib/coffre/libelles'
import type { SealedFields } from '@/lib/vault/seal'

import { journaliserExport, lireScelle } from '../actions'
import { ChampsCle } from './ChampsCle'
import { etatTrousseau, useHydrate, useTrousseau } from './useTrousseau'

// Lecture déchiffrée d'une demande (story 3.2, partie D ; docs/coffre-cles.md §8), dans le
// navigateur seulement. Le trousseau (paquet de clé, phrase, verrouillages, remise à zéro des clés)
// est dans useTrousseau, partagé avec l'agenda des appels (story 3.13) : mêmes garanties. Les octets
// scellés sont demandés au serveur au déverrouillage (action `lireScelle`, qui inscrit `read` au
// journal, une fois par page) ; les octets décodés sont remis à zéro dès l'ouverture.
// - Ni la clé privée, ni la phrase, ni le texte en clair ne vont au serveur, ni dans le stockage du
//   navigateur. Verrouiller vide aussi les octets scellés et l'état de l'export.
// - Le contenu est rendu comme texte, jamais comme HTML.
// - Export : l'action serveur ne reçoit que l'identifiant et inscrit `export` au journal ; le
//   fichier texte est composé ici (Blob) et téléchargé, sans passer par le serveur.

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
      'Erreur : aucune des clés déverrouillées n’ouvre cette demande. Après un changement de paire, déposez aussi l’ancien paquet.',
  },
  lecture: {
    href: '#paquet',
    message:
      'Erreur : la demande n’a pas pu être lue (session expirée, ou demande effacée entre-temps). Rechargez la page.',
  },
  chargement: {
    href: '#paquet',
    message: 'Erreur : le déchiffrement n’a pas pu démarrer. Rechargez la page, puis réessayez.',
  },
}

const EXPORTS = {
  'en-cours': 'Export en cours.',
  fait: 'Fichier texte téléchargé ; l’export est inscrit au journal.',
  erreur:
    'Erreur : l’export n’a pas pu être inscrit au journal ; aucun fichier n’a été créé. Réessayez.',
} as const

export function LectureDemande({ id, colonnes }: { id: string; colonnes: Colonne[] }) {
  const hydrate = useHydrate()
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<Erreur | null>(null)
  const [exportEtat, setExportEtat] = useState<keyof typeof EXPORTS | null>(null)
  // Octets scellés (base64), demandés une seule fois : rien de lisible sans la clé privée.
  const scelle = useRef<string | null>(null)
  const titreLu = useRef<HTMLHeadingElement>(null)
  const {
    contenu: champs,
    setContenu: setChamps,
    nombreCles,
    verrouillage,
    trousseau,
    fichiers,
    phrase,
    verrouiller,
    ouvrirCles,
  } = useTrousseau<SealedFields>(() => {
    setExportEtat(null)
    scelle.current = null
  })

  // Demande ouverte : le focus va au contenu, que le lecteur d'écran annonce.
  useEffect(() => {
    if (champs) titreLu.current?.focus()
  }, [champs])

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
      const [{ openSealed }, { fromBase64 }] = await Promise.all([
        import('@/lib/vault/open'),
        import('@/lib/vault/sodium'),
      ])
      scelle.current ??= (await lireScelle(id))?.scelle ?? null
      if (scelle.current === null) {
        setErreur('lecture')
        return
      }
      const octets = fromBase64(lib, scelle.current)
      if (octets) {
        try {
          for (const cle of trousseau.current) {
            try {
              setChamps(await openSealed(octets, cle))
              return
            } catch {
              // Autre paire (avant ou après une rotation) : clé suivante.
            }
          }
        } finally {
          lib.memzero(octets)
        }
      }
      setErreur(ouverts === 0 ? 'phrase' : 'autre-cle')
    } catch {
      setErreur('chargement')
    } finally {
      setEnCours(false)
    }
  }

  async function exporter() {
    if (!champs || exportEtat === 'en-cours') return
    setExportEtat('en-cours')
    let journalise = false
    try {
      journalise = (await journaliserExport(id)).ok
    } catch {
      journalise = false
    }
    if (!journalise) {
      setExportEtat('erreur')
      return
    }
    const texte = texteExport({ id, colonnes, champs, exporteLe: new Date() })
    const url = URL.createObjectURL(new Blob([texte], { type: 'text/plain;charset=utf-8' }))
    const lien = document.createElement('a')
    lien.href = url
    lien.download = nomFichierExport(id)
    lien.hidden = true
    document.body.append(lien)
    lien.click()
    lien.remove()
    // Le temps que le navigateur lise le Blob, puis plus aucune copie dans la page.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setExportEtat('fait')
  }

  const etat = etatTrousseau({
    enCours,
    ouvert: champs ? 'Demande déchiffrée dans ce navigateur.' : null,
    nombreCles,
    verrouillage,
  })

  return (
    <section aria-labelledby="lecture-titre" className="flex max-w-measure flex-col gap-32">
      <h2 id="lecture-titre" className="text-title-h3 text-encre">
        Contenu de la demande
      </h2>
      <p role="status" className="text-body-s text-encre">
        {etat}
      </p>

      {champs ? (
        <div className="flex flex-col gap-32">
          <h3 ref={titreLu} tabIndex={-1} className="text-label text-encre uppercase">
            Contenu déchiffré
          </h3>
          <dl className="flex flex-col gap-24">
            {CHAMPS_SCELLES.map(({ cle, libelle }) => (
              <div key={cle} className="flex flex-col gap-4 border-b border-sapin-20 pb-16">
                <dt className="text-label text-encre uppercase">{libelle}</dt>
                <dd
                  className={`text-body text-encre wrap-break-word ${cle === 'message' ? 'whitespace-pre-wrap' : ''}`}
                >
                  {valeurScellee(cle, champs[cle])}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-body-s text-encre">
            Rien de ce contenu n’a été envoyé au serveur. Il disparaît quand vous verrouillez ou
            quittez la page.
          </p>
          <div className="flex flex-wrap gap-24">
            <Button
              onClick={exporter}
              pending={exportEtat === 'en-cours' ? 'Export en cours' : undefined}
            >
              Exporter en fichier texte
            </Button>
            <Button variant="discret" onClick={() => verrouiller('bouton')}>
              Verrouiller
            </Button>
          </div>
          {exportEtat && exportEtat !== 'en-cours' ? (
            <p role={exportEtat === 'erreur' ? 'alert' : 'status'} className="text-body text-encre">
              {EXPORTS[exportEtat]}
            </p>
          ) : null}
        </div>
      ) : (
        <form onSubmit={deverrouiller} className="flex flex-col gap-32">
          {erreur ? (
            <ErrorSummary
              id="erreurs-lecture"
              title="La demande n’a pas pu être ouverte"
              errors={[MESSAGES[erreur]]}
              focusOnMount
            />
          ) : null}
          <p className="text-body text-encre">
            Le contenu est chiffré. Il s’ouvre ici, dans ce navigateur, avec votre paquet de clé et
            votre phrase de passe ; ni l’un ni l’autre n’est envoyé.
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
  )
}
