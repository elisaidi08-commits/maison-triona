import { getImageProps, type StaticImageData } from 'next/image'

// Image « art direction » : 16:9 à partir de 1024 px, 4:5 en dessous (docs/assets-manifest.md :
// Pxx-d et Pxx-m). Remplit son conteneur (object-cover). AVIF puis WebP via next/image.
// `priority` : image LCP (chargement immédiat, priorité haute ; jamais `preload`, qui
// téléchargerait les deux variantes d'un <picture>). `anchor` : point d'ancrage du recadrage
// (`seuil` garde l'horizon et une partie du sol de P01 quand la bande des choix réduit la hauteur).

const ANCHORS = {
  center: 'object-center',
  seuil: 'object-seuil',
} as const

type ResponsiveImageProps = {
  desktop: StaticImageData
  mobile: StaticImageData
  alt: string
  sizes?: string
  priority?: boolean
  anchor?: keyof typeof ANCHORS
}

export function ResponsiveImage({
  desktop,
  mobile,
  alt,
  sizes = '100vw',
  priority = false,
  anchor = 'center',
}: ResponsiveImageProps) {
  const common = {
    alt,
    sizes,
    quality: 75,
    loading: priority ? ('eager' as const) : ('lazy' as const),
    fetchPriority: priority ? ('high' as const) : ('auto' as const),
  }
  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({ ...common, src: desktop })
  const { props: mobileProps } = getImageProps({ ...common, src: mobile })

  return (
    <picture>
      <source media="(min-width: 64rem)" srcSet={desktopSrcSet} />
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt fourni par getImageProps */}
      <img
        {...mobileProps}
        className={`absolute inset-0 size-full object-cover ${ANCHORS[anchor]}`}
      />
    </picture>
  )
}
