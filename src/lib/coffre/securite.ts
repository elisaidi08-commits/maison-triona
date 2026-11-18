// Sécurité des réponses du coffre (story 3.2, partie C ; docs/architecture.md §9.1). Fonctions
// pures, sans dépendance : appelées par src/proxy.ts et testées par node --test.

export function estCheminCoffre(chemin: string): boolean {
  return chemin === '/coffre' || chemin.startsWith('/coffre/')
}

// Page d'une demande (/coffre/demandes/<uuid>, partie D) dont l'identifiant n'est pas un UUID : le
// proxy répond 404 sans rendre la page. Même motif que l'identifiant de src/lib/vault/repository.ts.
const CHEMIN_DEMANDE = /^\/coffre\/demandes\/([^/]+)\/?$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Pages de lecture des demandes (/coffre/demandes/…) : les seules qui chargent libsodium, donc les
// seules dont la CSP admet WebAssembly (`cspCoffre`, option `wasm`).
export function estCheminLecture(chemin: string): boolean {
  return chemin.startsWith('/coffre/demandes/')
}

export function cheminDemandeMalForme(chemin: string): boolean {
  const segment = chemin.match(CHEMIN_DEMANDE)?.[1]
  return segment !== undefined && !UUID.test(segment)
}

// Réponse du proxy à cette adresse : HTML minimal, sans script ni style (aucun nonce à poser), sans
// rien citer de l'adresse demandée. Une adresse mal formée ne vient que d'une saisie à la main.
export const PAGE_INTROUVABLE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>Introuvable · Coffre · Maison Triona</title>
</head>
<body>
<main id="contenu">
<h1>Introuvable</h1>
<p>Cette demande n’existe pas, ou elle a été effacée.</p>
<p><a href="/coffre">Retour à la liste des demandes</a></p>
</main>
</body>
</html>
`

// Nonce de 128 bits, neuf à chaque requête (Web Crypto : disponible dans le proxy comme sous Node).
export function creerNonce(): string {
  const octets = new Uint8Array(16)
  crypto.getRandomValues(octets)
  return btoa(String.fromCharCode(...octets))
}

// CSP à nonce du coffre, posée par le proxy (guide Next.js « Content Security Policy ») : Next lit
// le nonce dans l'en-tête de la requête et l'ajoute à ses scripts et styles en ligne, ce qui exige
// un rendu à chaque requête (src/app/coffre/layout.tsx). Aucun `'unsafe-inline'` en production.
// Le coffre affichera du texte saisi par des inconnus : il est toujours rendu comme texte.
export function cspCoffre(
  nonce: string,
  options: { dev: boolean; deploye: boolean; wasm: boolean },
): string {
  return [
    "default-src 'self'",
    // `'wasm-unsafe-eval'` (partie D), sur les pages de lecture seulement (`wasm`, voir
    // estCheminLecture) : elles déchiffrent dans le navigateur avec libsodium, qui n'existe qu'en
    // WebAssembly (`WebAssembly.instantiate`, sans repli JavaScript) ; il autorise la compilation
    // de WebAssembly, pas `eval()` ni `new Function`. Ni la connexion, ni la liste, ni le site public
    // (next.config.ts) ne l'ont. `'unsafe-eval'` : développement seulement (React reconstruit les
    // piles d'erreur).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.wasm ? " 'wasm-unsafe-eval'" : ''}${options.dev ? " 'unsafe-eval'" : ''}`,
    // Styles en ligne du serveur de développement seulement ; en production, le nonce suffit.
    `style-src 'self' ${options.dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // Seulement une fois déployé : en local (http), il ferait demander les fichiers en https.
    ...(options.deploye ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}
