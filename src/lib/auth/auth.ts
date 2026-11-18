import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api'
import { twoFactor } from 'better-auth/plugins/two-factor'
import type { Pool } from 'pg'

import { countRecentFailures, logAccess } from '../vault/repository.ts'
import type { AccessAction } from '../vault/repository.ts'
import {
  BASE_PATH_AUTH,
  CHEMIN_COFFRE,
  DELAI_ENROLEMENT_S,
  DELAI_SECOND_FACTEUR_S,
  DISJONCTEUR_ECHECS,
  DUREE_MAX_SESSION_S,
  FENETRE_FREIN_S,
  MOT_DE_PASSE_MAX,
  MOT_DE_PASSE_MIN,
  parametresAuth,
  VERROU_COMPTE_ECHECS,
} from './config.ts'

// Authentification du coffre (story 3.2, partie C ; D67) : Better Auth réduit au strict minimum.
// E-mail et mot de passe, inscriptions fermées, TOTP obligatoire (codes de secours), rien d'autre :
// ni OAuth, ni lien magique, ni e-mail OTP, ni OIDC, ni appareil, ni organisation, ni passkey (plus
// tard, avec la vérification de l'utilisateur obligatoire). Le plugin two-factor ne s'impose qu'aux
// connexions par identifiant : d'où aucune autre méthode de connexion.
// Comptes, sessions et secrets TOTP (chiffrés par Better Auth) dans la base du coffre
// (db/migrations/0003_auth.sql), par le pool du compte `coffre` (db/roles/coffre.sql).

type Environnement = Record<string, string | undefined>

export const EMETTEUR_TOTP = 'Maison Triona'
export const ACTEUR_INCONNU = 'inconnu'

const CONNEXION = '/sign-in/email'
const VERIFICATION_TOTP = '/two-factor/verify-totp'
const VERIFICATION_SECOURS = '/two-factor/verify-backup-code'
const ENROLEMENT = '/two-factor/enable'
const DECONNEXION = '/sign-out'

// Seules routes servies (POST) : l'enveloppe (src/lib/auth/enveloppe.ts) répond 404 à toute autre
// avant Better Auth, sans rien écrire ; le hook `before` le revérifie. Pas de /get-session : les
// pages lisent la session côté serveur (auth.api.getSession).
export const CHEMINS_AUTORISES: ReadonlySet<string> = new Set([
  CONNEXION,
  VERIFICATION_TOTP,
  VERIFICATION_SECOURS,
  ENROLEMENT,
  DECONNEXION,
])

// Sessions qui portent la preuve du second facteur (connexion ou fin d'enrôlement).
const CHEMINS_SECOND_FACTEUR: ReadonlySet<string> = new Set([
  VERIFICATION_TOTP,
  VERIFICATION_SECOURS,
])

// Même réponse que la limite par IP de Better Auth : on ne dit pas quel frein a joué.
const TROP_DE_TENTATIVES = 'Too many requests. Please try again later.'

