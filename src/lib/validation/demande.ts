/**
 * Schéma Zod d'une demande (docs/architecture.md §6.2). La Server Action valide la demande entière ;
 * le formulaire valide l'étape en cours avec le même schéma avant de continuer. Les messages sont
 * des codes (lib/demande/champs.ts), traduits par messages/*.json.
 * Imports relatifs seulement : testé par node --test.
 */
import { z } from 'zod'
import {
  BESOINS,
  CHAMPS,
  CODES_ERREUR,
  CRENEAUX,
  ETAPES,
  LANGUES,
  LIMITES,
  ORIGINES,
  PAYS,
  POUR_QUI,
  URGENCES,
  estChamp,
  type CodeErreur,
  type Erreurs,
  type Valeurs,
} from '../demande/champs.ts'

// Sans compilation à la volée : Zod 4 sonde `new Function` pour accélérer ses objets, ce que la CSP
// du site refuse (`script-src` sans `'unsafe-eval'`) ; la sonde laissait une violation dans la
// console de /contact. Le mode sans compilation suffit largement à une demande de quinze champs.
z.config({ jitless: true })

// Téléphone international : chiffres, espaces, points, tirets, parenthèses, un « + » en tête ;
// de 6 chiffres (numéros fixes du Luxembourg) à 15 (plafond E.164). Espace littérale seulement :
// ni retour à la ligne ni tabulation. Le format exact de chaque pays viendra avec la réservation
// d'appel (libphonenumber-js, D57).
const CARACTERES_TELEPHONE = /^\+?[\d ().-]+$/

export function telephoneValide(valeur: string): boolean {
  if (!CARACTERES_TELEPHONE.test(valeur)) return false
  const chiffres = valeur.replace(/\D/g, '').length
  return chiffres >= 6 && chiffres <= 15
}

const besoin = z.object({
  besoin: z.enum(BESOINS, { error: 'besoin' }),
})

const situation = z.object({
  pourQui: z.enum(POUR_QUI, { error: 'pourQui' }).optional(),
  pays: z.enum(PAYS, { error: 'pays' }),
  urgence: z.enum(URGENCES, { error: 'urgence' }),
})

const joindre = z.object({
  nom: z
    .string({ error: 'nomRequis' })
    .min(LIMITES.nomMin, { error: 'nomCourt' })
    .max(LIMITES.nomMax, { error: 'nomLong' }),
  email: z
    .email({ error: 'emailFormat' })
    .max(LIMITES.emailMax, { error: 'emailFormat' })
    .optional(),
  telephone: z
    .string()
    .max(LIMITES.telephoneMax, { error: 'telephoneFormat' })
    .refine(telephoneValide, { error: 'telephoneFormat' })
    .optional(),
  creneau: z.enum(CRENEAUX, { error: 'creneau' }).optional(),
  langue: z.enum(LANGUES, { error: 'langue' }),
})

const mot = z.object({
  message: z.string().max(LIMITES.messageMax, { error: 'messageLong' }).optional(),
  origine: z.enum(ORIGINES, { error: 'origine' }).optional(),
  consentement: z.literal('oui', { error: 'consentement' }),
})

// Au moins un moyen de vous joindre ; l'erreur se place sur l'e-mail, premier des deux champs.
// `when` : vérifié même si d'autres champs sont en erreur, pour tout dire en une fois.
const auMoinsUnContact = {
  path: ['email'],
  error: 'contactRequis' satisfies CodeErreur,
  when: () => true,
}

function unContact(valeurs: { email?: unknown; telephone?: unknown }): boolean {
  return Boolean(valeurs.email || valeurs.telephone)
}

const SCHEMAS_ETAPES = [
  besoin,
  situation,
  joindre.refine(unContact, auMoinsUnContact),
  mot,
] as const

export const demandeSchema = z
  .object({
    ...besoin.shape,
    ...situation.shape,
    ...joindre.shape,
    ...mot.shape,
    // Langue de l'interface (champ caché) : une valeur inconnue retombe sur le français.
    locale: z.enum(LANGUES).catch('fr'),
  })
  .refine(unContact, auMoinsUnContact)

export type Demande = z.infer<typeof demandeSchema>

/**
 * Lit les champs connus d'un envoi : chaînes nettoyées, champ vide absent. Les retours à la ligne
 * du mot libre sont ramenés à un caractère (le navigateur envoie CRLF, `maxlength` compte LF).
 */
export function lireValeurs(donnees: FormData): Valeurs {
  const valeurs: Valeurs = {}
  for (const champ of [...CHAMPS, 'locale'] as const) {
    const brut = donnees.get(champ)
    if (typeof brut !== 'string') continue
    const valeur = (champ === 'message' ? brut.replace(/\r\n?/g, '\n') : brut).trim()
    if (valeur) valeurs[champ] = valeur
  }
  return valeurs
}

function estCode(message: string): message is CodeErreur {
  return (CODES_ERREUR as readonly string[]).includes(message)
}

// Code de repli d'un champ, pour une erreur sans message choisi (valeur inattendue).
const REPLI: Record<(typeof CHAMPS)[number], CodeErreur> = {
  besoin: 'besoin',
  pourQui: 'pourQui',
  pays: 'pays',
  urgence: 'urgence',
  nom: 'nomRequis',
  email: 'emailFormat',
  telephone: 'telephoneFormat',
  creneau: 'creneau',
  langue: 'langue',
  message: 'messageLong',
  origine: 'origine',
  consentement: 'consentement',
}

/** Une erreur par champ, la première trouvée. */
function erreursDe(issues: readonly z.core.$ZodIssue[]): Erreurs {
  const erreurs: Erreurs = {}
  for (const issue of issues) {
    const champ = issue.path[0]
    if (typeof champ !== 'string' || !estChamp(champ) || erreurs[champ]) continue
    erreurs[champ] = estCode(issue.message) ? issue.message : REPLI[champ]
  }
  return erreurs
}

export type ResultatValidation =
  { succes: true; demande: Demande } | { succes: false; erreurs: Erreurs }

export function validerDemande(valeurs: Valeurs): ResultatValidation {
  const resultat = demandeSchema.safeParse(valeurs)
  return resultat.success
    ? { succes: true, demande: resultat.data }
    : { succes: false, erreurs: erreursDe(resultat.error.issues) }
}

/** Erreurs d'une étape (0 à 3) ; objet vide si l'étape est complète. */
export function validerEtape(etape: number, valeurs: Valeurs): Erreurs {
  const schema = SCHEMAS_ETAPES[etape]
  if (!schema) return {}
  const resultat = schema.safeParse(valeurs)
  return resultat.success ? {} : erreursDe(resultat.error.issues)
}

/** Les champs d'une étape, pour remplacer ses erreurs après une nouvelle vérification. */
export function champsDeLEtape(etape: number): readonly (typeof CHAMPS)[number][] {
  return ETAPES[etape] ?? []
}
