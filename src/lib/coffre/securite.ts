// Sécurité des réponses du coffre (story 3.2, partie C ; docs/architecture.md §9.1). Fonctions
// pures, sans dépendance : appelées par src/proxy.ts et testées par node --test.

export function estCheminCoffre(chemin: string): boolean {
  return chemin === '/coffre' || chemin.startsWith('/coffre/')
}

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
export function cspCoffre(nonce: string, options: { dev: boolean; deploye: boolean }): string {
  return [
    "default-src 'self'",
    // Partie D (libsodium en WebAssembly, à vérifier) : ajouter 'wasm-unsafe-eval' ici, et
    // seulement ici. `'unsafe-eval'` : développement seulement (React reconstruit les piles d'erreur).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ''}`,
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
