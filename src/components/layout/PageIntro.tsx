import { Rule } from '@/components/ui/Rule'

// En-tête de page sobre : filet court, titre display. Utilisé par les pages encore en construction
// (leur contenu arrive avec les stories 2.6 à 2.11 et 3.x) pour que la navigation ne mène à aucune 404.

export function PageIntro({ title }: { title: string }) {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-24 px-margin py-section">
      <Rule short />
      <h1 className="font-display text-display-l text-sapin">{title}</h1>
    </section>
  )
}
