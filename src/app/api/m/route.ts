import { after } from 'next/server'
import { construireEvenement } from '@/lib/mesure/evenements'
import { envoiDuSite, ipVisiteur, lireConfigMesure, transmettre } from '@/lib/mesure/plausible'
import { limiterDebit } from '@/lib/rate-limit'
import { empreinte, reseauIp } from '@/lib/security/empreinte'
import { secretFormulaire } from '@/lib/security/secret'

// Mesure d'audience (story 5.2) : le navigateur envoie ici une page vue ou un événement de la liste
// fermée (`navigator.sendBeacon`, même origine, aucun cookie) ; le serveur le transmet à Plausible
// après la réponse. Toujours 204, sans corps : la route ne dit rien de ce qu'elle a fait.
// Sans PLAUSIBLE_DOMAIN (ou SITE_URL), et sur un aperçu Vercel, rien ne part. Aucune journalisation.
// Abus (relecture sécurité du 20/11/2026) : seuls les envois de notre site sont gardés
// (`Sec-Fetch-Site` ou `Origin`), et 60 par minute au plus par réseau (empreinte de l'IP, clé du
// jour, comme la demande de lien). Sans Upstash ou en panne, la mesure passe : ce ne sont que des
// totaux.
// Segment config : comme /api/cron/envoi, aucun `dynamic` (retiré avec `cacheComponents`) ; un
// POST n'est jamais prérendu.

const TAILLE_MAX = 1024
const LIMITE = { maximum: 60, fenetreSecondes: 60 }

function vide(): Response {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request): Promise<Response> {
  let config
  try {
    config = lireConfigMesure(process.env)
  } catch {
    return vide()
  }
  if (config === null) return vide()
  if (!envoiDuSite(request.headers, config.siteUrl)) return vide()

  const longueur = Number(request.headers.get('content-length') ?? '0')
  if (!Number.isFinite(longueur) || longueur > TAILLE_MAX) return vide()
  const texte = await request.text().catch(() => '')
  if (texte.length === 0 || texte.length > TAILLE_MAX) return vide()

  let corps: unknown
  try {
    corps = JSON.parse(texte)
  } catch {
    return vide()
  }
  if (typeof corps !== 'object' || corps === null) return vide()
  const { e, p, r } = corps as Record<string, unknown>
  if (typeof e !== 'string' || typeof p !== 'string') return vide()

  const evenement = construireEvenement({
    evenement: e,
    chemin: p,
    referent: typeof r === 'string' ? r : null,
    siteUrl: config.siteUrl,
    domaine: config.domaine,
  })
  if (evenement === null) return vide()

  const userAgent = request.headers.get('user-agent')
  const ip = ipVisiteur(request.headers)
  if (ip === null) return vide()
  const secret = secretFormulaire()
  after(async () => {
    if (secret !== null) {
      const jour = new Date()
      const debit = await limiterDebit([
        { cle: `mesure-ip:${empreinte(reseauIp(ip), secret, jour)}`, ...LIMITE },
      ])
      if (debit.statut === 'refuse') return
    }
    await transmettre({ evenement, userAgent, ip })
  })
  return vide()
}
