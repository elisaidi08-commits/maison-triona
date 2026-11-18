import { randomInt } from 'node:crypto'

import type { Pool } from 'pg'

import type { AuthCoffre } from './auth.ts'
import { MOT_DE_PASSE_MAX, MOT_DE_PASSE_MIN, peutCreerCompte } from './config.ts'

// Comptes du coffre, à la main seulement (scripts/coffre-compte.mjs) : les inscriptions sont
// fermées, y compris côté serveur (`disableSignUp`). Deux comptes au plus ; la base double la règle
// d'un déclencheur (db/migrations/0003_auth.sql). Les messages ne citent jamais le mot de passe.

export class CompteRefuse extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CompteRefuse'
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Mot de passe généré : 6 groupes de 5 caractères (35 avec les tirets), sans caractère ambigu
// (ni 0/o, ni 1/l/i) : environ 148 bits, à recopier dans un gestionnaire de mots de passe.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function genererMotDePasse(): string {
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''),
  ).join('-')
}

export async function compterComptes(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM "user"')
  return rows[0]?.n ?? 0
}

function verifierMotDePasse(motDePasse: string): void {
  if (motDePasse.length < MOT_DE_PASSE_MIN || motDePasse.length > MOT_DE_PASSE_MAX) {
    throw new CompteRefuse(
      `Mot de passe refusé : ${MOT_DE_PASSE_MIN} à ${MOT_DE_PASSE_MAX} caractères`,
    )
  }
}

function adresse(email: string): string {
  const normalisee = email.trim().toLowerCase()
  if (!EMAIL.test(normalisee) || normalisee.length > 120) {
    throw new CompteRefuse('Adresse e-mail invalide')
  }
  return normalisee
}

// Utilisateur et compte « credential », comme l'inscription de Better Auth (empreinte scrypt).
async function inscrire(
  auth: AuthCoffre,
  nom: string,
  email: string,
  motDePasse: string,
): Promise<string> {
  const contexte = await auth.$context
  const empreinte = await contexte.password.hash(motDePasse)
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
  return utilisateur.id
}

export async function creerCompte(
  auth: AuthCoffre,
  pool: Pool,
  saisie: { nom: string; email: string; motDePasse: string },
): Promise<{ id: string; email: string; rang: number }> {
  const nom = saisie.nom.trim()
  if (nom.length < 1 || nom.length > 120) {
    throw new CompteRefuse('Nom invalide : 1 à 120 caractères')
  }
  const email = adresse(saisie.email)
  verifierMotDePasse(saisie.motDePasse)

  const nombre = await compterComptes(pool)
  if (!peutCreerCompte(nombre)) throw new CompteRefuse('Deux comptes au plus : création refusée')
  const contexte = await auth.$context
  if (await contexte.internalAdapter.findUserByEmail(email)) {
    throw new CompteRefuse('Un compte existe déjà pour cette adresse')
  }
  const id = await inscrire(auth, nom, email, saisie.motDePasse)
  return { id, email, rang: nombre + 1 }
}

// Réenrôlement (TOTP perdu, délai de 24 heures dépassé) : le compte est supprimé (sessions, TOTP et
// codes de secours avec lui) puis recréé sous le même nom et la même adresse, avec un nouveau mot de
// passe. Le TOTP se réenrôle ensuite dans les 24 heures. Procédure : docs/coffre-cles.md §7.
export async function reenrolerCompte(
  auth: AuthCoffre,
  saisie: { email: string; motDePasse: string },
): Promise<{ id: string; email: string }> {
  const email = adresse(saisie.email)
  verifierMotDePasse(saisie.motDePasse)
  const contexte = await auth.$context
  const existant = await contexte.internalAdapter.findUserByEmail(email)
  if (!existant) throw new CompteRefuse('Aucun compte pour cette adresse')
  await contexte.internalAdapter.deleteUser(existant.user.id)
  const id = await inscrire(auth, existant.user.name, email, saisie.motDePasse)
  return { id, email }
}
