import { getTranslations } from 'next-intl/server'
import { ContactBlock } from '@/components/sections/ContactBlock'
import { CommentCaSePasse, FicheRow } from '@/components/sections/Fonctionnement'
import { ShareLinks } from '@/components/share/ShareLinks'
import type { PublicPage } from '@/lib/seo'
import { SceneService } from '@/components/sections/SceneService'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'
import { SERVICES, SERVICE_PATHS, type Service } from '@/lib/services'

// Page de service (story 2.13, refondue en 2.14 : les services deviennent le cœur du site ; en trois
// temps depuis l'audit du 06/11/2026 §4, D64). Structure identique × 3 :
// - la scène (SceneService) : le nom du service et sa promesse en h1, sur deux lignes (D64 n° 6),
//   image collante ; à côté, ce que la maison fait pour ce service et le lien vers le formulaire ;
// 1. quelques situations ;
// 2. comment ça se passe : le déroulé en six étapes, la phrase du modèle, ce qu'il faut savoir
//    (sélection, rémunération, ce que la maison ne fait pas, confidentialité), en un seul chapitre ;
//    les autres services en pied, sur une ligne discrète (un repère, pas un intitulé de plus) ;
// 3. nous écrire : le bloc Contact sapin.
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

      <CommentCaSePasse
        locale={locale}
        extraLimit={service.key === 'senior' ? t('senior.limit') : undefined}
      />

      <nav
        aria-labelledby="autres-services-titre"
        className="flex flex-col gap-16 border-t border-sapin-20 py-48 lg:flex-row lg:items-center lg:gap-48"
      >
        <p id="autres-services-titre" className="text-label text-encre uppercase">
          {page('othersLabel')}
        </p>
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
      <ShareLinks page={SERVICE_PATHS[service.id] as PublicPage} locale={locale} />
      <ContactBlock locale={locale} />
    </>
  )
}
