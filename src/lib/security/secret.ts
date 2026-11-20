/**
 * Secret du formulaire (`FORM_SIGNING_SECRET`) : signe l'horodatage et sale les empreintes.
 * - Sur tout déploiement Vercel (`VERCEL_ENV` présent : production, aperçu public D62, branches),
 *   il est obligatoire (32 caractères au moins) ; sans lui, aucun repli : `null`, et le formulaire
 *   reste fermé (aucun jeton délivré, l'envoi répond « ouvrira bientôt »).
 * - Hors Vercel et hors production (`next dev`, tests unitaires), un repli de développement permet de
 *   travailler sans compte. Un serveur de production lancé ailleurs (`next start`, `NODE_ENV =
 *   production`) n'a pas de repli (relecture sécurité de la story 3.11, même règle que
 *   `secretEmpreinteAdresse`) : sans le secret, formulaire, réservation et lien de gestion restent
 *   fermés. Les serveurs des tests E2E reçoivent un secret factice (playwright.config.ts).
 * Testé par node --test.
 */

const REPLI_DEVELOPPEMENT = 'maison-triona-repli-de-developpement-jamais-deploye'
const LONGUEUR_MINIMUM = 32

type Environnement = Record<string, string | undefined>

export function secretFormulaire(env: Environnement = process.env): string | null {
  const secret = env.FORM_SIGNING_SECRET?.trim()
  if (secret && secret.length >= LONGUEUR_MINIMUM) return secret
  if (env.VERCEL_ENV || env.NODE_ENV === 'production') return null
  return secret || REPLI_DEVELOPPEMENT
}
