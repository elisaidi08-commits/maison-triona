'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

import { INACTIVITE_MAX_S } from '@/lib/auth/durees'
import type { VaultKeys } from '@/lib/vault/open'
import type { Sodium } from '@/lib/vault/sodium'

// Trousseau du coffre, dans le navigateur seulement (story 3.2 D, factorisé par la story 3.13 pour
// l'agenda des appels ; docs/coffre-cles.md §8). Partagé par la lecture d'une demande
// (LectureDemande) et l'agenda (DeverrouillageAppels), avec les mêmes garanties :
// - la personne dépose son paquet de clé (un ou plusieurs fichiers JSON : après une rotation, chaque
//   paquet est essayé) et tape sa phrase ; libsodium (WebAssembly, chargé à la demande, d'où
//   `'wasm-unsafe-eval'` dans la CSP de ces seules pages) déverrouille la clé privée ;
// - ni la clé privée, ni la phrase, ni le texte en clair ne vont au serveur, ni dans localStorage,
//   sessionStorage, IndexedDB ou un cookie. Les champs n'ont pas d'attribut `name` (un envoi natif,
//   avant le chargement du script, ne transmettrait rien) et sont vidés aussitôt ;
// - les clés vivent en mémoire, le temps de la page. Tout se verrouille : sur « Verrouiller » ; en
//   quittant la page (`pagehide`, y compris vers le cache arrière du navigateur, d'où une page revenue
//   par « Précédent » arrive verrouillée) ; après 15 minutes sans interaction (`INACTIVITE_MAX_S`, la
//   même inactivité que la session) ; au démontage. Verrouiller vide le contenu déchiffré et
//   l'état du composant (`surVerrouillage`), puis remplit de zéros les octets des clés (`memzero`).
//   JavaScript ne permet pas d'effacer une chaîne : le texte est seulement oublié.

const ACTIVITE = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
const VERIFICATION_MS = 15_000

export const VERROUILLAGES = {
  inactivite: 'Lecture verrouillée après 15 minutes sans activité : les clés ont été effacées.',
  page: 'Lecture verrouillée en quittant la page : les clés ont été effacées.',
  bouton: 'Lecture verrouillée : les clés ont été effacées.',
} as const
export type Verrouillage = keyof typeof VERROUILLAGES

/** Déverrouillage des clés : la saisie manque, aucun paquet lisible, aucune clé ouverte, ou prêt. */
export type ResultatCles =
  { etat: 'saisie' | 'paquet' | 'phrase' } | { etat: 'pret'; lib: Sodium; ouverts: number }

// Vrai une fois le script chargé et la page hydratée (faux au rendu serveur) : les boutons restent
// inactifs jusque-là.
const abonner = () => () => {}

export function useHydrate(): boolean {
  return useSyncExternalStore(
    abonner,
    () => true,
    () => false,
  )
}

// Remplit de zéros les octets des clés (privée et publique), puis vide le trousseau.
async function oublier(trousseau: VaultKeys[]): Promise<void> {
  if (trousseau.length === 0) return
  const cles = trousseau.splice(0)
  const { loadSodium } = await import('@/lib/vault/sodium')
  const lib = await loadSodium()
  for (const cle of cles) {
    lib.memzero(cle.privateKey)
    lib.memzero(cle.publicKey)
  }
}

/** Texte de la zone d'état : en cours, ouvert, clés en mémoire, ou raison du dernier verrouillage. */
export function etatTrousseau(options: {
  enCours: boolean
  ouvert: string | null
  nombreCles: number
  verrouillage: Verrouillage | null
}): string {
  if (options.enCours)
    return 'Déverrouillage en cours. La page peut rester immobile quelques secondes.'
  if (options.ouvert) return options.ouvert
  if (options.nombreCles > 0) {
    return `${options.nombreCles === 1 ? 'Une clé déverrouillée' : `${options.nombreCles} clés déverrouillées`} en mémoire, le temps de la page.`
  }
  return options.verrouillage ? VERROUILLAGES[options.verrouillage] : ''
}

