import { expect, test } from '@playwright/test'

// Texte agrandi (constat n° 4 de docs/a11y-report.md, D73) : sur un téléphone (390 px), avec le
// texte du navigateur à 200 %, un mot long d'un titre, d'un choix ou d'un paragraphe
// (« Accompagnement », « Companionship ») ne doit plus dépasser de l'écran ni faire défiler la page
// en largeur. Le texte agrandi est simulé par la taille de police racine à 200 % : toutes les
// tailles du site sont en rem (src/styles/tokens.css). Rien ne change à l'affichage normal : la
// coupure (sans tiret) ne joue que si le mot ne tient pas seul sur sa ligne.

// Toutes les pages publiques de la suite axe (tests/a11y/pages.spec.ts), FR et EN, hors démo et 404.
const PAGES = [
  '/fr',
  '/en',
  '/fr/la-maison',
  '/en/the-house',
  '/fr/contact',
  '/en/contact',
  '/fr/contact/merci',
  '/en/contact/merci',
  '/fr/contact/appel',
  '/en/contact/call',
  '/fr/contact/appel/envoye',
  '/en/contact/call/sent',
  '/fr/faq',
  '/en/faq',
  '/fr/comment-ca-se-passe',
  '/en/how-it-works',
  '/fr/comment-ca-se-passe/langage-simple',
  '/en/how-it-works/easy-read',
  '/fr/notre-independance',
  '/en/our-independence',
  '/fr/accessibilite',
  '/en/accessibility',
  '/fr/services',
  '/en/services',
  '/fr/services/conciergerie',
  '/fr/services/grand-age',
  '/fr/services/enfants',
  '/en/services/concierge',
  '/en/services/later-life',
  '/en/services/childcare',
  '/fr/territoires',
  '/en/where-we-work',
  '/fr/mentions-legales',
  '/en/legal-notice',
  '/fr/confidentialite',
  '/en/privacy',
]

test.use({ viewport: { width: 390, height: 844 } })

for (const chemin of PAGES) {
  test(`${chemin} : rien ne dépasse de l'écran avec le texte à 200 %`, async ({ page }) => {
    await page.goto(chemin)
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '200%'
    })
    const debordements = await page.evaluate(() =>
      [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')]
        .filter((titre) => (titre as HTMLElement).offsetParent !== null)
        .filter((titre) => {
          const boite = titre.getBoundingClientRect()
          return boite.right > innerWidth + 0.5 || titre.scrollWidth > titre.clientWidth + 0.5
        })
        .map((titre) => titre.textContent?.trim().slice(0, 40)),
    )
    expect(debordements).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
}

test('affichage normal : un titre long garde ses mots entiers', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/fr/services/grand-age')
  const titre = page.locator('h1')
  await expect(titre).toHaveCSS('hyphens', 'manual')
  // Aucune coupure à l'intérieur d'un mot : chaque mot du titre tient sur une seule ligne.
  const motsCoupes = await titre.evaluate((element) => {
    const texte = element.firstChild
    if (!texte || texte.nodeType !== Node.TEXT_NODE) return []
    const contenu = texte.textContent ?? ''
    const coupes: string[] = []
    let debut = 0
    for (const mot of contenu.split(/(\s+)/)) {
      if (mot.trim()) {
        const plage = document.createRange()
        plage.setStart(texte, debut)
        plage.setEnd(texte, debut + mot.length)
        if (plage.getClientRects().length > 1) coupes.push(mot)
      }
      debut += mot.length
    }
    return coupes
  })
  expect(motsCoupes).toEqual([])
})
