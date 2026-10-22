import { getTranslations } from 'next-intl/server'
import { Rule } from '@/components/ui/Rule'

// Prototype V5 : la confiance, avec les textes existants (aucun texte nouveau).

// La confiance : comment ça se passe, en trois temps, sous la phrase du modèle de la maison.
export async function SceneTrust() {
  const t = await getTranslations('Services')
  const steps = t.raw('steps') as string[]
  return (
    <section aria-labelledby="confiance-titre" className="py-section">
      <div className="conteneur grid gap-48 lg:grid-cols-12 lg:gap-gutter">
        <div className="flex flex-col gap-24 lg:col-span-5">
          <Rule short />
          <p className="text-label text-encre uppercase">{t('howItWorks')}</p>
          <h2 id="confiance-titre" className="font-display text-title-h2 text-balance text-sapin">
            {t('model')}
          </h2>
        </div>
        <ol className="flex flex-col lg:col-span-6 lg:col-start-7 lg:self-end">
          {steps.map((step, index) => (
            <li
              key={step}
              className="flex items-baseline gap-24 border-b border-sapin-20 py-24 text-title-h3 text-encre first:border-t"
            >
              <span aria-hidden="true" className="w-32 shrink-0 text-label text-cypres">
                {String(index + 1).padStart(2, '0')}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
