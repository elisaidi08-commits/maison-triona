import { after } from 'next/server'
import { construireEvenement } from '@/lib/mesure/evenements'
import { ipVisiteur, lireConfigMesure, transmettre } from '@/lib/mesure/plausible'

// Mesure d'audience (story 5.2) : le navigateur envoie ici une page vue ou un événement de la liste
// fermée (`navigator.sendBeacon`, même origine, aucun cookie) ; le serveur le transmet à Plausible
// après la réponse. Toujours 204, sans corps : la route ne dit rien de ce qu'elle a fait.
// Sans PLAUSIBLE_DOMAIN (ou SITE_URL), rien ne part. Aucune journalisation.
// Segment config : comme /api/cron/envoi, aucun `dynamic` (retiré avec `cacheComponents`) ; un
// POST n'est jamais prérendu.

const TAILLE_MAX = 1024

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
  after(() => transmettre({ evenement, userAgent, ip }))
  return vide()
}
