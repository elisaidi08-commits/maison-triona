// Doubles de test des deux services appelés par le serveur pendant une demande de lien (story 3.9,
// tests/e2e/demande-de-lien-parcours.spec.ts), en mémoire, sur 127.0.0.1 seulement :
// - Upstash Redis, API REST `POST /multi-exec` (src/lib/rate-limit.ts) : `SET clé valeur EX n NX` et
//   `INCR clé`, avec expiration ; de quoi prouver les limites par IP et par adresse ;
// - Scaleway TEM (src/lib/email/tem.ts) : `POST …/emails` garde le message et répond un identifiant ;
//   `GET …/emails/<id>` répond « sent ». Le serveur testé y est redirigé par rediriger-tem.mjs.
// Pour le test : `GET /__emails` (messages reçus), `POST /__reset` (tout effacer), `POST /__cle`
// (poser un compteur, `{ cle, valeur, duree }` : plafond global du jour), `GET /__cle?cle=…` (lire
// un compteur), `GET /` (prêt).
// Jamais déployé, jamais importé par le site : lancé par playwright.config.ts (projet `reservation`).
// Données factices uniquement.
import { createServer } from 'node:http'

const port = Number(process.argv[2] ?? 3201)
const JETON_UPSTASH = process.env.FAUX_UPSTASH_TOKEN ?? 'jeton-factice-upstash-e2e'
const CHEMIN_TEM = '/transactional-email/v1alpha1/regions/fr-par/emails'

/** @type {Map<string, { valeur: string, expire: number }>} */
const cles = new Map()
/** @type {{ id: string, to: string, subject: string, text: string, from: unknown }[]} */
let emails = []
let compteur = 0

function lire(cle) {
  const entree = cles.get(cle)
  if (!entree) return undefined
  if (entree.expire <= Date.now()) {
    cles.delete(cle)
    return undefined
  }
  return entree
}

function executer(commande) {
  const [nom, cle, valeur, ...options] = commande.map(String)
  if (nom === 'SET') {
    const nx = options.includes('NX')
    const ex = options.indexOf('EX')
    const duree = ex >= 0 ? Number(options[ex + 1]) : 3600
    if (nx && lire(cle)) return { result: null }
    cles.set(cle, { valeur, expire: Date.now() + duree * 1000 })
    return { result: 'OK' }
  }
  if (nom === 'INCR') {
    const entree = lire(cle) ?? { valeur: '0', expire: Date.now() + 3600 * 1000 }
    const suite = Number(entree.valeur) + 1
    cles.set(cle, { valeur: String(suite), expire: entree.expire })
    return { result: suite }
  }
  return { error: `ERR unknown command ${nom}` }
}

function corps(requete) {
  return new Promise((resolve, reject) => {
    const morceaux = []
    requete.on('data', (morceau) => morceaux.push(morceau))
    requete.on('end', () => resolve(Buffer.concat(morceaux).toString('utf8')))
    requete.on('error', reject)
  })
}

function json(reponse, statut, valeur) {
  reponse.writeHead(statut, { 'Content-Type': 'application/json' })
  reponse.end(JSON.stringify(valeur))
}

createServer(async (requete, reponse) => {
  const chemin = new URL(requete.url ?? '/', 'http://127.0.0.1').pathname
  try {
    if (requete.method === 'GET' && chemin === '/') return json(reponse, 200, { ok: true })
    if (requete.method === 'GET' && chemin === '/__emails') return json(reponse, 200, emails)
    if (requete.method === 'POST' && chemin === '/__reset') {
      cles.clear()
      emails = []
      return json(reponse, 200, { ok: true })
    }
    if (requete.method === 'GET' && chemin === '/__cle') {
      const cle = new URL(requete.url ?? '/', 'http://127.0.0.1').searchParams.get('cle') ?? ''
      return json(reponse, 200, { valeur: lire(cle)?.valeur ?? null })
    }
    if (requete.method === 'POST' && chemin === '/__cle') {
      const { cle, valeur, duree } = JSON.parse(await corps(requete))
      cles.set(String(cle), { valeur: String(valeur), expire: Date.now() + Number(duree) * 1000 })
      return json(reponse, 200, { ok: true })
    }
    if (requete.method === 'POST' && chemin === '/multi-exec') {
      if (requete.headers.authorization !== `Bearer ${JETON_UPSTASH}`) {
        return json(reponse, 401, { error: 'Unauthorized' })
      }
      const commandes = JSON.parse(await corps(requete))
      return json(reponse, 200, commandes.map(executer))
    }
    if (requete.method === 'POST' && chemin === CHEMIN_TEM) {
      const message = JSON.parse(await corps(requete))
      compteur += 1
      const id = `faux-${compteur}`
      emails.push({
        id,
        from: message.from,
        to: message.to?.[0]?.email,
        subject: message.subject,
        text: message.text,
      })
      return json(reponse, 200, { emails: [{ id }] })
    }
    if (requete.method === 'GET' && chemin.startsWith(`${CHEMIN_TEM}/`)) {
      return json(reponse, 200, { status: 'sent', flags: [] })
    }
    return json(reponse, 404, { error: 'introuvable' })
  } catch {
    return json(reponse, 400, { error: 'requête illisible' })
  }
}).listen(port, '127.0.0.1')
