'use client'

import { useEffect, type ReactNode } from 'react'

// M6 (docs/motion-spec.md, D37) : la page qui arrive par une navigation interne apparaît en fondu,
// 240 ms, entrée seulement. Monté par template.tsx, qui se remonte à chaque navigation. Le premier
// affichage n'est jamais animé : l'image principale s'affiche aussitôt. Mouvement réduit : la règle
// globale ramène le fondu à rien.
// Focus après une navigation interne (prototype MT-03, revu en MT-03B). Sans rien faire, la
// tabulation suivante partait de l'ancien lien, souvent jusqu'au pied de page (Chromium, WebKit et
// Firefox, déjà avant MT-03).
// - Lien suivi : le focus va au titre principal de la nouvelle page (tabIndex -1, sans cadre), à
//   défaut au contenu principal, sans défilement. Le titre, plutôt que `<main>`, parce que WebKit
//   ignore le point de départ donné par `<main>`.
// - Retour ou avance dans l'historique : le focus revient au lien par lequel on avait quitté cette
//   entrée, comme le fait le navigateur entre deux pages classiques ; sans lien noté, il ne bouge
//   pas. Jamais le titre : la position restaurée est souvent loin du haut de la page.
// Défilement de ces retours : c'est le navigateur qui restaure la position. Le défilement doux de
// M12 la faisait glisser depuis la position de la page quittée (Chromium, Firefox) : il est coupé
// le temps de la restauration, deux images.

// API Navigation (Chromium, Firefox, Safari 26.2 et suivants), absente des types de TypeScript 5.9.
type NavigationApi = {
  currentEntry: { key: string } | null
  addEventListener: (
    type: 'navigate',
    listener: (event: { navigationType: string; destination: { key: string } }) => void,
  ) => void
}

let navigated = false
// Entrée de l'historique atteinte par un retour ou une avance. Une clé plutôt qu'un drapeau : Next.js
// peut monter deux fois la page retrouvée (cacheComponents), la première alors qu'elle est encore
// cachée.
let traversedTo: string | null = null
// Lien suivi depuis chaque entrée de l'historique, en mémoire seulement.
const departures = new Map<string, { href: string; index: number }>()

const navigationApi = () => (window as { navigation?: NavigationApi }).navigation
const entryKey = () => navigationApi()?.currentEntry?.key ?? window.location.pathname
const linksTo = (href: string) =>
  document.querySelectorAll<HTMLElement>(`a[href="${CSS.escape(href)}"]`)

if (typeof window !== 'undefined') {
  // `navigate` annonce l'entrée visée avant que Next.js n'affiche la page. `popstate` arrive trop
  // tard pour cela sous Chromium (l'écouteur de Next.js passe avant) : il ne sert qu'en repli.
  // Next.js réécrit l'entrée (`replaceState`) à chaque affichage : un remplacement garde la clé.
  const api = navigationApi()
  api?.addEventListener('navigate', (event) => {
    if (event.navigationType === 'traverse') traversedTo = event.destination.key
    else if (event.navigationType !== 'replace') traversedTo = null
  })
  window.addEventListener('popstate', () => {
    if (!api) traversedTo = window.location.pathname
    const html = document.documentElement
    html.style.scrollBehavior = 'auto'
    requestAnimationFrame(() =>
      requestAnimationFrame(() => html.style.removeProperty('scroll-behavior')),
    )
  })
  document.addEventListener(
    'click',
    (event) => {
      if (!api) traversedTo = null
      const link = (event.target as Element | null)?.closest?.<HTMLElement>('a[href]')
      if (!link) return
      const href = link.getAttribute('href') ?? ''
      departures.set(entryKey(), { href, index: [...linksTo(href)].indexOf(link) })
    },
    true,
  )
}

export function TransitionPage({ children }: { children: ReactNode }) {
  const animate = navigated
  useEffect(() => {
    const key = entryKey()
    if (navigated && key === traversedTo) {
      const departure = departures.get(key)
      if (departure) linksTo(departure.href)[departure.index]?.focus({ preventScroll: true })
    } else if (navigated) {
      const main = document.getElementById('contenu')
      const title = main?.querySelector<HTMLElement>('h1')
      if (title && !title.hasAttribute('tabindex')) title.tabIndex = -1
      ;(title ?? main)?.focus({ preventScroll: true })
    }
    navigated = true
  }, [])
  return <div className={animate ? 'animate-page' : undefined}>{children}</div>
}
