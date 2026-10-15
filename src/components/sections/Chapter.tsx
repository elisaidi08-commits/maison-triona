import type { ReactNode } from 'react'
import { Rule } from '@/components/ui/Rule'

// Chapitre de La Maison (D26, « L'enfilade ») : la même grammaire répétée de chapitre en chapitre,
// numéro en label cyprès, titre display Light, filet or de 48 px, un paragraphe de 40 à 60 mots,
// une image. Desktop : texte à gauche dans la colonne de lecture, image à droite (l'image collante
// partagée et son fondu viendront au lot 3). Mobile : l'image avant le texte, rien ne bouge.
// Le repère (« 01 · Une philosophie d'accueil ») reprend la ligne du sommaire ; le titre porte le
// message du chapitre et reçoit le focus quand on arrive par le sommaire (AnchorFocus cherche
// `${id}-titre`). Le numéro est décoratif : le sommaire porte déjà l'ordre des chapitres.

type ChapterProps = {
  id: string
  number: string
  name: string
  title: string
  children: ReactNode
  media?: ReactNode
}

export function Chapter({ id, number, name, title, children, media }: ChapterProps) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-titre`}
      className="grid grid-cols-1 gap-48 lg:grid-cols-12 lg:gap-gutter"
    >
      <div className="flex max-w-measure flex-col gap-24 lg:col-span-5">
        <p className="text-label text-cypres uppercase">
          <span aria-hidden="true">{number} · </span>
          {name}
        </p>
        <h2
          id={`${id}-titre`}
          tabIndex={-1}
          className="font-display text-display-l text-balance text-sapin"
        >
          {title}
        </h2>
        <Rule short />
        <div className="flex flex-col gap-24 text-body-l text-encre">{children}</div>
      </div>
      {media ? (
        <div className="relative order-first aspect-portrait overflow-hidden lg:order-none lg:col-span-6 lg:col-start-7">
          {media}
        </div>
      ) : null}
    </section>
  )
}
