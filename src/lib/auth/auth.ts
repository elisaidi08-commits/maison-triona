import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api'
import { twoFactor } from 'better-auth/plugins/two-factor'
import type { Pool } from 'pg'

import { logAccess } from '../vault/repository.ts'
import type { AccessAction } from '../vault/repository.ts'
import {
  BASE_PATH_AUTH,
  CHEMIN_COFFRE,
  DELAI_SECOND_FACTEUR_S,
  DUREE_MAX_SESSION_S,
  MOT_DE_PASSE_MAX,
  MOT_DE_PASSE_MIN,
  parametresAuth,
} from './config.ts'

// Authentification du coffre (story 3.2, partie C ; D67) : Better Auth réduit au strict minimum.
// E-mail et mot de passe, inscriptions fermées, TOTP obligatoire (codes de secours), rien d'autre :
// ni OAuth, ni lien magique, ni e-mail OTP, ni OIDC, ni appareil, ni organisation, ni passkey (plus
// tard, avec la vérification de l'utilisateur obligatoire). Le plugin two-factor ne s'impose qu'aux
// connexions par identifiant : d'où aucune autre méthode de connexion.
// Comptes, sessions et secrets TOTP (chiffrés par Better Auth) dans la base du coffre
// (db/migrations/0003_auth.sql), par le pool `pg` de la partie A.

type Environnement = Record<string, string | undefined>

export const EMETTEUR_TOTP = 'Maison Triona'
export const ACTEUR_INCONNU = 'inconnu'

const VERIFICATION_TOTP = '/two-factor/verify-totp'
const VERIFICATION_SECOURS = '/two-factor/verify-backup-code'
const CONNEXION = '/sign-in/email'
const DECONNEXION = '/sign-out'

// Seules routes servies par HTTP (gestionnaire public et Server Actions) : les autres répondent 404.
// Pas de /get-session : les pages lisent la session côté serveur (auth.api.getSession).
export const CHEMINS_AUTORISES: ReadonlySet<string> = new Set([
  CONNEXION,
  VERIFICATION_TOTP,
  VERIFICATION_SECOURS,
  '/two-factor/enable',
  DECONNEXION,
])

// Sessions qui portent la preuve du second facteur (connexion ou fin d'enrôlement).
const CHEMINS_SECOND_FACTEUR: ReadonlySet<string> = new Set([
  VERIFICATION_TOTP,
  VERIFICATION_SECOURS,
])

// Acteur du journal, retenu avant l'appel : après un échec de trop, le défi TOTP est déjà consommé.
const acteurs = new WeakMap<object, string>()

function texte(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.length > 0 ? valeur : null
}

function corps(ctx: { body?: unknown }): Record<string, unknown> {
  return typeof ctx.body === 'object' && ctx.body !== null
    ? (ctx.body as Record<string, unknown>)
    : {}
}

