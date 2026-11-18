import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { cspCoffre } from '../../src/lib/coffre/securite'

// Aller-retour du chiffrement du coffre (story 3.2, partie D), sans aucune API de Node côté lecture :
// - côté serveur (Node), comme `npm run vault:keys` et la Server Action du formulaire : deux paquets
//   de clé (une paire « ancienne », une « nouvelle », pour une rotation), puis une demande scellée
//   avec l'ancienne clé publique ;
// - côté navigateur (Chromium), sous la CSP du coffre, les modules de src/lib/vault tels quels (types
//   retirés) et libsodium depuis node_modules : chaque paquet est essayé, la demande s'ouvre.
// Pages servies par Playwright (page.route) : ni serveur Next, ni base, ni réseau. Données factices.

// Playwright charge ce fichier en CommonJS : `__dirname`, pas `import.meta`.
const RACINE = `${resolve(__dirname, '../..')}/`
const ORIGINE = 'http://dechiffrement.test'
const NONCE = 'bm9uY2UtZGUtdGVzdC0xMjM0'
const PHRASE = 'phrase factice de test, assez longue'
const CHAMPS = {
  nom: 'Personne Factice',
  email: 'personne@exemple.test',
  telephone: null,
  pourQui: 'proche',
  creneau: 'soir',
  message: 'Témoin du déchiffrement : « é », ligne 1.\nLigne 2 <b>pas du HTML</b>.',
}
const MODULES = ['open', 'key-packet', 'seal', 'sodium']
const SODIUM: Record<string, string> = {
  '/sodium/libsodium-wrappers.mjs':
    'node_modules/libsodium-wrappers-sumo/dist/modules-sumo-esm/libsodium-wrappers.mjs',
  '/sodium/libsodium-sumo.mjs':
    'node_modules/libsodium-sumo/dist/modules-sumo-esm/libsodium-sumo.mjs',
}

interface Jeu {
  paquets: unknown[]
  scelle: string
}

// Côté serveur : un sous-processus Node, la phrase passée par l'environnement (jamais en argument).
function preparer(): Jeu {
  const url = (chemin: string) => pathToFileURL(`${RACINE}${chemin}`).href
  const script = `
    import { createKeyPacket } from ${JSON.stringify(url('src/lib/vault/key-packet.ts'))}
    import { sealRequest } from ${JSON.stringify(url('src/lib/vault/seal.ts'))}
    const ancien = await createKeyPacket(process.env.PHRASE)
    const nouveau = await createKeyPacket(process.env.PHRASE)
    const octets = await sealRequest(JSON.parse(process.env.CHAMPS), ancien.publicKey)
    process.stdout.write(JSON.stringify({
      paquets: [nouveau.packet, ancien.packet],
      scelle: Buffer.from(octets).toString('base64'),
    }))
  `
  const sortie = execFileSync(
    process.execPath,
    ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON', '--input-type=module', '-e', script],
    { cwd: RACINE, env: { ...process.env, PHRASE, CHAMPS: JSON.stringify(CHAMPS) } },
  )
  return JSON.parse(sortie.toString('utf8')) as Jeu
}

const PAGE = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Déchiffrement</title>
<script type="importmap" nonce="${NONCE}">${JSON.stringify({
  imports: {
    'libsodium-wrappers-sumo': '/sodium/libsodium-wrappers.mjs',
    'libsodium-sumo': '/sodium/libsodium-sumo.mjs',
  },
})}</script>
<script type="module" nonce="${NONCE}">
  import { openSealed, unlockPrivateKey } from '/vault/open.ts'
  import { fromBase64, loadSodium } from '/vault/sodium.ts'
  // Comme src/app/coffre/_composants/LectureDemande.tsx : chaque paquet, puis chaque clé.
  window.ouvrir = async (paquets, phrase, scelle) => {
    const lib = await loadSodium()
    const cles = []
    for (const paquet of paquets) {
      try { cles.push(await unlockPrivateKey(paquet, phrase)) } catch {}
    }
    if (cles.length === 0) return { erreur: 'phrase' }
    const octets = fromBase64(lib, scelle)
    for (const cle of cles) {
      try { return { champs: await openSealed(octets, cle), cles: cles.length } } catch {}
    }
    return { erreur: 'autre-cle', cles: cles.length }
  }
  window.apiNode = ['process', 'Buffer', 'require', 'module', 'global', '__dirname']
    .filter((nom) => typeof globalThis[nom] !== 'undefined')
  document.body.dataset.pret = 'oui'
