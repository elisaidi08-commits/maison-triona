import type { Pool } from 'pg'

import type { AuthCoffre } from './auth.ts'
import { MOT_DE_PASSE_MAX, MOT_DE_PASSE_MIN, peutCreerCompte } from './config.ts'

// Création des comptes du coffre, à la main seulement (scripts/coffre-compte.mjs) : les inscriptions
// sont fermées, y compris côté serveur (`disableSignUp`). Deux comptes au plus ; la base double la
// règle d'un déclencheur (db/migrations/0003_auth.sql). Les messages ne citent jamais le mot de passe.

export class CompteRefuse extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompteRefuse'
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function compterComptes(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM "user"')
  return rows[0]?.n ?? 0
}

export async function creerCompte(
  auth: AuthCoffre,
  pool: Pool,
  saisie: { nom: string; email: string; motDePasse: string },
): Promise<{ id: string; email: string; rang: number }> {
  const nom = saisie.nom.trim()
  const email = saisie.email.trim().toLowerCase()
  if (nom.length < 1 || nom.length > 120)
    throw new CompteRefuse('Nom invalide : 1 à 120 caractères')
  if (!EMAIL.test(email) || email.length > 120) throw new CompteRefuse('Adresse e-mail invalide')
  if (saisie.motDePasse.length < MOT_DE_PASSE_MIN || saisie.motDePasse.length > MOT_DE_PASSE_MAX) {
    throw new CompteRefuse(
      `Mot de passe refusé : ${MOT_DE_PASSE_MIN} à ${MOT_DE_PASSE_MAX} caractères`,
    )
  }

  const nombre = await compterComptes(pool)
  if (!peutCreerCompte(nombre)) throw new CompteRefuse('Deux comptes au plus : création refusée')

  const contexte = await auth.$context
  if (await contexte.internalAdapter.findUserByEmail(email)) {
    throw new CompteRefuse('Un compte existe déjà pour cette adresse')
  }

  const empreinte = await contexte.password.hash(saisie.motDePasse)
  let utilisateur
  try {
    // Création par une administratrice ou un administrateur (source « admin » de Better Auth).
    utilisateur = await contexte.internalAdapter.createUser(
      { email, name: nom },
      { method: 'admin' },
    )
  } catch (error) {
    // Déclencheur des deux comptes (création simultanée) : même refus, sans détail de la base.
    if ((error as { code?: unknown })?.code === '23514') {
      throw new CompteRefuse('Deux comptes au plus : création refusée')
    }
    throw new Error('Création du compte impossible')
  }
  try {
    // Même compte « credential » que l'inscription de Better Auth (empreinte scrypt).
    await contexte.internalAdapter.linkAccount({
      userId: utilisateur.id,
      providerId: 'credential',
      accountId: utilisateur.id,
      password: empreinte,
    })
  } catch {
    await contexte.internalAdapter.deleteUser(utilisateur.id)
    throw new Error('Création du compte impossible')
  }
  return { id: utilisateur.id, email, rang: nombre + 1 }
}