export function useTrousseau<T>(surVerrouillage?: () => void) {
  const [contenu, setContenu] = useState<T | null>(null)
  const [nombreCles, setNombreCles] = useState(0)
  const [verrouillage, setVerrouillage] = useState<Verrouillage | null>(null)
  const derniereActivite = useRef(0)
  const trousseau = useRef<VaultKeys[]>([])
  const fichiers = useRef<HTMLInputElement>(null)
  const phrase = useRef<HTMLInputElement>(null)
  // Dernière version du rappel, lue par `verrouiller` (stable) sans le recréer.
  const rappel = useRef(surVerrouillage)
  useEffect(() => {
    rappel.current = surVerrouillage
  })

  // Verrouille : contenu vidé, état du composant vidé, champs vidés, clés remplies de zéros. Stable
  // (références et setters seulement) : sert aux écouteurs ci-dessous.
  const verrouiller = useCallback((raison: Verrouillage) => {
    setContenu(null)
    setNombreCles(0)
    rappel.current?.()
    if (phrase.current) phrase.current.value = ''
    if (fichiers.current) fichiers.current.value = ''
    if (trousseau.current.length > 0) setVerrouillage(raison)
    void oublier(trousseau.current)
  }, [])

  // Démontage (autre page du coffre) : les clés sont effacées de la mémoire.
  useEffect(() => {
    const cles = trousseau.current
    return () => {
      void oublier(cles)
    }
  }, [])

  // Page quittée, y compris vers le cache arrière (bfcache) : verrouillée avant de partir, rendu
  // compris (flushSync), pour que la page gardée en cache ne contienne plus le texte.
  useEffect(() => {
    const quitter = () => flushSync(() => verrouiller('page'))
    window.addEventListener('pagehide', quitter)
    return () => window.removeEventListener('pagehide', quitter)
  }, [verrouiller])

  // 15 minutes sans interaction, clés en mémoire : verrouillée. Vérifié toutes les 15 secondes et au
  // retour sur l'onglet (les minuteries des onglets cachés sont ralenties).
  const actif = contenu !== null || nombreCles > 0
  useEffect(() => {
    if (!actif) return
    derniereActivite.current = Date.now()
    const noter = () => {
      derniereActivite.current = Date.now()
    }
    const verifier = () => {
      if (Date.now() - derniereActivite.current >= INACTIVITE_MAX_S * 1000) {
        verrouiller('inactivite')
      }
    }
    const visible = () => {
      if (document.visibilityState === 'visible') verifier()
    }
    for (const type of ACTIVITE) window.addEventListener(type, noter, { passive: true })
    document.addEventListener('visibilitychange', visible)
    const minuterie = window.setInterval(verifier, VERIFICATION_MS)
    return () => {
      for (const type of ACTIVITE) window.removeEventListener(type, noter)
      document.removeEventListener('visibilitychange', visible)
      window.clearInterval(minuterie)
    }
  }, [actif, verrouiller])

  /**
   * Déverrouille les clés des paquets déposés avec la phrase saisie, puis vide les deux champs. Deux
   * paquets de la même paire (Cat et Sady) : une seule clé gardée. Les clés déjà en mémoire restent.
   */
  async function ouvrirCles(): Promise<ResultatCles> {
    const deposes = Array.from(fichiers.current?.files ?? [])
    const saisie = phrase.current?.value ?? ''
    if (deposes.length === 0 || saisie === '') return { etat: 'saisie' }
    setVerrouillage(null)
    // Argon2id (256 Mio) occupe la page quelques secondes : l'état « en cours » s'affiche d'abord.
    await new Promise((resolve) => setTimeout(resolve, 50))
    const [{ unlockPrivateKey }, { decodeKeyPacket }, { loadSodium }] = await Promise.all([
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
    if (lisibles === 0) return { etat: 'paquet' }
    if (ouverts === 0 && trousseau.current.length === 0) return { etat: 'phrase' }
    return { etat: 'pret', lib, ouverts }
  }

  return {
    contenu,
    setContenu,
    nombreCles,
    verrouillage,
    trousseau,
    fichiers,
    phrase,
    verrouiller,
    ouvrirCles,
  }
}
