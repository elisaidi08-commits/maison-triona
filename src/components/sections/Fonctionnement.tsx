import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { Rule } from '@/components/ui/Rule'
import { TextLink } from '@/components/ui/TextLink'
import { localizedPath, type Locale } from '@/i18n/pathnames'

// Comment la maison travaille (D40, réponses de Cat du 26/10/2026) : le déroulé en six étapes, le
// modèle (la maison présente, le prestataire signe, la maison veille), puis ce qu'il faut savoir
// (sélection, qui rémunère la maison, ce qu'elle ne fait pas, confidentialité). Pièces partagées
// par la page Services et les trois pages de service.
// Mise en page « fiche » : peu de chapitres en serif à gauche, le texte en colonne de lecture à
// droite, des sous-titres en EB Garamond dans le chapitre. Aucun tarif, aucune promesse médicale.
// Pages de service (audit du 06/11/2026 §4, D64) : un seul chapitre, « Comment ça se passe », qui
// réunit le déroulé, la phrase du modèle et ce qu'il faut savoir, au lieu de trois chapitres à la
// suite (CommentCaSePasse).

type Item = { title: string; text: string }
type Block = { title: string; paragraphs: string[] }

export function FicheRow({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  const titleId = `${id}-titre`
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className="grid gap-24 border-t border-sapin-20 py-48 lg:grid-cols-12 lg:gap-gutter lg:py-64"
    >
      {/* En desktop, l'intitulé reste en vue à gauche pendant qu'on lit un long chapitre
          (« Comment ça se passe ») : on sait toujours dans quel temps de la page on se trouve. */}
      <h2
        id={titleId}
        className="font-display text-title-h2 text-balance text-sapin lg:sticky lg:top-32 lg:col-span-5 lg:self-start"
      >
        {title}
      </h2>
      <div className="flex max-w-measure flex-col gap-16 lg:col-span-6 lg:col-start-7">
        {children}
      </div>
    </section>
  )
}

// Pages de service, deuxième temps : les six étapes de Cat (Confirmé), numérotées 01 à 06 (la liste
// ordonnée porte l'ordre, les numéros sont décoratifs) ; la phrase du modèle, posée seule entre deux
// filets courts ; puis ce qu'il faut savoir en quatre sous-titres (`#a-savoir`), sans intitulé de
// plus. `extraLimit` : une ligne propre au service dans « Ce que la maison ne fait pas » (pour le
// grand âge, aucun acte médical et l'orientation vers les professionnels de santé, sans le mot
// « soins », D39).
export async function CommentCaSePasse({
  locale,
  extraLimit,
  title,
  pageLink = true,
}: {
  locale: Locale
  extraLimit?: string
  // Page « Comment ça se passe » : un intitulé qui ne répète pas le h1, et pas de lien vers elle-même.
  title?: string
  pageLink?: boolean
}) {
  const t = await getTranslations('HowItWorks')
  const page = await getTranslations('HowItWorksPage')
  const steps = t.raw('steps.items') as Item[]
  const selection = t.raw('selection') as Block
  const payment = t.raw('payment') as Block
  const confidentiality = t.raw('confidentiality') as Block
  const limits = [...(t.raw('limits.items') as string[]), ...(extraLimit ? [extraLimit] : [])]
  return (
    <FicheRow id="deroule" title={title ?? t('steps.title')}>
      <ol className="flex flex-col">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex items-baseline gap-16 border-b border-sapin-20 py-24 first:pt-0 last:border-b-0 last:pb-0"
          >
            <span aria-hidden="true" className="w-32 shrink-0 text-label text-sapin">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="flex flex-col gap-8">
              <h3 className="text-title-h3 text-sapin">{step.title}</h3>
              <p>{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      {pageLink ? (
        <p className="mt-32">
          <TextLink href={localizedPath('/comment-ca-se-passe', locale)}>
            {page('detailLink')}
          </TextLink>
        </p>
      ) : null}

      <div className="my-48 flex flex-col gap-24 lg:my-64">
        <Rule short />
        <p className="font-display text-title-h2 text-balance text-sapin">{t('model.title')}</p>
      </div>

      <div id="a-savoir" className="flex flex-col gap-32 border-t border-sapin-20 pt-32">
        <SousBloc title={selection.title}>
          <Paragraphs paragraphs={selection.paragraphs} />
        </SousBloc>
        <SousBloc title={payment.title}>
          <Paragraphs paragraphs={payment.paragraphs} />
        </SousBloc>
        <SousBloc title={t('limits.title')}>
          <ul id="limites" className="flex flex-col">
            {limits.map((item) => (
              <li key={item} className="border-b border-sapin-20 py-12 first:border-t">
                {item}
              </li>
            ))}
          </ul>
        </SousBloc>
        <SousBloc title={confidentiality.title}>
          <Paragraphs paragraphs={confidentiality.paragraphs} />
          <p>
            <TextLink href={localizedPath('/confidentialite', locale)}>
              {t('confidentiality.link')}
            </TextLink>
          </p>
        </SousBloc>
      </div>
    </FicheRow>
  )
}

function SousBloc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-12 border-b border-sapin-20 pb-32 last:border-b-0 last:pb-0">
      <h3 className="text-title-h3 text-sapin">{title}</h3>
      {children}
    </div>
  )
}

function Paragraphs({ paragraphs }: { paragraphs: string[] }) {
  return paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)
}

// Page Services : la confidentialité seule, en une rangée.
export async function RangeeConfidentialite({ locale }: { locale: Locale }) {
  const t = await getTranslations('HowItWorks.confidentiality')
  return (
    <FicheRow id="confidentialite" title={t('title')}>
      <Paragraphs paragraphs={t.raw('paragraphs') as string[]} />
      <p>
        <TextLink href={localizedPath('/confidentialite', locale)}>{t('link')}</TextLink>
      </p>
    </FicheRow>
  )
}

// Page Services : le modèle en trois temps ; trois colonnes à partir de 1024 px, une colonne de
// lecture en dessous.
export async function Modele() {
  const t = await getTranslations('HowItWorks.model')
  const items = t.raw('items') as Item[]
  return (
    <section aria-labelledby="modele-titre" className="flex flex-col gap-48 py-section">
      <h2
        id="modele-titre"
        className="max-w-titre font-display text-title-h2 text-balance text-sapin"
      >
        {t('title')}
      </h2>
      <ol className="grid max-w-measure gap-32 lg:max-w-none lg:grid-cols-3 lg:gap-gutter">
        {items.map((item, index) => (
          <li key={item.title} className="flex flex-col gap-12 border-t border-or pt-24">
            <span aria-hidden="true" className="text-label text-sapin">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h3 className="text-title-h3 text-sapin">{item.title}</h3>
            <p>{item.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
