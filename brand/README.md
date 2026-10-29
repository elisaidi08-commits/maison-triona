# Kit du logo « le sillage »

Kit v1 du 29/10/2026 (D48, D49), **à valider par Cat**. Planche de marque complète dans Figma : page « 02b · Marque — le sillage » du fichier `fAbQP3eV9zM6R3Bq75ehFN`.

> « Le logo trace un T comme le sillage d'une pirogue sur l'eau. On ne voit pas le navigateur, on voit seulement la trace élégante de son passage. » Catriona

## Les fichiers (`kit/`)

| Fichier | Usage | Fond |
|---|---|---|
| `logo-principal-clair.svg` | Logo principal : T or profond, « Maison Triona » et « by K. » sapin | ivoire |
| `logo-principal-or.svg` | Logo principal tout champagne | sapin |
| `logo-principal-sillage-ivoire.svg` | T et nom ivoire, « by K. » champagne | sapin |
| `logo-horizontal-clair.svg` | En-tête : T or profond, « MAISON TRIONA » et « by K. » sapin | ivoire |
| `logo-horizontal-sombre.svg` | En-tête : T champagne, nom ivoire, « by K. » champagne | sapin |
| `sceau-or.svg` · `sceau-sapin.svg` | Sceau seul : le T dans un anneau | sapin · ivoire |
| `symbole-affichage-or.svg` | T d'affichage (original L1-A), 240 px et plus, impression | sapin |
| `symbole-ecran-or.svg` · `symbole-ecran-sapin.svg` | T version écran, 32 à 240 px | sapin · ivoire |
| `icone.svg` | Favicon et icône d'application, 16 à 180 px | sapin intégré |

`png/` : chaque fichier en PNG d'environ 2 400 px, `-transparent` et `-fond` (sur son fond).

## Couleurs du kit (Cat, D43)

| Couleur | Code | Rôle |
|---|---|---|
| Vert sapin | `#26382F` | couleur signature, fonds sombres |
| Champagne | `#C6A96B` | le sillage, les filets, par touches |
| Or profond | `#B58E4C` | accent secondaire |
| Ivoire | `#F3EDE1` | fond clair, jamais de blanc pur |
| Encre | `#2A241F` | texte sur ivoire |

Typographie : **Cormorant Garamond** pour le nom (Light dans le logo principal, Medium dans l'horizontale), **EB Garamond** pour le texte.

## Règles d'usage

- **Zone de respiration** : la hauteur d'une capitale du nom, tout autour.
- **Tailles minimales** : logo principal 120 px de large ; horizontale 32 px de haut ; sceau 48 px ; icône 16 px. Le T d'affichage à partir de 240 px, en dessous la version écran.
- **« by K. »** toujours petit, en italique, en retrait ; il s'efface sous 40 px de haut.
- **Fonds** : ivoire ou sapin, en aplat ; sur une image, toujours posé sur un aplat.
- **Jamais** : une « banane » (courbe molle, jaune sur fond sombre) ; déformer, incliner, faire pivoter ou recomposer le logo ; ombre, dégradé, contour ou relief à l'écran ; l'or en texte sur fond clair (sur ivoire, le nom reste sapin) ; une autre police pour le nom ; du blanc pur.

## Régénérer

Ne jamais modifier les fichiers à la main : tout vient de `scripts/kit-logo.py` (prérequis et commande en tête du script), qui écrit aussi `src/components/brand/logo-paths.ts` pour les composants `Logo` et `Seal`.

PNG (ImageMagick), depuis `brand/kit/` :

```bash
mkdir -p png && for f in *.svg; do b=${f%.svg}; case $b in *clair*|*sapin*) bg="#F3EDE1";; icone) bg="";; *) bg="#26382F";; esac
  w=$(magick identify -format %w "$f"); d=$(( 2400 * 96 / w )); [ $b = icone ] && d=768
  magick -density $d -background none "$f" "png/$b-transparent.png"
  [ -n "$bg" ] && magick "png/$b-transparent.png" -background "$bg" -flatten "png/$b-fond.png"; done
```

## Sources (`sources/`)

- `L1-A-recraft.svg` : sortie brute Recraft V4.1 (lot L1, job `82999da6-02b5-4c33-9234-4b6c5c4d7641`), avec son manifeste C2PA d'origine IA.
- `L1-A-symbole.svg` : le même, réduit au seul tracé du T (fond et micro-éclats retirés).
