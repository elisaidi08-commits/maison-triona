// Crée un compte du coffre (story 3.2, partie C ; docs/architecture.md §6.5). À lancer à la main :
//   npm run coffre:compte -- --nom "Prénom Nom" --email adresse@exemple.be
// Le mot de passe est lu sur l'entrée standard : saisie masquée et confirmée au terminal, ou
// première ligne d'un tube. Jamais en argument : il resterait dans l'historique du shell et dans la
// liste des processus. Deux comptes au plus (la base le refuse aussi).
// Base visée : DATABASE_URL (et DATABASE_CA_CERT en production). Ensuite, sans attendre : se
// connecter sur /coffre/connexion et enrôler le TOTP (une session sans TOTP ne sert qu'à cela).
import { parseArgs } from 'node:util'

import { creerAuth } from '../src/lib/auth/auth.ts'
import { CompteRefuse, creerCompte } from '../src/lib/auth/comptes.ts'
import { MAX_COMPTES, MOT_DE_PASSE_MIN } from '../src/lib/auth/config.ts'
import { getPool } from '../src/lib/db/pool.ts'

const USAGE = 'Usage : npm run coffre:compte -- --nom "Prénom Nom" --email adresse@exemple.be'

function lireArguments() {
  let lus
  try {
    lus = parseArgs({
      options: { nom: { type: 'string' }, email: { type: 'string' } },
      strict: true,
      allowPositionals: true,
    })
  } catch {
    // Message générique : ne jamais recopier ce qui a été tapé (un mot de passe, peut-être).
    throw new CompteRefuse(`Option refusée. Le mot de passe se saisit après le lancement. ${USAGE}`)
  }
  if (lus.positionals.length > 0) {
    throw new CompteRefuse(
      `Argument refusé. Le mot de passe se saisit après le lancement. ${USAGE}`,
    )
  }
  const { nom, email } = lus.values
  if (!nom || !email) throw new CompteRefuse(USAGE)
  return { nom, email }
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
  const { nom, email } = lireArguments()
  const motDePasse = await lireMotDePasse()
  pool = getPool()
  const auth = creerAuth(pool)
  const compte = await creerCompte(auth, pool, { nom, email, motDePasse })
  console.log(
    `Compte créé : ${compte.email} (${compte.rang} sur ${MAX_COMPTES}). Prochaine étape : se ` +
      'connecter sur /coffre/connexion et enrôler le TOTP.',
  )
} catch (error) {
  // Message seul (jamais l'URL de connexion ni une saisie) ; refus attendus en clair.
  console.error(
    error instanceof CompteRefuse || error instanceof Error
      ? error.message
      : 'Création du compte impossible',
  )
  process.exitCode = 1
} finally {
  await pool?.end()
}