</script></head><body></body></html>`

async function servir(page: Page, csp: string): Promise<string[]> {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text())
  })
  await page.route(`${ORIGINE}/**`, async (route) => {
    const { pathname } = new URL(route.request().url())
    if (pathname === '/') {
      return route.fulfill({
        contentType: 'text/html; charset=utf-8',
        headers: { 'content-security-policy': csp },
        body: PAGE,
      })
    }
    const nom = pathname.match(/^\/vault\/([a-z-]+)\.ts$/)?.[1]
    if (nom && MODULES.includes(nom)) {
      const source = readFileSync(`${RACINE}src/lib/vault/${nom}.ts`, 'utf8')
      return route.fulfill({
        contentType: 'text/javascript; charset=utf-8',
        body: stripTypeScriptTypes(source),
      })
    }
    const fichier = SODIUM[pathname]
    if (fichier) {
      return route.fulfill({
        contentType: 'text/javascript; charset=utf-8',
        body: readFileSync(`${RACINE}${fichier}`, 'utf8'),
      })
    }
    return route.fulfill({ status: 404, body: '' })
  })
  await page.goto(`${ORIGINE}/`)
  await expect(page.locator('body')).toHaveAttribute('data-pret', 'oui')
  return violations
}

test.describe('déchiffrement dans le navigateur', () => {
  // Deux paquets Argon2id « moderate » (256 Mio) côté Node, puis leur ouverture côté navigateur.
  test.describe.configure({ timeout: 120_000 })
  let jeu: Jeu
  test.beforeAll(() => {
    jeu = preparer()
  })

  test('ouvre la demande sous la CSP du coffre, après une rotation, sans API de Node', async ({
    page,
  }) => {
    const violations = await servir(
      page,
      cspCoffre(NONCE, { dev: false, deploye: false, wasm: true }),
    )
    expect(await page.evaluate(() => (window as unknown as { apiNode: string[] }).apiNode)).toEqual(
      [],
    )
    const resultat = await page.evaluate(
      ([paquets, phrase, scelle]) =>
        (
          window as unknown as {
            ouvrir: (p: unknown, f: string, s: string) => Promise<unknown>
          }
        ).ouvrir(paquets, phrase, scelle),
      [jeu.paquets, PHRASE, jeu.scelle] as const,
    )
    // Les deux paquets se déverrouillent ; seule l'ancienne clé ouvre la demande.
    expect(resultat).toEqual({ champs: CHAMPS, cles: 2 })
    expect(violations).toEqual([])
  })

  test('une autre phrase n’ouvre rien', async ({ page }) => {
    await servir(page, cspCoffre(NONCE, { dev: false, deploye: false, wasm: true }))
    const resultat = await page.evaluate(
      ([paquets, scelle]) =>
        (
          window as unknown as {
            ouvrir: (p: unknown, f: string, s: string) => Promise<unknown>
          }
        ).ouvrir(paquets, 'une autre phrase, assez longue', scelle),
      [jeu.paquets, jeu.scelle] as const,
    )
    expect(resultat).toEqual({ erreur: 'phrase' })
  })

  test('le seul nouveau paquet ne suffit pas pour une demande scellée avant la rotation', async ({
    page,
  }) => {
    await servir(page, cspCoffre(NONCE, { dev: false, deploye: false, wasm: true }))
    const resultat = await page.evaluate(
      ([paquets, phrase, scelle]) =>
        (
          window as unknown as {
            ouvrir: (p: unknown, f: string, s: string) => Promise<unknown>
          }
        ).ouvrir(paquets, phrase, scelle),
      [[jeu.paquets[0]], PHRASE, jeu.scelle] as const,
    )
    expect(resultat).toEqual({ erreur: 'autre-cle', cles: 1 })
  })

  test('sans wasm-unsafe-eval, libsodium ne démarre pas (témoin de la CSP)', async ({ page }) => {
    const sansWasm = cspCoffre(NONCE, { dev: false, deploye: false, wasm: false })
    await servir(page, sansWasm)
    const resultat = await page.evaluate(
      ([paquets, phrase, scelle]) =>
        (
          window as unknown as {
            ouvrir: (p: unknown, f: string, s: string) => Promise<unknown>
          }
        )
          .ouvrir(paquets, phrase, scelle)
          .then(
            () => 'ouvert',
            () => 'refusé',
          ),
      [jeu.paquets, PHRASE, jeu.scelle] as const,
    )
    expect(resultat).toBe('refusé')
  })
})