export function creerAuth(pool: Pool, env: Environnement = process.env) {
  const { secret, baseURL, cookiesSecurises } = parametresAuth(env)

  // Compte visé par la requête : e-mail saisi (s'il existe), session en cours, ou défi TOTP. Jamais
  // une valeur saisie qui ne correspond à aucun compte.
  type Contexte = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]
  async function compteVise(ctx: Contexte): Promise<string | null> {
    const adaptateur = ctx.context.internalAdapter
    if (ctx.path === CONNEXION) {
      const email = texte(corps(ctx).email)?.toLowerCase()
      if (!email) return null
      return (await adaptateur.findUserByEmail(email))?.user.email ?? null
    }
    const session = await getSessionFromCtx(ctx).catch(() => null)
    if (session) return session.user.email
    const cookie = ctx.context.createAuthCookie('two_factor')
    const defi = await ctx.getSignedCookie(cookie.name, ctx.context.secret)
    if (!defi) return null
    const verification = await adaptateur.findVerificationValue(defi)
    if (!verification) return null
    return (await adaptateur.findUserById(verification.value))?.email ?? null
  }

  async function journaliser(acteur: string, action: AccessAction): Promise<void> {
    await logAccess(pool, { actor: acteur.slice(0, 120), action })
  }

  return betterAuth({
    appName: EMETTEUR_TOTP,
    baseURL,
    basePath: BASE_PATH_AUTH,
    secret,
    database: pool,
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: MOT_DE_PASSE_MIN,
      maxPasswordLength: MOT_DE_PASSE_MAX,
      // Aucun e-mail n'est envoyé par l'authentification (ni vérification ni réinitialisation).
      requireEmailVerification: false,
    },
    session: {
      // Échéance fixe à la création (8 h), jamais repoussée : la durée maximale est tenue par
      // Better Auth ; l'inactivité (15 min) par src/lib/auth/acces.ts.
      expiresIn: DUREE_MAX_SESSION_S,
      disableSessionRefresh: true,
      additionalFields: {
        twoFactorVerified: { type: 'boolean', required: true, defaultValue: false, input: false },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (_session, context) => ({
            data: { twoFactorVerified: CHEMINS_SECOND_FACTEUR.has(context?.path ?? '') },
          }),
        },
      },
    },
    rateLimit: {
      // Actif partout (Better Auth ne l'active par défaut qu'en production), compteurs en base :
      // la mémoire d'une fonction Vercel ne survit pas d'un appel à l'autre. Clé : IP et chemin.
      enabled: true,
      storage: 'database',
      window: 60,
      max: 30,
      customRules: {
        // 5 essais de mot de passe par 15 minutes et par IP (défaut : 3 par 10 secondes).
        [CONNEXION]: { window: 15 * 60, max: 5 },
        // Enrôlement et codes : 10 par 15 minutes et par IP (défaut : 3 par 10 secondes).
        '/two-factor/*': { window: 15 * 60, max: 10 },
      },
    },
    advanced: {
      // Cookies de la seule zone /coffre : jamais envoyés au site public, qui n'en pose aucun.
      cookiePrefix: 'coffre',
      useSecureCookies: cookiesSecurises,
      defaultCookieAttributes: { path: CHEMIN_COFFRE, sameSite: 'strict', httpOnly: true },
      // IP lue dans X-Forwarded-For, que Vercel réécrit avec l'adresse du client ; un en-tête à
      // plusieurs adresses est ignoré (Better Auth), l'IPv6 est regroupée par /64.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // Requête HTTP (gestionnaire ou Server Action) : liste fermée de routes.
        if (ctx.request && !CHEMINS_AUTORISES.has(ctx.path)) {
          throw APIError.from('NOT_FOUND', { code: 'NOT_FOUND', message: 'Not Found' })
        }
        // « Appareil de confiance » refusé : il dispenserait du TOTP pendant 30 jours.
        if (corps(ctx).trustDevice) {
          throw APIError.from('BAD_REQUEST', {
            code: 'TRUST_DEVICE_DISABLED',
            message: 'Trusted devices are disabled',
          })
        }
        if (ctx.request && (ctx.path === CONNEXION || CHEMINS_SECOND_FACTEUR.has(ctx.path))) {
          const acteur = await compteVise(ctx)
          if (acteur) acteurs.set(ctx.request, acteur)
        }
        if (ctx.request && ctx.path === DECONNEXION) {
          const session = await getSessionFromCtx(ctx).catch(() => null)
          if (session) acteurs.set(ctx.request, session.user.email)
        }
      }),
      // Journal d'accès (vault_access_log), sans contenu : connexions, échecs, déconnexions. Une
      // écriture impossible fait échouer la requête : pas de connexion sans trace. Les requêtes
      // refusées par la limitation de débit n'arrivent pas jusqu'ici (réponse 429 avant la route).
      after: createAuthMiddleware(async (ctx) => {
        const retenu = ctx.request ? acteurs.get(ctx.request) : undefined
        const resultat = ctx.context.returned
        const echec = isAPIError(resultat)

        if (ctx.path === CONNEXION) {
          if (echec) return journaliser(retenu ?? ACTEUR_INCONNU, 'login_failed')
          const utilisateur = ctx.context.newSession?.user as
            { email: string; twoFactorEnabled?: boolean | null } | undefined
          // TOTP enrôlé : la connexion ne sera ouverte qu'après le code (journalisée alors).
          if (!utilisateur || utilisateur.twoFactorEnabled) return
          return journaliser(utilisateur.email, 'login')
        }
        if (CHEMINS_SECOND_FACTEUR.has(ctx.path)) {
          if (echec) return journaliser(retenu ?? ACTEUR_INCONNU, 'login_failed')
          const utilisateur = (resultat as { user?: { email?: unknown } } | undefined)?.user
          return journaliser(texte(utilisateur?.email) ?? retenu ?? ACTEUR_INCONNU, 'login')
        }
        if (ctx.path === DECONNEXION && !echec && retenu) {
          return journaliser(retenu, 'logout')
        }
      }),
    },
    plugins: [
      twoFactor({
        issuer: EMETTEUR_TOTP,
        twoFactorCookieMaxAge: DELAI_SECOND_FACTEUR_S,
        // 5 échecs de suite (TOTP et codes de secours confondus, tous défis) : compte verrouillé
        // 15 minutes (défaut : 10 échecs). Le défi lui-même tombe après 5 essais (Better Auth).
        accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * 60 },
        backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: 'encrypted' },
      }),
    ],
  })
}

export type AuthCoffre = ReturnType<typeof creerAuth>
