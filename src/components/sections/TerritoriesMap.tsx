import {
  type CodePays,
  CARTE_VIEWBOX,
  PAYS_MAISON,
  PAYS_VOISINS,
  REPERES,
} from '@/lib/carte-territoires'

// Carte au trait des Territoires (story 1.7, D26 ; docs/art-direction.md §7.4) : fond ivoire,
// pays voisins en filet sauge, les pays de la maison en filet sapin, un point or par pays (le seul
// or de la carte), Monaco en point seul. SVG en ligne rendu côté serveur, sans bibliothèque ni
// script. Décorative (`aria-hidden`) : les noms des pays sont du texte réel à côté (liste du lot 5).
// `highlighted` : pays choisi, teinté sapin 20 % (choix d'un pays au lot 5). Traits de largeur fixe
// à toutes les tailles (`vector-effect`).

type TerritoriesMapProps = {
  highlighted?: CodePays
}

export function TerritoriesMap({ highlighted }: TerritoriesMapProps) {
  return (
    <svg
      viewBox={CARTE_VIEWBOX}
      aria-hidden="true"
      focusable="false"
      className="block aspect-square h-auto w-full"
    >
      <g fill="none" strokeLinejoin="round">
        {PAYS_VOISINS.map(({ code, d }) => (
          <path
            key={code}
            d={d}
            className="stroke-sauge"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {PAYS_MAISON.map(({ code, d }) => (
          <path
            key={code}
            d={d}
            className={`stroke-sapin ${code === highlighted ? 'fill-sapin-20' : ''}`}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {(Object.entries(REPERES) as [CodePays, [number, number]][]).map(([code, [x, y]]) => (
        <circle key={code} cx={x} cy={y} r={7} className="fill-or" />
      ))}
    </svg>
  )
}
