import type { RefObject } from 'react'

// Paquet de clé et phrase de passe (story 3.2 D ; partagé par l'agenda, story 3.13) : deux champs
// sans attribut `name`, lus et vidés par useTrousseau ; rien ne part avec un envoi natif.
export function ChampsCle({
  fichiers,
  phrase,
}: {
  fichiers: RefObject<HTMLInputElement | null>
  phrase: RefObject<HTMLInputElement | null>
}) {
  return (
    <>
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
    </>
  )
}
