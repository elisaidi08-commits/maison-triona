// Tête d'étape du formulaire (variante A, D08 ; docs/trust-contact-launch.md annexe C) : une ligne
// de label « ÉTAPE 2 SUR 4 · VOTRE SITUATION », titre unique qui reçoit le focus à chaque
// changement d'étape (tabIndex -1, posé par le formulaire au lot 4) ; pas de second titre en
// serif sous le titre display de la page. Dessous, la « barre » est un filet or qui se remplit :
// une ligne continue, or jusqu'à l'étape en cours, sapin 20 % ensuite ; décorative, le texte dit
// déjà tout.

type StepProgressProps = {
  id: string
  // Libellé fourni par messages/*.json (« Étape 2 sur 4 », « Step 2 of 4 »).
  stepLabel: string
  title: string
  current: number
  total: number
}

export function StepProgress({ id, stepLabel, title, current, total }: StepProgressProps) {
  return (
    <div className="flex flex-col gap-16">
      <h2 id={id} tabIndex={-1} className="text-label-l text-encre uppercase">
        {stepLabel} · {title}
      </h2>
      <div aria-hidden="true" className="flex">
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
