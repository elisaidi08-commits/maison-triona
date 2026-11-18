'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Rule } from '@/components/ui/Rule'

// Erreur d'une page (audit du 06/11/2026, §3.1 n° 13) : rare sur un site statique, mais jamais une
// page blanche. Composant client (règle de Next.js) : next-intl n'est pas envoyé au navigateur, les
// deux langues sont donc écrites ici, et la langue vient de l'adresse.

const TEXTS = {
  fr: {
    title: 'Un incident nous empêche d’afficher cette page.',
    retry: 'Réessayer',
    home: 'Revenir à l’accueil',
  },
  en: {
    title: 'Something prevents us from showing this page.',
    retry: 'Try again',
    home: 'Back to the home page',
  },
} as const

export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  const { locale } = useParams<{ locale?: string }>()
  const lang = locale === 'en' ? 'en' : 'fr'
  const t = TEXTS[lang]
  return (
    <section className="conteneur flex flex-col gap-24 py-section">
      <Rule short />
      <h1 tabIndex={-1} className="font-display text-display-l text-balance text-sapin">
        {t.title}
      </h1>
      <p className="flex flex-col items-start gap-16 lg:flex-row lg:gap-32">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-touch cursor-pointer items-center text-sapin underline decoration-or decoration-1 underline-offset-8"
        >
          {t.retry}
        </button>
        <Link
          href={`/${lang}`}
          className="inline-flex min-h-touch items-center text-sapin underline decoration-or decoration-1 underline-offset-8"
        >
          {t.home}
        </Link>
      </p>
    </section>
  )
}
