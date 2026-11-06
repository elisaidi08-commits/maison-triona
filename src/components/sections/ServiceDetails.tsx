import { getTranslations } from 'next-intl/server'
import { ContactBlock } from '@/components/sections/ContactBlock'
import { ASavoir, Deroule, Devise, FicheRow } from '@/components/sections/Fonctionnement'
import { SceneService } from '@/components/sections/SceneService'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICES, SERVICE_PATHS, type Service } from '@/lib/services'

// Page de service (story 2.13, refondue en 2.14 : les services deviennent le cœur du site). Trois
// temps, structure identique × 3 :
// 1. la scène (SceneService) : label, promesse en h1, image collante ; à côté, ce que la maison
//    fait pour ce service et le lien vers le formulaire ;
// 2. la fiche, en pleine largeur et en trois chapitres : quelques situations, le déroulé en six
//    étapes, puis, après la phrase du modèle posée seule, ce qu'il faut savoir (sélection,
//    rémunération, ce que la maison ne fait pas, confidentialité) ; les autres services en pied ;
// 3. le bloc Contact sapin.
// Faits : réponses de Cat du 26/10/2026 (D40, D42). Aucun tarif, aucune promesse médicale, aucun
// âge ni langue pour la garde d'enfants tant que Cat ne les a pas donnés. Le formulaire est
// atteint sans `?service=` : la présélection passera par le stockage de session (D26, story 3.4).

async function ServiceLead({ service, locale }: { service: Service; locale: Locale }) {
  const t = await getTranslations('Services')
  return (
    <div className="flex flex-col gap-24">
      <p className="text-body-l">{t(`${service.key}.need`)}</p>
      <p>
        <TextLink href={localizedPath('/contact', locale)}>{t('cta')}</TextLink>
      </p>
    </div>
  )
}

async function ServiceDetails({ service, locale }: { service: Service; locale: Locale }) {
  const t = await getTranslations('Services')
  const page = await getTranslations('ServicePage')
  const situations = t.raw(`${service.key}.situations`) as string[]
  const others = SERVICES.filter((other) => other.id !== service.id)

  return (
    <div className="conteneur">
      <FicheRow id="situations" title={page('situationsLabel')}>
        <ul className="flex flex-col">
          {situations.map((situation) => (
            <li key={situation} className="border-b border-sapin-20 py-12 first:border-t">
              {situation}
            </li>
          ))}
        </ul>
      </FicheRow>

      <Deroule />
      <Devise />
      <ASavoir
        locale={locale}
        extraLimit={service.key === 'senior' ? t('senior.limit') : undefined}
      />

      <nav
        aria-labelledby="autres-services-titre"
        className="flex flex-col gap-16 border-t border-sapin-20 py-48 lg:flex-row lg:items-center lg:gap-48"
      >
        <h2 id="autres-services-titre" className="text-label text-encre uppercase">
          {page('othersLabel')}
        </h2>
        <ul className="flex flex-col items-start gap-8 lg:flex-row lg:gap-32">
          {others.map((other) => (
            <li key={other.id}>
              <TextLink href={localizedPath(SERVICE_PATHS[other.id], locale)}>
                {t(`${other.key}.link`)}
              </TextLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export async function PageService({ service, locale }: { service: Service; locale: Locale }) {
  return (
    <>
      <SceneService service={service} locale={locale} heading="h1">
        <ServiceLead service={service} locale={locale} />
      </SceneService>
      <ServiceDetails service={service} locale={locale} />
      <ContactBlock locale={locale} />
    </>
  )
}
