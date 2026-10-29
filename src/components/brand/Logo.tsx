import { LOGO } from './logo-paths'

// Logo horizontal « le sillage » (D48, D49) : T version écran, « MAISON TRIONA » en Cormorant
// Garamond Medium vectorisé, « by K. » en italique. Couleurs par jetons (T or, nom sapin) pour suivre
// la palette du kit. Décoratif : le lien qui l'entoure porte le nom accessible.
// « by K. » s'efface sous 40 px de haut (mobile) : il vit dans un second SVG de même hauteur, posé
// sur la même ligne de base, plutôt que de laisser un vide dans le premier.

export function Logo() {
  return (
    <span aria-hidden="true" className="inline-flex h-logo lg:h-logo-lg">
      <svg
        viewBox={`0 0 ${LOGO.main.width} ${LOGO.height}`}
        className="h-full w-auto"
        focusable="false"
      >
        <path className="fill-or" transform={`scale(${LOGO.main.markScale})`} d={LOGO.mark} />
        <path
          className="fill-sapin"
          transform={`translate(${LOGO.main.nameX} ${LOGO.baseline})`}
          d={LOGO.name}
        />
      </svg>
      <svg
        viewBox={`0 0 ${LOGO.byK.width} ${LOGO.height}`}
        className="hidden h-full w-auto lg:block"
        focusable="false"
      >
        <path
          className="fill-sapin"
          transform={`translate(${LOGO.byK.x} ${LOGO.baseline})`}
          d={LOGO.byKPath}
        />
      </svg>
    </span>
  )
}
