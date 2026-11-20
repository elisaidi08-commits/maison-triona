'use client'

import { useState, useSyncExternalStore } from 'react'

// « Copier le lien » (story 2.11) : n'apparaît qu'avec JavaScript (sans lui, un bouton sans effet
// tromperait ; l'envoi par e-mail reste). La confirmation est annoncée aux lecteurs d'écran par une
// zone `aria-live` toujours présente.

// Faux au rendu serveur, vrai après l'hydratation si le navigateur permet la copie.
const subscribe = () => () => {}
const canCopy = () => Boolean(navigator.clipboard)
const onServer = () => false

export function CopyLink({ url, label, copied }: { url: string; label: string; copied: string }) {
  const ready = useSyncExternalStore(subscribe, canCopy, onServer)
  const [message, setMessage] = useState('')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setMessage(copied)
    } catch {
      setMessage('')
    }
  }

  return (
    <>
      {ready ? (
        <button
          type="button"
          onClick={copy}
          data-mesure="partage:lien"
          className="inline-flex min-h-touch cursor-pointer items-center text-sapin underline decoration-or decoration-1 underline-offset-8"
        >
          {label}
        </button>
      ) : null}
      <span role="status" aria-live="polite" className="text-body-s text-encre-68">
        {message}
      </span>
    </>
  )
}
