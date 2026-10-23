'use client'

import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from 'react'

// Menu plein écran du prototype V5 (D31, M19 ; l'idée de la référence « Sterling Gate » de Sady,
// sans GSAP, sans formes décoratives ni icône) : « Menu » ouvre trois aplats qui glissent depuis la
// droite (pierre, cyprès, ivoire), les liens montent en cascade, et le survol ou le focus d'un lien
// montre sa pièce dans la colonne de gauche (desktop). Construit sur <details> comme MobileMenu :
// il s'ouvre et se ferme sans JavaScript. Avec JavaScript : la fermeture est animée (le voile, le
// bouton, Échap), le focus revient au bouton, et le reste de la page est inerte tant qu'il est
// ouvert. Seulement sur les pages qui portent `data-entete-menu` (variante `entete-menu`).

type MenuPanneauProps = {
  openLabel: string
  closeLabel: string
  images: ReactNode[]
  children: ReactNode
}

export function MenuPanneau({ openLabel, closeLabel, images, children }: MenuPanneauProps) {
  const details = useRef<HTMLDetailsElement>(null)
  const summary = useRef<HTMLElement>(null)

  const fermer = useCallback((returnFocus: boolean) => {
    const element = details.current
    if (!element?.open || element.dataset.fermeture !== undefined) return
    const done = () => {
      delete element.dataset.fermeture
      element.open = false
      if (returnFocus) summary.current?.focus()
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done()
      return
    }
    element.dataset.fermeture = ''
    window.setTimeout(done, 575)
  }, [])

  useEffect(() => {
    const element = details.current
    if (!element) return
    const others = () =>
      ['contenu', 'pied-de-page']
        .map((id) => document.getElementById(id))
        .filter((node): node is HTMLElement => node !== null)
    const onToggle = () => others().forEach((node) => (node.inert = element.open))
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && element.open) fermer(true)
    }
    // Un clic sur le voile ferme le menu ; un lien suivi le ferme tout de suite (l'en-tête reste en
    // place d'une page à l'autre).
    const onClick = (event: Event) => {
      const target = event.target as HTMLElement
      if (target.closest('[data-menu-voile]')) fermer(false)
      else if (target.closest('[data-couche] a')) element.open = false
    }
    element.addEventListener('toggle', onToggle)
    element.addEventListener('click', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      element.removeEventListener('toggle', onToggle)
      element.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKey)
      others().forEach((node) => (node.inert = false))
    }
  }, [fermer])

  const onSummary = (event: MouseEvent) => {
    if (!details.current?.open) return
    event.preventDefault()
    fermer(false)
  }

  return (
    <details ref={details} data-menu-panneau className="group">
      <summary
        ref={summary}
        onClick={onSummary}
        className="relative z-30 inline-flex min-h-touch cursor-pointer list-none items-center text-nav text-encre"
      >
        <span className="group-open:hidden">{openLabel}</span>
        <span className="hidden group-open:inline">{closeLabel}</span>
      </summary>
      <div className="fixed inset-0 z-20">
        <div data-menu-voile aria-hidden="true" className="absolute inset-0 bg-voile" />
        <div className="absolute inset-y-0 right-0 w-full lg:w-8/12">
          <div data-couche="1" className="absolute inset-0 bg-pierre" />
          <div data-couche="2" className="absolute inset-0 bg-cypres" />
          <div data-couche="3" className="absolute inset-0 flex bg-ivoire">
            <div aria-hidden="true" className="relative hidden w-5/12 shrink-0 bg-pierre lg:block">
              {images.map((image, index) => (
                <div key={index} data-menu-image={index} className="absolute inset-0">
                  {image}
                </div>
              ))}
            </div>
            <div className="flex flex-1 flex-col justify-between overflow-y-auto px-margin pt-128 pb-48 lg:px-96">
              {children}
            </div>
          </div>
        </div>
      </div>
    </details>
  )
}
