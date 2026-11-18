import type { ReactNode } from 'react'

// Lien du coffre, à filet comme TextLink, mais lien HTML simple : pas de `next/link`, donc aucun
// préchargement. Précharger une page de demande la rendrait sur le serveur, et inscrirait au
// journal une lecture que personne n'a faite (story 3.2, partie D).
export function LienCoffre({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex min-h-touch items-center text-sapin underline decoration-or decoration-1 underline-offset-8 transition-colors duration-micro ease-standard hover:decoration-sapin"
    >
      {children}
    </a>
  )
}
