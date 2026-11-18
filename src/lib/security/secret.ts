/**
 * Secret du formulaire (`FORM_SIGNING_SECRET`) : signe l'horodatage et sale les empreintes. En
 * production Vercel, il est obligatoire (32 caractères au moins) ; ailleurs (poste, CI, aperçu),
 * un repli de développement permet de travailler sans compte. Testé par node --test.
 */

const REPLI_DEVELOPPEMENT = 'maison-triona-repli-de-developpement-jamais-en-production'
const LONGUEUR_MINIMUM = 32

type Environnement = Record<string, string | undefined>

export function secretFormulaire(env: Environnement = process.env): string {
  const secret = env.FORM_SIGNING_SECRET?.trim()
  if (secret && secret.length >= LONGUEUR_MINIMUM) return secret
  if (env.VERCEL_ENV === 'production') {
    throw new Error(
      'FORM_SIGNING_SECRET manquant ou trop court (32 caractères au moins) : obligatoire en production.',
    )
  }
  return secret || REPLI_DEVELOPPEMENT
}
