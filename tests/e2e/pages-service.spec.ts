import { expect, test } from '@playwright/test'

// Stories 2.13 et 2.14 : les services, cœur du site. Chaque page de service se lit seule (scène,
// fiche en trois chapitres, bloc Contact) ; la page Services est la vue d'ensemble, en une scène
// immersive (M23, D56) en desktop avec souris. Intertitres et liens comptés dans le contenu
// (`main`) : le pied de page (D54) a ses propres intertitres et liens vers les services.

const BLOCS_FR = [
  'Quelques situations',
  'Comment ça se passe',
  'Ce qu’il faut savoir',
  'Les autres services',
  'Parlons-en, en toute discrétion.',
]

for (const [path, autres] of [
  ['/fr/services/conciergerie', ['/fr/services/grand-age', '/fr/services/enfants']],
  ['/fr/services/grand-age', ['/fr/services/conciergerie', '/fr/services/enfants']],
  ['/fr/services/enfants', ['/fr/services/conciergerie', '/fr/services/grand-age']],
] as const) {
  test(`${path} présente le service en entier, dans l’ordre`, async ({ page }) => {
    await page.goto(path)
    const main = page.locator('main')
    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1)
    await expect(main.getByRole('heading', { level: 2 })).toHaveText(BLOCS_FR)
    // Le texte du service est écrit (plus de « [CONTENU À FOURNIR PAR CAT] » à sa place).
    await expect(main).not.toContainText('CONTENU À FOURNIR')
    await expect(main.locator('img').first()).toBeVisible()
    await expect(main.locator('#situations li')).toHaveCount(3)
    await expect(main.locator('#deroule ol > li')).toHaveCount(6)
    await expect(main.locator('#a-savoir h3')).toHaveCount(4)
    // Formulaire sans paramètre : la présélection passera par le stockage de session (D26).
    await expect(main.locator('a[href*="?service="]')).toHaveCount(0)
    await expect(main.locator('a[href="/fr/contact"]')).toHaveCount(2)
    await expect(main.locator('a[href="/fr/confidentialite"]')).toHaveCount(1)
    for (const autre of autres) await expect(main.locator(`a[href="${autre}"]`)).toHaveCount(1)
  })
}

test('les pages de service en anglais ont la même structure', async ({ page }) => {
  // Adresse anglaise du grand âge : « later-life » (D47).
  await page.goto('/en/services/later-life')
  const main = page.locator('main')
  await expect(main.getByRole('heading', { level: 2 })).toHaveCount(BLOCS_FR.length)
  await expect(main.locator('#deroule ol > li')).toHaveCount(6)
  await expect(page.getByText(/For any medical need, we will refer you/)).toBeVisible()
  await expect(main.locator('a[href="/en/privacy"]')).toHaveCount(1)
})

// Phrase sans « soins » (mot banni par Cat, D39) ; aucune promesse médicale.
test('le grand âge oriente vers les professionnels de santé', async ({ page }) => {
  await page.goto('/fr/services/grand-age')
  const limites = page.locator('#limites')
  await expect(limites.getByText(/aucun acte médical/)).toBeVisible()
  await expect(
    limites.getByText(/nous vous orientons vers les professionnels de santé/),
  ).toBeVisible()
  await expect(page.locator('main')).not.toContainText(
    /\b(soins|aide|aider|seniors)\b|personnes âgées/i,
  )
})

test('/services présente les trois services, le modèle et la confidentialité', async ({ page }) => {
  await page.goto('/fr/services')
  const main = page.locator('main')
  await expect(main.getByRole('heading', { level: 1 })).toHaveText(
    'Trois services, une seule interlocutrice.',
  )
  const services = await main
    .locator('a[href^="/fr/services/"]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  expect(services).toEqual([
    '/fr/services/conciergerie',
    '/fr/services/grand-age',
    '/fr/services/enfants',
  ])
  await expect(main.locator('#modele-titre')).toHaveText(
    'La maison présente, le prestataire signe, la maison veille.',
  )
  await expect(main.locator('#confidentialite a[href="/fr/confidentialite"]')).toHaveCount(1)
  await expect(main.locator('a[href="/fr/contact"]')).toHaveCount(1)
})

// M23 : desktop avec souris (Desktop Chrome), mouvement autorisé.
test.describe('immersion des services', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('le défilement fait passer d’un service à l’autre, les vignettes y mènent', async ({
    page,
  }) => {
    await page.goto('/fr/services')
    const textes = page.locator('[data-plan-texte]')
    const vignettes = page.locator('[data-vignette]')
    await expect(page.locator('[data-immersion-scene]')).toHaveCSS('position', 'sticky')
    await expect(textes.nth(0)).toHaveAttribute('data-etat', 'actif')
    await expect(vignettes.nth(0)).toHaveAttribute('aria-current', 'true')
    // Seul le service en vedette est lisible et atteignable au clavier.
    await expect(page.getByRole('heading', { name: 'Conciergerie de luxe' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Garde d’enfants' })).toBeHidden()

    await page.mouse.wheel(0, 900 * 1.5)
    await expect(textes.nth(1)).toHaveAttribute('data-etat', 'actif')
    await expect(textes.nth(0)).toHaveAttribute('data-etat', 'apres')

    await vignettes.nth(2).click()
    await expect(textes.nth(2)).toHaveAttribute('data-etat', 'actif')
    await expect(vignettes.nth(2)).toHaveAttribute('aria-current', 'true')
    await expect(page.getByRole('link', { name: 'Découvrir la garde d’enfants' })).toBeVisible()
  })

  test('les gestes filmés jouent une fois, la pause les arrête (D58, WCAG 2.2.2)', async ({
    page,
  }) => {
    await page.goto('/fr/services')
    const films = page.locator('[data-plan-video]')
    await expect(films).toHaveCount(3)
    for (const loop of await films.evaluateAll((v) => v.map((el) => el.hasAttribute('loop')))) {
      expect(loop).toBe(false)
    }
    await page.locator('[data-immersion-scene]').scrollIntoViewIfNeeded()
    await expect(films.first()).toHaveAttribute('data-joue', '1', { timeout: 10000 })
    await page.getByRole('button', { name: 'Mettre la vidéo en pause' }).click()
    expect(await films.first().evaluate((v: HTMLVideoElement) => v.paused)).toBe(true)
    await expect(page.getByRole('button', { name: 'Lire la vidéo' })).toBeVisible()
  })

  test('mouvement réduit : services empilés, sans vignettes, tout est lisible', async ({
    page,
  }) => {
    const videos: string[] = []
    page.on('request', (request) => {
      if (/\.(mp4|webm)$/.test(request.url())) videos.push(request.url())
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/fr/services', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-immersion-vignettes]')).toBeHidden()
    expect(videos).toEqual([])
    for (const nom of ['Conciergerie de luxe', 'Accompagnement du grand âge', 'Garde d’enfants']) {
      await expect(page.getByRole('heading', { name: nom })).toBeVisible()
    }
  })
})
