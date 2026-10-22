'use client'

import { useEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react'

// Services de l'accueil calme (maquette Figma D·01) : en desktop, une seule grande image, collante à
// gauche, montre le service que l'on lit ; elle passe en fondu à la suivante quand un autre service
// arrive au milieu de l'écran ou reçoit le focus. Sans JavaScript, la première image reste. En
// mobile, cette colonne n'existe pas : chaque service porte sa propre image (rendue par le serveur).

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

  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    const block = (event.target as HTMLElement).closest<HTMLElement>('[data-vitrine]')
    if (block) setActive(Number(block.dataset.vitrine))
  }

  return (
    <div ref={root} onFocus={onFocus} className="lg:grid lg:grid-cols-12 lg:gap-gutter">
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
