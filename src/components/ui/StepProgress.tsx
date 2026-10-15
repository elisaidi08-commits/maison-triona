// Tête d'étape du formulaire (docs/architecture.md §6.1, wireframe A, D08) : « Étape 2 sur 4 » en
// label, puis le titre de l'étape en display, dans un seul titre qui reçoit le focus à chaque
// changement d'étape (tabIndex -1, posé par le formulaire au lot 4). Le lecteur d'écran entend
// « Étape 2 sur 4, Votre situation ». Sous le titre, le filet de progression : un segment par
// étape, or jusqu'à l'étape en cours, sapin 20 % ensuite ; décoratif, le texte dit déjà tout.

type StepProgressProps = {
  id: string
  // Libellé complet fourni par messages/*.json (« Étape 2 sur 4 », « Step 2 of 4 »).
  stepLabel: string
  title: string
  current: number
  total: number
}

export function StepProgress({ id, stepLabel, title, current, total }: StepProgressProps) {
  return (
    <div className="flex flex-col gap-24">
      <h2 id={id} tabIndex={-1} className="flex flex-col gap-12">
        <span className="text-label text-encre uppercase">
          {stepLabel}
          <span className="sr-only">, </span>
        </span>
        <span className="font-display text-title-h2 text-sapin">{title}</span>
      </h2>
      <div aria-hidden="true" className="flex gap-4">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={`block flex-1 border-t ${index < current ? 'border-or' : 'border-sapin-20'}`}
          />
        ))}
      </div>
    </div>
  )
}