// Contexte d'une requête, retenu avant l'appel : après un échec de trop, le défi TOTP est déjà
// consommé ; `etape` distingue une connexion, un enrôlement et une vérification sans effet.
type Retenu = { acteur: string | null; etape: 'connexion' | 'enrolement' | 'sans-effet' }
const retenus = new WeakMap<object, Retenu>()

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

  type Contexte = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]

  // Compte visé sans session : e-mail saisi (s'il existe) ou défi TOTP en cours. Jamais une valeur
  // saisie qui ne correspond à aucun compte.
  async function compteVise(ctx: Contexte): Promise<string | null> {
    const adaptateur = ctx.context.internalAdapter
    if (ctx.path === CONNEXION) {
      const email = texte(corps(ctx).email)?.toLowerCase()
      if (!email) return null
      return (await adaptateur.findUserByEmail(email))?.user.email ?? null
    }
    const cookie = ctx.context.createAuthCookie('two_factor')
    const defi = await ctx.getSignedCookie(cookie.name, ctx.context.secret)
    if (!defi) return null
    const verification = await adaptateur.findVerificationValue(defi)
    if (!verification) return null
    return (await adaptateur.findUserById(verification.value))?.email ?? null
  }

  // Verrou souple par compte et disjoncteur global, sur les échecs récents du journal.
  async function freiner(acteur: string | null): Promise<void> {
    const depuis = new Date(Date.now() - FENETRE_FREIN_S * 1000)
    const global = await countRecentFailures(pool, depuis)
    const compte = acteur ? await countRecentFailures(pool, depuis, acteur) : 0
    if (global >= DISJONCTEUR_ECHECS || compte >= VERROU_COMPTE_ECHECS) {
      throw new APIError(
        'TOO_MANY_REQUESTS',
        { message: TROP_DE_TENTATIVES },
        { 'X-Retry-After': String(FENETRE_FREIN_S) },
      )
    }
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
          // Ni adresse IP ni navigateur dans les sessions (colonnes facultatives de Better Auth) :
          // la limitation de débit lit l'IP de la requête, pas la session.
          before: async (_session, context) => ({
            data: {
              twoFactorVerified: CHEMINS_SECOND_FACTEUR.has(context?.path ?? ''),
              ipAddress: null,
              userAgent: null,
            },
          }),
          // Une seule session par compte : une connexion ferme les autres. Sauf la session d'étape
          // d'un compte qui a un TOTP (mot de passe juste, code attendu) : le plugin la supprime
          // aussitôt, et un mot de passe seul ne doit déconnecter personne.
          after: async (session) => {
            const verifiee = (session as { twoFactorVerified?: unknown }).twoFactorVerified === true
            if (!verifiee) {
              const { rows } = await pool.query<{ enabled: boolean | null }>(
                'SELECT "twoFactorEnabled" AS enabled FROM "user" WHERE "id" = $1',
                [session.userId],
              )
              if (rows[0]?.enabled) return
            }
            await pool.query('DELETE FROM "session" WHERE "userId" = $1 AND "id" <> $2', [
              session.userId,
              session.id,
            ])
          },
        },
      },
    },
    rateLimit: {
      // Actif partout (Better Auth ne l'active par défaut qu'en production), compteurs en base :
      // la mémoire d'une fonction Vercel ne survit pas d'un appel à l'autre. Clé : IP et chemin.
      // Lignes échues purgées par purgerAuth (src/lib/auth/purge.ts).
      enabled: true,
      storage: 'database',
      window: 60,
      max: 30,
      customRules: {
        // 5 essais de mot de passe par 15 minutes et par IP (défaut : 3 par 10 secondes).
        [CONNEXION]: { window: FENETRE_FREIN_S, max: 5 },
        // Enrôlement et codes : 10 par 15 minutes et par IP (défaut : 3 par 10 secondes).
        '/two-factor/*': { window: FENETRE_FREIN_S, max: 10 },
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
        // Requête HTTP : liste fermée de routes (déjà filtrée par l'enveloppe).
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
        if (!ctx.request) return

        if (ctx.path === ENROLEMENT) {
          // Enrôlement dans les 24 heures qui suivent la création du compte, pas après.
          const session = await getSessionFromCtx(ctx).catch(() => null)
          const age = session ? Date.now() - new Date(session.user.createdAt).getTime() : 0
          if (age > DELAI_ENROLEMENT_S * 1000) {
            throw APIError.from('FORBIDDEN', {
              code: 'ENROLMENT_WINDOW_CLOSED',
              message: 'Enrolment window closed',
            })
          }
          return
        }

        if (ctx.path === CONNEXION || CHEMINS_SECOND_FACTEUR.has(ctx.path)) {
          const session =
            ctx.path === CONNEXION ? null : await getSessionFromCtx(ctx).catch(() => null)
          const enabled = (session?.user as { twoFactorEnabled?: boolean | null } | undefined)
            ?.twoFactorEnabled
          const retenu: Retenu = session
            ? { acteur: session.user.email, etape: enabled ? 'sans-effet' : 'enrolement' }
            : { acteur: await compteVise(ctx), etape: 'connexion' }
          retenus.set(ctx.request, retenu)
          await freiner(retenu.acteur)
          return
        }

        if (ctx.path === DECONNEXION) {
          const session = await getSessionFromCtx(ctx).catch(() => null)
          if (session) retenus.set(ctx.request, { acteur: session.user.email, etape: 'connexion' })
        }
      }),
      // Journal d'accès (vault_access_log), sans contenu. Une écriture impossible fait échouer la
      // requête : pas de connexion sans trace. Les réponses 429 (limite par IP, verrou par compte,
      // disjoncteur) n'arrivent pas jusqu'ici : l'enveloppe les journalise (`rate_limited`).
      after: createAuthMiddleware(async (ctx) => {
        const retenu = ctx.request ? retenus.get(ctx.request) : undefined
        const acteur = retenu?.acteur ?? ACTEUR_INCONNU
        const resultat = ctx.context.returned
        const echec = isAPIError(resultat)

        if (ctx.path === CONNEXION) {
          if (echec) return journaliser(acteur, 'login_failed')
          const utilisateur = ctx.context.newSession?.user as
            { email: string; twoFactorEnabled?: boolean | null } | undefined
          if (!utilisateur) return
          // TOTP enrôlé : mot de passe juste, le code reste à vérifier.
          return journaliser(
            utilisateur.email,
            utilisateur.twoFactorEnabled ? 'password_ok' : 'login',
          )
        }
        if (CHEMINS_SECOND_FACTEUR.has(ctx.path)) {
          if (echec) return journaliser(acteur, 'login_failed')
          if (retenu?.etape === 'sans-effet') return
          const email = texte((resultat as { user?: { email?: unknown } } | undefined)?.user?.email)
          const action: AccessAction =
            ctx.path === VERIFICATION_SECOURS
              ? 'login_backup_code'
              : retenu?.etape === 'enrolement'
                ? 'totp_enrolled'
                : 'login'
          return journaliser(email ?? acteur, action)
        }
        if (ctx.path === DECONNEXION && !echec && retenu?.acteur) {
          return journaliser(retenu.acteur, 'logout')
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
