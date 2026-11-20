// Version de la politique de confidentialité (messages/*.json, `Privacy`) que la case de
// consentement du formulaire fait accepter. Enregistrée avec chaque demande dans le coffre
// (colonne `privacy_version`, migration 0002) : avec `created_at`, c'est la preuve du consentement.
// Date de la dernière modification du texte, FR et EN. À changer à chaque modification :
// tests/unit/privacy-version.test.ts échoue sinon. Donnée technique, jamais affichée (D61).
// Imports relatifs seulement : testé par node --test.

export const PRIVACY_POLICY_VERSION = '2026-11-20'
