import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath } from '@/i18n/pathnames'
import type { Locale } from '@/i18n/routing'
import { SERVICES, SERVICE_PATHS, type Service } from '@/lib/services'

// Page de service (story 2.13, D26) : le second temps de la scène répond aux cinq questions de V3
// dans l'ordre où un visiteur se les pose (le besoin, pour qui, les situations, comment la maison
// procède, comment entrer en contact), avec la sélection et la confidentialité en appui, puis les
// deux autres services. Un intitulé court en label par bloc (h2), une idée par bloc ; trois
// situations, pas un catalogue. Aucun tarif, aucune promesse médicale ni de disponibilité.

function Bloc({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-16">
      <h2 className="text-label text-encre uppercase">{label}</h2>
      {children}
    </div>
  )
}

export async function ServiceDetails({ service, locale }: { service: Service; locale: Locale }) {
  const t = await getTranslations('Services')
  const page = await getTranslations('ServicePage')
  const contact = await getTranslations('Scenes.contact')
  const situations = t.raw(`${service.key}.situations`) as string[]
  const steps = page.raw('steps') as string[]
  const others = SERVICES.filter((other) => other.id !== service.id)

  return (
    <>
      <Bloc label={page('needLabel')}>
        <p>{t(`${service.key}.need`)}</p>
      </Bloc>

      <Bloc label={page('forWhomLabel')}>
        <p>{page('forWhom')}</p>
      </Bloc>

      <Bloc label={page('situationsLabel')}>
        <ul className="flex flex-col">
          {situations.map((situation) => (
            <li key={situation} className="border-b border-sapin-20 py-12 first:border-t">
              {situation}
            </li>
          ))}
        </ul>
      </Bloc>

      <Bloc label={t('howItWorks')}>
        <ol className="flex flex-col gap-12">
          {steps.map((step, index) => (
            <li key={step} className="flex items-baseline gap-16">
              <span aria-hidden="true" className="w-32 shrink-0 text-label text-cypres">
                {String(index + 1).padStart(2, '0')}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </Bloc>

      <Bloc label={page('selectionLabel')}>
        <p>{t('model')}</p>
      </Bloc>

      <Bloc label={page('discretionLabel')}>
        <p>{contact('reassurance')}</p>
        {service.key === 'senior' ? <p>{t('senior.precision')}</p> : null}
      </Bloc>

      <Bloc label={page('contactLabel')}>
        <p>
          <TextLink href={`/${locale}/contact?service=${service.id}`}>{t('cta')}</TextLink>
        </p>
      </Bloc>

      <nav aria-labelledby={`${service.anchor}-autres`} className="flex flex-col gap-16">
        <h2 id={`${service.anchor}-autres`} className="text-label text-encre uppercase">
          {page('othersLabel')}
        </h2>
        <ul className="flex flex-col items-start gap-8">
          {others.map((other) => (
            <li key={other.id}>
              <TextLink href={localizedPath(SERVICE_PATHS[other.id], locale)}>
                {t(`${other.key}.link`)}
              </TextLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
