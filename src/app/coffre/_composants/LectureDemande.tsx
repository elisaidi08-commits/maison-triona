'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'

import { Button } from '@/components/ui/Button'
import { ErrorSummary } from '@/components/ui/ErrorSummary'
import { nomFichierExport, texteExport } from '@/lib/coffre/export'
import { CHAMPS_SCELLES, valeurScellee } from '@/lib/coffre/libelles'
import type { Colonne } from '@/lib/coffre/libelles'
import type { VaultKeys } from '@/lib/vault/open'
import type { SealedFields } from '@/lib/vault/seal'

import { journaliserExport, lireScelle } from '../actions'

// Lecture déchiffrée d'une demande (story 3.2, partie D ; docs/coffre-cles.md §8), dans le
// navigateur seulement. La personne dépose son paquet de clé (un ou plusieurs fichiers JSON : après
// une rotation, chaque paquet est essayé) et tape sa phrase ; libsodium (WebAssembly, chargé à la
// demande, d'où `'wasm-unsafe-eval'` dans la CSP du coffre) déverrouille la clé privée, puis ouvre
// les octets scellés, demandés au serveur à ce moment-là (action `lireScelle`, qui inscrit `read` au
// journal, une fois par page).
// - Ni la clé privée, ni la phrase, ni le texte en clair ne vont au serveur, ni dans localStorage,
//   sessionStorage, IndexedDB ou un cookie. Les champs du formulaire n'ont pas d'attribut `name`
//   (un envoi natif, avant le chargement du script, ne transmettrait rien) et sont vidés aussitôt.
// - Les clés déverrouillées vivent en mémoire, le temps de la page : « Verrouiller », ou quitter la
//   page, les efface (`memzero`) ; une autre demande les redemande. Le texte déchiffré disparaît
//   avec elles (JavaScript ne permet pas d'effacer une chaîne : il est seulement oublié).
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

// Vrai une fois le script chargé et la page hydratée (faux au rendu serveur) : le bouton reste
// inactif jusque-là.
const abonner = () => () => {}

async function oublier(trousseau: VaultKeys[]): Promise<void> {
  if (trousseau.length === 0) return
  const cles = trousseau.splice(0)
  const { loadSodium } = await import('@/lib/vault/sodium')
  const lib = await loadSodium()
  for (const cle of cles) lib.memzero(cle.privateKey)
}

