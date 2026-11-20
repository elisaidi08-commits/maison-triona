import { localizedPath, type Locale } from '../i18n/pathnames.ts'

// Version de la politique de confidentialité (messages/*.json, `Privacy`) que la case de
// consentement du formulaire fait accepter. Enregistrée avec chaque demande dans le coffre
// (colonne `privacy_version`, migration 0002) : avec `created_at`, c'est la preuve du consentement.
// Date de la dernière modification du texte, FR et EN (suffixe `.2` : deuxième version du même
// jour). À changer à chaque modification : tests/unit/privacy-version.test.ts échoue sinon. Donnée
// technique, jamais affichée (D61).
// Imports relatifs seulement : testé par node --test.

export const PRIVACY_POLICY_VERSION = '2026-11-20.2'

// Sections de la politique vers lesquelles renvoient les formulaires (« Lorsque vous nous
// écrivez », « Lorsque vous convenez d'un appel ») : leur ancre (`Privacy.sections[].id`) change
// avec la langue. tests/unit/privacy-version.test.ts vérifie qu'elles existent en FR et en EN.
export const PRIVACY_ANCHORS = {
  demande: { fr: 'demande', en: 'enquiry' },
  appel: { fr: 'appel', en: 'call' },
} as const satisfies Record<string, Record<Locale, string>>

export type PrivacySection = keyof typeof PRIVACY_ANCHORS

/** Lien vers une section de la politique, dans la langue de la page. */
export function privacyHref(section: PrivacySection, locale: Locale): string {
  return `${localizedPath('/confidentialite', locale)}#${PRIVACY_ANCHORS[section][locale]}`
}
