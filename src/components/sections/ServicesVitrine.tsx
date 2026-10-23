'use client'

import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'

// Services de l'accueil (maquette Figma D·01) : en desktop, une seule grande image, collante à
// gauche, montre le service que l'on lit ; elle passe en fondu à la suivante quand un autre service
// arrive au milieu de l'écran ou reçoit le focus. Sans JavaScript, la première image reste. En
// mobile, cette colonne n'existe pas : chaque service porte sa propre image (rendue par le serveur).

// Instant du dernier retour arrière (événement popstate) : la position notée ne sert qu'à lui.
const POSITION_KEY = 'maison:position-accueil'
let backAt = 0
if (typeof window !== 'undefined')
  window.addEventListener('popstate', () => {
    backAt = Date.now()
  })

type ServicesVitrineProps = {
  images: ReactNode[]
  children: ReactNode
}

export function ServicesVitrine({ images, children }: ServicesVitrineProps) {
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const blocks = root.current?.querySelectorAll<HTMLElement>('[data-vitrine]')
    if (!blocks?.length) return
    // Bande d'un dixième de la hauteur, un peu au-dessus du milieu : le service qui la traverse est
    // celui que l'on lit ; entre deux services, l'image reste sur le précédent.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.vitrine))
        }
      },
      { rootMargin: '-40% 0px -50% 0px' },
    )
    blocks.forEach((block) => observer.observe(block))
    return () => observer.disconnect()
  }, [])

  // Passage de pièce (prototype MT-03) : avec l'API de transition, React attend que l'image partagée
  // soit prête avant d'afficher l'accueil au retour ; le navigateur a déjà restauré la position sur
  // la page du service, plus courte, et l'a plafonnée (962 px devenus 855 px, mesuré). L'accueil
  // note donc sa position au clic et la reprend après un retour arrière, vers la même page
  // seulement. Rien d'autre n'est stocké (sessionStorage, ni cookie ni identifiant).
  useEffect(() => {
    if (Date.now() - backAt > 2000) return
    backAt = 0
    try {
      const saved = JSON.parse(sessionStorage.getItem(POSITION_KEY) ?? 'null') as {
        path: string
        y: number
      } | null
      if (saved?.path === window.location.pathname)
        requestAnimationFrame(() => window.scrollTo({ top: saved.y, behavior: 'instant' }))
    } catch {
      // Stockage indisponible : la position du navigateur reste.
    }
  }, [])
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!(event.target as HTMLElement).closest('a[href]')) return
    try {
      sessionStorage.setItem(
        POSITION_KEY,
        JSON.stringify({ path: window.location.pathname, y: Math.round(window.scrollY) }),
      )
    } catch {
      // Stockage indisponible : rien à noter.
    }
  }

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const block = (event.target as HTMLElement).closest<HTMLElement>('[data-vitrine]')
    if (block) setActive(Number(block.dataset.vitrine))
  }

  return (
    <div
      ref={root}
      onFocus={onFocus}
      onClickCapture={onClick}
      className="lg:grid lg:grid-cols-12 lg:gap-gutter"
    >
      <div
        data-vitrine-images
        className="relative hidden aspect-portrait overflow-hidden bg-pierre lg:sticky lg:top-96 lg:col-span-5 lg:block lg:self-start"
      >
        {images.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-hero ease-maison ${
              index === active ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {image}
          </div>
        ))}
      </div>
      <div className="lg:col-span-6 lg:col-start-7">{children}</div>
    </div>
  )
}