export function LectureDemande({ id, colonnes }: { id: string; colonnes: Colonne[] }) {
  const hydrate = useSyncExternalStore(
    abonner,
    () => true,
    () => false,
  )
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<Erreur | null>(null)
  const [champs, setChamps] = useState<SealedFields | null>(null)
  const [nombreCles, setNombreCles] = useState(0)
  const [exportEtat, setExportEtat] = useState<keyof typeof EXPORTS | null>(null)
  const trousseau = useRef<VaultKeys[]>([])
  // Octets scellés (base64), demandés une seule fois : rien de lisible sans la clé privée.
  const scelle = useRef<string | null>(null)
  const fichiers = useRef<HTMLInputElement>(null)
  const phrase = useRef<HTMLInputElement>(null)
  const titreLu = useRef<HTMLHeadingElement>(null)

  // Page quittée : les clés sont effacées de la mémoire.
  useEffect(() => {
    const cles = trousseau.current
    return () => {
      void oublier(cles)
    }
  }, [])

  // Demande ouverte : le focus va au contenu, que le lecteur d'écran annonce.
  useEffect(() => {
    if (champs) titreLu.current?.focus()
  }, [champs])

  async function deverrouiller(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enCours) return
    const deposes = Array.from(fichiers.current?.files ?? [])
    const saisie = phrase.current?.value ?? ''
    if (deposes.length === 0 || saisie === '') {
      setErreur('saisie')
      return
    }
    setErreur(null)
    setEnCours(true)
    try {
      // Argon2id (256 Mio) occupe la page quelques secondes : l'état « en cours » s'affiche d'abord.
      await new Promise((resolve) => setTimeout(resolve, 50))
      const [{ openSealed, unlockPrivateKey }, { decodeKeyPacket }, { fromBase64, loadSodium }] =
        await Promise.all([
          import('@/lib/vault/open'),
          import('@/lib/vault/key-packet'),
          import('@/lib/vault/sodium'),
        ])
      const lib = await loadSodium()

      let lisibles = 0
      let ouverts = 0
      for (const fichier of deposes) {
        let paquet: unknown
        try {
          paquet = JSON.parse(await fichier.text())
        } catch {
          continue
        }
        if (!decodeKeyPacket(lib, paquet)) continue
        lisibles += 1
        try {
          const cles = await unlockPrivateKey(paquet, saisie)
          ouverts += 1
          // Deux paquets de la même paire (Cat et Sady) : une seule clé gardée.
          const connue = trousseau.current.some((autre) =>
            lib.memcmp(autre.publicKey, cles.publicKey),
          )
          if (connue) lib.memzero(cles.privateKey)
          else trousseau.current.push(cles)
        } catch {
          // Cette phrase n'ouvre pas ce paquet : on essaie le suivant.
        }
      }
      // Ni la phrase ni les fichiers ne restent dans le formulaire.
      if (phrase.current) phrase.current.value = ''
      if (fichiers.current) fichiers.current.value = ''
      setNombreCles(trousseau.current.length)
      if (lisibles === 0) {
        setErreur('paquet')
        return
      }

      if (ouverts === 0 && trousseau.current.length === 0) {
        setErreur('phrase')
        return
      }
      scelle.current ??= (await lireScelle(id))?.scelle ?? null
      if (scelle.current === null) {
        setErreur('lecture')
        return
      }
      const octets = fromBase64(lib, scelle.current)
      if (octets) {
        for (const cles of trousseau.current) {
          try {
            setChamps(await openSealed(octets, cles))
            return
          } catch {
            // Autre paire (avant ou après une rotation) : clé suivante.
          }
        }
      }
      setErreur(ouverts === 0 ? 'phrase' : 'autre-cle')
    } catch {
      setErreur('chargement')
    } finally {
      setEnCours(false)
    }
  }

  function verrouiller() {
    setChamps(null)
    setExportEtat(null)
    setNombreCles(0)
    void oublier(trousseau.current)
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

  const etat = enCours
    ? 'Déverrouillage en cours. La page peut rester immobile quelques secondes.'
    : champs
      ? 'Demande déchiffrée dans ce navigateur.'
      : nombreCles > 0
        ? `${nombreCles === 1 ? 'Une clé déverrouillée' : `${nombreCles} clés déverrouillées`} en mémoire, le temps de la page.`
        : ''

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
            <Button variant="discret" onClick={verrouiller}>
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
          <div className="flex flex-col gap-8">
            <label htmlFor="paquet" className="text-label text-encre uppercase">
              Paquet de clé
            </label>
            <p id="paquet-aide" className="text-body-s text-encre">
              Votre fichier .json, gardé hors ligne. Après un changement de paire, déposez aussi
              l’ancien paquet : chacun est essayé.
            </p>
            <input
              id="paquet"
              ref={fichiers}
              type="file"
              accept=".json,application/json"
              multiple
              aria-describedby="paquet-aide"
              className="min-h-touch w-full text-body text-encre"
            />
          </div>
          <div className="flex flex-col gap-8">
            <label htmlFor="phrase" className="text-label text-encre uppercase">
              Phrase de passe
            </label>
            <input
              id="phrase"
              ref={phrase}
              type="password"
              autoComplete="off"
              spellCheck={false}
              className="min-h-touch w-full rounded-none border-0 border-b border-encre-68 bg-transparent px-0 py-8 text-body text-encre"
            />
          </div>
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
