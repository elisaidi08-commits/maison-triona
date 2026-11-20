import { expect, test } from '@playwright/test'

// Story 4.4 : mentions légales et politique de confidentialité, FR et EN. Un seul h1, un sommaire
// dont chaque lien mène à une section de la page, aucun lien externe (CLAUDE.md § Discrétion).

const PAGES = [
  { path: '/fr/mentions-legales', title: 'Mentions légales', privacy: '/fr/confidentialite' },
  { path: '/en/legal-notice', title: 'Legal notice', privacy: '/en/privacy' },
  { path: '/fr/confidentialite', title: 'Politique de confidentialité', privacy: null },
  { path: '/en/privacy', title: 'Privacy policy', privacy: null },
] as const

for (const { path, title, privacy } of PAGES) {
  test(`${path} : titre, sommaire et sections`, async ({ page }) => {
    await page.goto(path)
    const main = page.locator('main')
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(title)

    const toc = main.getByRole('navigation')
    const anchors = await toc
      .locator('a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
    expect(anchors.length).toBeGreaterThan(5)
    for (const anchor of anchors) {
      expect(anchor).toMatch(/^#[a-z-]+$/)
      await expect(main.locator(`section${anchor}`)).toHaveCount(1)
    }

    const hrefs = await main
      .locator('a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))
    for (const href of hrefs) expect(href).toMatch(/^(#|\/)/)
    if (privacy) await expect(main.locator(`a[href="${privacy}"]`)).toHaveCount(1)
  })
}

test('le sommaire mène à la section choisie', async ({ page }) => {
  await page.goto('/fr/confidentialite')
  await page.locator('main nav').getByRole('link', { name: 'Vos droits' }).click()
  await expect(page).toHaveURL(/#droits$/)
  await expect(page.locator('#droits-titre')).toBeInViewport()
})

test('la politique dit l’essentiel : aucun cookie, coffre chiffré, autorités par pays', async ({
  page,
}) => {
  await page.goto('/fr/confidentialite')
  const main = page.locator('main')
  await expect(main.locator('#en-bref')).toContainText('Aucun cookie, aucun outil de suivi')
  await expect(main.locator('#protection')).toContainText('chiffré dès son arrivée')
  for (const autorite of ['APD', 'CNIL', 'CNPD', 'APDP', 'PFPDT']) {
    await expect(main.locator('#droits')).toContainText(`(${autorite})`)
  }
})

test('les mentions légales citent l’hébergeur et la mention des images créées par IA', async ({
  page,
}) => {
  await page.goto('/fr/mentions-legales')
  await expect(page.locator('#hebergement')).toContainText('Vercel Inc.')
  await expect(page.locator('#images')).toContainText('intelligence artificielle')
})

// Les formulaires renvoient à leur section de la politique, dans la langue de la page (D72 : les
// ancres `#demande` et `#appel` n'existaient pas en anglais).
for (const { page: chemin, section } of [
  { page: '/fr/contact', section: 'demande' },
  { page: '/en/contact', section: 'enquiry' },
  { page: '/fr/contact/appel', section: 'appel' },
  { page: '/en/contact/call', section: 'call' },
]) {
  test(`${chemin} : le lien vers la politique mène à une section qui existe`, async ({ page }) => {
    await page.goto(chemin)
    const lien = page.locator('main a[href*="#"]').filter({ hasText: /confidentialit|privacy/i })
    await expect(lien).toHaveCount(1)
    const href = (await lien.getAttribute('href')) ?? ''
    expect(href).toMatch(new RegExp(`#${section}$`))
    await page.goto(href)
    await expect(page.locator(`#${section}-titre`)).toBeVisible()
  })
}

test('la politique ne promet plus de confirmation par e-mail au visiteur (D69)', async ({
  page,
}) => {
  for (const chemin of ['/fr/confidentialite', '/en/privacy']) {
    await page.goto(chemin)
    await expect(page.locator('main')).not.toContainText(
      /message de confirmation|short confirmation/,
    )
    await expect(page.locator('main')).not.toContainText(
      /adresse de confirmation|confirmation address/,
    )
  }
})
