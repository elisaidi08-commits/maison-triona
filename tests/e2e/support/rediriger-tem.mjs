// Chargé par le seul serveur du parcours de la demande de lien (projet Playwright `reservation`,
// `NODE_OPTIONS=--import`), jamais par le site déployé : redirige les appels du serveur vers
// l'API de Scaleway TEM sur le double de test (faux-services.mjs, `FAUX_TEM_URL`), pour capturer
// l'e-mail d'accès sans rien changer au code du site (src/lib/email/tem.ts garde son adresse fixe).
// Tout autre appel passe tel quel.
const ORIGINE_TEM = 'https://api.scaleway.com/transactional-email/'
const cible = process.env.FAUX_TEM_URL

if (cible) {
  const original = globalThis.fetch
  globalThis.fetch = (entree, options) => {
    const url =
      typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url
    if (typeof url === 'string' && url.startsWith(ORIGINE_TEM)) {
      const redirigee = `${cible.replace(/\/+$/, '')}/transactional-email/${url.slice(ORIGINE_TEM.length)}`
      return original(redirigee, options)
    }
    return original(entree, options)
  }
}
