// Comptes du coffre (story 3.2, partie C ; docs/coffre-cles.md §7). À lancer à la main :
//   npm run coffre:compte -- --nom "Prénom Nom" --email adresse@exemple.be
//   npm run coffre:compte -- --reenroler --email adresse@exemple.be
// Le mot de passe est généré (35 caractères) et affiché une seule fois, à recopier aussitôt dans un
// gestionnaire de mots de passe. Avec --saisir, il est lu sur l'entrée standard (saisie masquée et
// confirmée au terminal, ou première ligne d'un tube) et refusé sous 24 caractères. Jamais en
// argument : il resterait dans l'historique du shell et dans la liste des processus.
// --reenroler : supprime le compte (sessions, TOTP, codes de secours) et le recrée sous le même nom,
// avec un nouveau mot de passe ; en présence des deux personnes (procédure).
// Deux comptes au plus (la base le refuse aussi). Base visée : COFFRE_DATABASE_URL, compte du coffre
// (et DATABASE_CA_CERT sur Vercel). Ensuite, dans les 24 heures : se connecter sur
// /coffre/connexion et enrôler le TOTP.
import { parseArgs } from 'node:util'

import { creerAuth } from '../src/lib/auth/auth.ts'
import {
  CompteRefuse,
  creerCompte,
  genererMotDePasse,
  reenrolerCompte,
} from '../src/lib/auth/comptes.ts'
import { MAX_COMPTES, MOT_DE_PASSE_MIN } from '../src/lib/auth/config.ts'
import { getCoffrePool } from '../src/lib/db/pool.ts'

const USAGE =
  'Usage : npm run coffre:compte -- --nom "Prénom Nom" --email adresse [--saisir], ' +
  'ou --reenroler --email adresse [--saisir]'

function lireArguments() {
  let lus
  try {
    lus = parseArgs({
      options: {
        nom: { type: 'string' },
        email: { type: 'string' },
        saisir: { type: 'boolean' },
        reenroler: { type: 'boolean' },
      },
      strict: true,
      allowPositionals: true,
    })
  } catch {
    // Message générique : ne jamais recopier ce qui a été tapé (un mot de passe, peut-être).
    throw new CompteRefuse(`Option refusée. Aucun mot de passe en argument. ${USAGE}`)
  }
  if (lus.positionals.length > 0) {
    throw new CompteRefuse(`Argument refusé. Aucun mot de passe en argument. ${USAGE}`)
  }
  const { nom, email, saisir = false, reenroler = false } = lus.values
  if (!email || (!reenroler && !nom) || (reenroler && nom)) throw new CompteRefuse(USAGE)
  return { nom, email, saisir, reenroler }
}

// Saisie au terminal, sans écho. Entrée valide, Ctrl+C interrompt, la touche d'effacement efface.
function saisieMasquee(invite) {
  const { stdin, stderr } = process
  return new Promise((resolve, reject) => {
    let saisie = ''
    const terminer = (erreur) => {
      stdin.off('data', surDonnees)
      stdin.setRawMode(false)
      stdin.pause()
      stderr.write('\n')
      if (erreur) reject(erreur)
      else resolve(saisie)
    }
    const surDonnees = (morceau) => {
      for (const caractere of morceau) {
        if (caractere === '\r' || caractere === '\n' || caractere === '\u0004') return terminer()
        if (caractere === '\u0003') return terminer(new CompteRefuse('Saisie interrompue'))
        if (caractere === '\u007f' || caractere === '\b') saisie = [...saisie].slice(0, -1).join('')
        else saisie += caractere
      }
    }
    stderr.write(invite)
    stdin.setEncoding('utf8')
    stdin.setRawMode(true)
    stdin.resume()
    stdin.on('data', surDonnees)
  })
}

async function lireMotDePasse() {
  if (process.stdin.isTTY) {
    const premier = await saisieMasquee(`Mot de passe (${MOT_DE_PASSE_MIN} caractères au moins) : `)
    const second = await saisieMasquee('Confirmer le mot de passe : ')
    if (premier !== second) throw new CompteRefuse('Les deux saisies diffèrent : rien n’est créé')
    return premier
  }
  let texte = ''
  process.stdin.setEncoding('utf8')
  for await (const morceau of process.stdin) texte += morceau
  return texte.split(/\r?\n/)[0] ?? ''
}

let pool
try {
  const { nom, email, saisir, reenroler } = lireArguments()
  const motDePasse = saisir ? await lireMotDePasse() : genererMotDePasse()
  pool = getCoffrePool()
  const auth = creerAuth(pool)
  const compte = reenroler
    ? await reenrolerCompte(auth, { email, motDePasse })
    : await creerCompte(auth, pool, { nom, email, motDePasse })
  console.log(
    reenroler
      ? `Compte recréé : ${compte.email}. Ancien mot de passe, TOTP, codes de secours et sessions supprimés.`
      : `Compte créé : ${compte.email} (${compte.rang} sur ${MAX_COMPTES}).`,
  )
  if (!saisir) {
    console.log(
      'Mot de passe, affiché une seule fois : à enregistrer maintenant dans un gestionnaire de mots de passe.',
    )
    console.log(motDePasse)
  }
  console.log(
    'Prochaine étape, dans les 24 heures : se connecter sur /coffre/connexion et enrôler le TOTP.',
  )
} catch (error) {
  // Message seul (jamais l'URL de connexion ni une saisie) ; refus attendus en clair.
  console.error(error instanceof Error ? error.message : 'Opération impossible')
  process.exitCode = 1
} finally {
  await pool?.end()
}
