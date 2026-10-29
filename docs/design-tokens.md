# Design tokens v2 — Maison Triona

> **Statut** : **implémenté en story 1.2** (15/10/2026) dans `src/styles/tokens.css`, qui fait foi ; ce document en est la notice. Les valeurs marquées `[À TRANCHER]` attendent une décision de Sady (voir `docs/art-direction.md` §9).
> **Source de vérité** : ce document, jusqu'à l'implémentation. En phase 1, les tokens vivent dans **un seul fichier CSS** (`src/styles/tokens.css`, bloc `@theme` de Tailwind v4) et ce document en devient la notice.
> **Origine** : collection Figma v2 (`color`, `space`, `type`), corrigée par la DA v2. La collection Figma v1 (`maison-triona/*`) est **dépréciée** : ne jamais en extraire de valeur.
> **Contrastes** : recalculables à tout moment avec `node docs/tools/contrast-check.mjs`.

---

## 1. Règles de conversion Figma → code

| Propriété Figma | Valeur exportée par le MCP | Conversion |
|---|---|---|
| `letterSpacing` d'un text style | nombre sans unité (`12`, `-2`, `-1.5`) | C'est un **pourcentage** : `12` → `0.12em`, `-2` → `-0.02em` |
| `lineHeight` des styles responsives | px (`92`) | Ratio : `92 / 88` → `1.045` |
| Alpha en hexa 8 caractères | `#1F1E1AAD` | `AD` = 173/255 = **0,678** |
| `radius/default` | `2` | Remplacé par **0** en v2 (voir §5) |

---

## 2. Couleurs

### 2.1 Palette

| Token CSS | Hex | Nom | Rôle | Origine |
|---|---|---|---|---|
| `--color-ivoire` | `#F3EDE1` | Ivoire | Fond principal, jamais de blanc pur | **Kit de Cat (D43)** |
| `--color-pierre` | `#D8C8AE` | Pierre | Surface secondaire rare, fond d'image en chargement | Figma v2 (hors kit, à confirmer) |
| `--color-sapin` | `#26382F` | Vert sapin | **Signature** : titres, nom du logo, bloc Contact, focus | **Kit de Cat (D43)** |
| `--color-cypres` | `#3F5A3C` | Cyprès | Vert secondaire : numéros, survols, liens secondaires | Figma v2 (hors kit, à confirmer) |
| `--color-sauge` | `#9AAE8F` | Sauge | Filets sur fond sombre, état désactivé | Figma v2 (hors kit, à confirmer) |
| `--color-or` | `#B58E4C` | Or profond | Filets, T du logo sur ivoire, point du « K. », bordure de bouton sur sapin | **Kit de Cat (D43)** |
| `--color-champagne` | `#C6A96B` | Champagne | Le sillage, les filets, par touches ; **seul or autorisé en texte**, uniquement sur sapin ; focus sur fond sombre | **Kit de Cat (D43)** |
| `--color-encre` | `#2A241F` | Encre | Texte courant sur ivoire | **Kit de Cat (D43)** |
| `--color-encre-68` | `#2A241FAD` | Encre 68 % | Texte secondaire, placeholders, ligne des champs (4,99:1) | Kit, dérivé |
| `--color-ivoire-80` | `#F3EDE1CC` | Ivoire 80 % | Texte secondaire sur sapin (7,45:1, AAA) | Kit, dérivé |
| `--color-terracotta` | `#A66A4E` | Terracotta | Ligne des champs en erreur (3,76:1 sur ivoire du kit) | Figma v2 corrigé (hors kit) |
| `--color-sapin-20` | `#26382F33` | Sapin 20 % | Filet discret sur ivoire (séparations, bordures du banc d'essai) | Kit, dérivé |

**Palette du kit posée le 29/10/2026 (D50).** Contrastes recalculés : `node docs/tools/contrast-check.mjs`, section F (toutes les paires du site conformes ; texte courant, titres et texte sur sapin en AAA). Les tableaux du §2.2 ci-dessous gardent l'historique de l'ancienne palette.

Si Sady garde le **cyprès comme signature**, seul `--color-sapin` change de rôle : les titres passent en cyprès (6,58:1, conforme) et le bloc Contact reste en sapin pour garder la profondeur.

### 2.2 Paires autorisées

| Texte ↓ / Fond → | ivoire | pierre | sapin | cyprès |
|---|---|---|---|---|
| encre | ✅ 14,33 | ✅ 10,16 | ✗ | ✗ |
| encre-68 | ✅ 5,34 | ⚠️ 4,53 (limite) | ✗ | ✗ |
| sapin | ✅ 10,56 | ✅ 7,49 | — | ✗ |
| cyprès | ✅ 6,58 | ⚠️ 4,67 (limite) | ✗ 1,60 | — |
| ivoire | — | ✗ | ✅ 10,56 | ✅ 6,58 |
| ivoire-80 | — | ✗ | ✅ 7,37 | ✗ |
| champagne | ✗ 1,63 | ✗ | ✅ 6,47 | ✗ |
| or | ✗ 2,44 | ✗ 1,73 | ⚠️ 4,32 (UI et filets seulement) | ✗ |
| sauge | ✗ 2,04 | ✗ 1,45 | décoratif (5,17) | ✗ |

✅ texte courant autorisé · ⚠️ autorisé seulement ≥ 24 px ou pour un élément d'interface · ✗ interdit.

**Cible AAA pour le texte courant** (spec d'entrée §4) : encre sur ivoire (14,33), encre sur pierre (10,16), sapin sur ivoire (10,56), ivoire sur sapin (10,56) et ivoire-80 sur sapin (7,37) passent **7:1**. Le cyprès (6,58) et `encre-68` (5,34) restent AA : réservés aux numéros, aux survols, aux placeholders et aux éléments non textuels, **jamais au corps de texte**.

### 2.4 Texte posé sur une image ou une vidéo (voiles)

Opacité minimale d'un voile pour garantir le contraste **quelle que soit l'image dessous** (calcul contre le pire pixel : blanc pur sous un texte clair, noir pur sous un texte foncé ; `contrast-check.mjs` §E).

| Texte | Voile | Grand texte AA (3:1) | Texte AA (4,5:1) | Texte AAA (7:1) |
|---|---|---|---|---|
| ivoire | sapin | **58 %** | 73 % | 87 % |
| ivoire | encre | 53 % | 66 % | 79 % |
| sapin | ivoire | 53 % | 66 % | 83 % |
| encre | ivoire | 44 % | 56 % | 71 % |

**Règle** : sur la vidéo du hero, seul le **titre display** (grand texte) se pose sur l'image, avec un voile sapin d'au moins 58 % (`--veil-hero`). La question, les choix et tout texte courant vont sur un **aplat**. Variante plus légère : mesurer à l'ingestion le pixel le plus clair sous la zone de texte sur plusieurs images du clip, puis ajuster le voile avec une marge de 10 points.

### 2.3 Ratios calculés (sortie de `contrast-check.mjs`)

#### A. Paires réellement utilisées dans la maquette Figma

| Avant-plan | Fond | Ratio | Usage | Type | Verdict |
|---|---|---|---|---|---|
| cyprès `#3F5A3C` | ivoire `#F4EDE0` | 6,58:1 | Titres, nav active, liens, CTA (17 à 88 px) | texte | OK (≥ 4,5:1) |
| encre `#1F1E1A` | ivoire `#F4EDE0` | 14,33:1 | Corps, nav, labels (12 à 20 px) | texte | OK · AAA |
| encre-68 `#1F1E1AAD` (= `#636059`) | ivoire `#F4EDE0` | 5,34:1 | Placeholders, EN inactif, séparateurs | texte | OK (≥ 4,5:1) |
| encre `#1F1E1A` | pierre `#D8C8AE` | 10,16:1 | Corps du bloc Contact | texte | OK · AAA |
| cyprès `#3F5A3C` | pierre `#D8C8AE` | 4,67:1 | Titre et lien du bloc Contact (20 à 48 px) | texte | OK (≥ 4,5:1) |
| or `#B8944D` | ivoire `#F4EDE0` | 2,44:1 | Point du « K. » | logotype | Exempté (WCAG 1.4.3) |
| encre-68 | ivoire | 5,34:1 | Ligne des champs au repos | UI 1.4.11 | OK (≥ 3:1) |
| cyprès | ivoire | 6,58:1 | Soulignement du bouton, anneau de focus | UI 1.4.11 | OK (≥ 3:1) |
| sauge `#9AAE8F` | ivoire | 2,04:1 | Filets, soulignement désactivé | décoratif | Pas de seuil |
| terracotta `#C4876A` | ivoire | 2,57:1 | Ligne d'erreur des champs | UI 1.4.11 | **ÉCHEC** (< 3:1) |
| forest v1 `#2D5016` | ivory v1 `#F5F0E8` | 8,15:1 | Couverture (variables v1) | texte | OK · AAA |
| olive v1 `#4E5E47` | ivory v1 `#F5F0E8` | 6,14:1 | Sous-titre de couverture, 12 px | texte | OK (≥ 4,5:1) |

#### B. Paires proposées pour la DA v2

| Avant-plan | Fond | Ratio | Usage | Type | Verdict |
|---|---|---|---|---|---|
| sapin `#1C3B2A` | ivoire `#F4EDE0` | 10,56:1 | Titres, liens, wordmark | texte | OK · AAA |
| ivoire `#F4EDE0` | sapin `#1C3B2A` | 10,56:1 | Texte du bloc Contact | texte | OK · AAA |
| ivoire-80 (= `#C9C9BC`) | sapin | 7,37:1 | Texte secondaire sur sapin | texte | OK · AAA (72 % ne donnait que 6,29:1) |
| champagne `#D2B98A` | sapin | 6,47:1 | Label, lien sur sombre | texte | OK (≥ 4,5:1) |
| or `#B8944D` | sapin | 4,32:1 | Bordure du bouton, filets | UI 1.4.11 | OK (≥ 3:1) |
| champagne | sapin | 6,47:1 | Anneau de focus sur fond sombre | UI 1.4.11 | OK (≥ 3:1) |
| sapin | ivoire | 10,56:1 | Anneau de focus sur fond clair | UI 1.4.11 | OK (≥ 3:1) |
| sapin | pierre `#D8C8AE` | 7,49:1 | Titre sur pierre | texte | OK · AAA |
| cyprès | ivoire | 6,58:1 | Numéros, sous-titres | texte | OK (≥ 4,5:1) |
| ivoire | cyprès | 6,58:1 | Texte sur aplat cyprès (si utilisé) | texte | OK (≥ 4,5:1) |
| encre | ivoire | 14,33:1 | Corps | texte | OK · AAA |
| encre | pierre | 10,16:1 | Corps sur pierre | texte | OK · AAA |
| encre-68 | pierre | 4,53:1 | Texte secondaire sur pierre | texte | OK (limite) |
| sauge | sapin | 5,17:1 | Filets sur sombre | décoratif | Pas de seuil |
| or | ivoire | 2,44:1 | Filets or sur ivoire | décoratif | Pas de seuil |
| or | ivoire | 2,44:1 | Contrôle : or en texte sur ivoire | texte | **ÉCHEC**, interdit |
| champagne | ivoire | 1,63:1 | Contrôle : champagne sur ivoire | texte | **ÉCHEC**, interdit |
| terracotta `#A66A4E` | ivoire | 3,76:1 | Ligne d'erreur (valeur corrigée) | UI 1.4.11 | OK (≥ 3:1) |

#### C. Référence : palette du PRD §6.2

| Avant-plan | Fond | Ratio | Verdict |
|---|---|---|---|
| sapin `#1C3B2A` | ivoire PRD `#F7F2E7` | 11,01:1 | OK · AAA |
| sapin clair `#2E5D45` | ivoire PRD | 6,80:1 | OK |
| champagne `#D2B98A` | sapin | 6,47:1 | OK |
| champagne clair `#E8DAB8` | sapin | 8,87:1 | OK · AAA |
| noir chaud `#1A1A17` | ivoire PRD | 15,62:1 | OK · AAA |

#### D. Alpha minimal pour un texte secondaire conforme

- Encre sur ivoire : alpha ≥ 0,63 pour 4,5:1 (le token à 0,68 a de la marge).
- Encre sur pierre : alpha ≥ 0,68 (le token est **pile au seuil** : éviter le texte secondaire sur pierre).
- Ivoire sur sapin : alpha ≥ 0,57 (le token à 0,72 a de la marge).
- Encre sur ivoire pour une ligne de champ (3:1) : alpha ≥ 0,49.

---

## 3. Typographie

### 3.1 Familles

| Token | Valeur | Statut |
|---|---|---|
| `--font-display` | **Cormorant Garamond**, Light 300 / Regular 400 (`src/fonts/cormorant-garamond.woff2`, 24 ko) | **Kit de Cat (D43, D50)** |
| `--font-text` | **EB Garamond**, Regular 400 / Medium 500 (`src/fonts/eb-garamond.woff2`, 32 ko) | **Kit de Cat (D43, D50)** |

Les deux fichiers sont produits par `scripts/polices-kit.py` (polices variables réduites à leur plage de graisses, sous-ensemble latin du français, woff2) : **56 ko préchargés** pour un budget de 80 ko. Licences OFL dans `src/fonts/`. Newsreader et Manrope ne servent plus (Newsreader reste sur le banc d'essai `/demo`).

Chargement : `next/font` (la doc Next.js confirme que les fichiers sont téléchargés au build et servis par le site : aucune requête du navigateur vers Google). Préchargement limité à deux fichiers (display + texte Regular).

| Famille | Licence | Variable | Axes / graisses | Italique |
|---|---|---|---|---|
| Newsreader | OFL | Oui | `opsz` 6-72, `wght` 200-800 | Oui |
| Cormorant Garamond | OFL | Oui | `wght` 300-700 | Oui |
| Instrument Serif | OFL | Non | 400 | Oui |
| Manrope | OFL | Oui | `wght` 200-800 | **Non** |
| Satoshi | ITF FFL v2.0 | Oui | `wght` 300-900 | Oui |

**Mesures de la story 1.2** (sous-ensemble latin, woff2, 15/10/2026) : Newsreader de Google avec l'axe de taille optique complet (6 à 72) = 128 ko ; sans l'axe = 56 ko, mais Google sert alors la taille optique **par défaut, 18 (texte)**, visiblement plus épaisse en grand ; Cormorant Garamond Light + Regular = 36 ko ; Instrument Serif = 14 ko ; Manrope 400 + 500 = 24 ko.
**Newsreader instanciée en local** (licence OFL sans *Reserved Font Name* : instanciation permise, licence jointe dans `src/fonts/OFL.txt` et dans la table `name` du fichier) : tailles optiques 32 à 72 + graisses 300 à 400 = **60 ko** (`src/fonts/newsreader-display.woff2`, rendu identique à la référence entre 32 et 72 px) ; taille optique figée à 72 + 300 à 400 = 34 ko ; Light 72 seul = 19 ko, Regular 36 seul = 20 ko. Recette (fontTools, hors dépendances du projet) :

```bash
fonttools varLib.instancer "Newsreader[opsz,wght].ttf" "opsz=32:72" "wght=300:400" -o display.ttf
pyftsubset display.ttf --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" \
  --flavor=woff2 --layout-features='kern,liga,calt,ccmp,locl,mark,mkmk' --name-IDs='*' --output-file=newsreader-display.woff2
```

Source : `ofl/newsreader/Newsreader[opsz,wght].ttf` du dépôt `google/fonts`.

Si Satoshi devait revenir : `next/font/local` avec les WOFF2 fournis **tels quels** (la licence interdit subsetting et conversion), dépôt git **privé** (redistribution interdite), et licence acceptée **par Cat elle-même** (la FFL interdit de transmettre les fichiers à des prestataires).

### 3.2 Échelle

Tailles **fluides** entre 390 et 1440 px (un seul token par niveau, pas d'empilement de classes responsives). Valeurs aux trois points de contrôle des maquettes. **Recalée pour les Garamond du kit (D50)** : leur œil (0,40 em) est plus petit que celui de Manrope (0,52 em), d'où un corps à 20 px et des libellés agrandis.

| Token | Famille / graisse | Mobile 390 | Tablette 834 | Desktop 1440 | Interligne | Interlettrage | `clamp()` |
|---|---|---|---|---|---|---|---|
| `display-xl` | Cormorant Garamond Light | 44 | 56 | 72 | 1.06 | −0.01em | `clamp(2.75rem, 2.1rem + 2.667vw, 4.5rem)` |
| `display-l` | Cormorant Garamond Light | 38 | 46 | 56 | 1.08 | −0.01em | `clamp(2.375rem, 1.957rem + 1.714vw, 3.5rem)` |
| `title-h2` | Cormorant Garamond Regular | 34 | 39 | 46 | 1.15 | 0 | `clamp(2.125rem, 1.846rem + 1.143vw, 2.875rem)` |
| `title-h3` | EB Garamond Medium | 22 | 24 | 26 | 1.35 | 0 | `clamp(1.375rem, 1.282rem + 0.381vw, 1.625rem)` |
| `body-l` | EB Garamond Regular | 20 | 21 | 22 | 1.7 | 0 | `clamp(1.25rem, 1.204rem + 0.19vw, 1.375rem)` |
| `body` | EB Garamond Regular | **20** | **20** | **20** | 1.6 | 0 | `1.25rem` |
| `body-s` | EB Garamond Regular | 18 | 18 | 18 | 1.6 | 0 | `1.125rem` (mentions, aides de champ ; jamais de paragraphe) |
| `label` | EB Garamond Medium, capitales | 14 | 14 | 14 | 1.25 | +0.12em | `0.875rem` |
| `label-l` | EB Garamond Medium, capitales | 16 | 16 | 16 | 1.5 | +0.12em | `1rem` (ligne des pays, DA §7.4) |
| `choix` | EB Garamond Medium | 22 | 23 | 24 | 1.35 | 0 | `clamp(1.375rem, 1.329rem + 0.19vw, 1.5rem)` (libellés des choix d'entrée, DA §7.2) |
| `nav` | EB Garamond Medium | 18 | 18 | 18 | 1.4 | +0.01em | `1.125rem` |

| Cachet « K. » | Taille | Usage |
|---|---|---|
| `stamp-sm` | 24 px | Fin du hero, menu mobile |
| `stamp-md` | 48 px | Pied de page |
| `stamp-lg` | 64 px | Confirmation du formulaire |

**Écarts avec Figma** : hero 88 → 72 px et Medium → Light (luxe par l'air, pas par la masse) ; Territoires passe de `display-l` à `title-h2` ; labels 12 → 13 px ; corps 16-17 → **18 px sur tous les écrans** (spec d'entrée §4.1) ; textes secondaires 14 → 16 px.

**Accessibilité** : les `clamp()` mêlent `rem` et `vw`, le zoom navigateur à 200 % reste donc effectif (WCAG 1.4.4).

---

## 4. Espacements et grille

### 4.1 Échelle (px, issue de la collection Figma `space/scale`)

`0 · 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128 · 160 · 192`

- Tokens nommés par leur valeur en px : `--spacing-24` = 24 px. `--spacing-0` est indispensable (`inset-0`, `gap-0`, `top-0` n'existeraient plus sans lui). Le multiplicateur par défaut de Tailwind est **désactivé** : `p-24` vaut 24 px, et toute valeur hors échelle est un bug (`anti-patterns.md` n° 15 et 33).
- `anti-patterns.md` prévoyait 4…160 en base 8 stricte. La v2 garde **12** (resserrements fins déjà utilisés dans les maquettes) et **192**. Mise à jour de `anti-patterns.md` à faire par Sady.

### 4.2 Tokens sémantiques

| Token (classe) | Mobile < 768 | Tablette 768-1023 | Desktop ≥ 1024 |
|---|---|---|---|
| `--spacing-section` (`py-section`) | 72 | 112 | 160 |
| `--spacing-margin` (`px-margin`) | 24 | 64 | 120 |
| `--spacing-gutter` (`gap-gutter`) | 16 | 20 | 24 |
| Colonnes | 4 | 8 | 12 |
| `--container-content` (`max-w-content`) | — | — | 1200 px (1440 − 2 × 120) |
| `--container-measure` (`max-w-measure`) | 640 px | 640 px | 640 px |
| `--spacing-touch` (`min-h-touch`) | 48 px | 48 px | 48 px |
| `--spacing-touch-lg` (`min-h-touch-lg`) | 56 px | 56 px | 56 px (choix d'entrée, barre mobile) |
| `--spacing-button` (`min-h-button`) | 52 px | 52 px | 52 px (bouton sur sapin, DA §7.5) |

**Utilitaires de mise en page** (`src/styles/tokens.css`, revue DA du point de contrôle ②) :

| Utilitaire | Rôle |
|---|---|
| `conteneur` | Contenu aligné sur la marge : largeur max `1200 + 2 × marge`, marge comprise (remplace `mx-auto max-w-content px-margin`, qui décalait le texte de 120 px à 1440) |
| `h-scene` · `min-h-scene` · `top-mini-menu` | Scène à média collant : hauteur visible sous le mini-menu (`--mini-menu-height`, 48 px en desktop sur l'accueil, 0 ailleurs) |
| `bottom-barre` | Élément fixé en bas posé au-dessus de la barre mobile (`--barre-mobile-height`, 56 px sous 1024 px quand la barre existe, 0 sinon) |
| `focus-sur-image` · `focus-interieur` | Anneau de focus champagne collé à l'aplat sapin (bouton pause sur image) ; anneau tracé à l'intérieur (barre mobile) |
| `object-seuil` | Recadrage de P01 et de V01 (50 % 60 %) : la mer et le sol restent visibles quand la bande des choix réduit l'image |

La page réserve la hauteur du mini-menu (`scroll-padding-top`) et de la barre mobile (`padding-bottom` et `scroll-padding-bottom`) : un élément focalisé n'est jamais masqué (WCAG 2.4.11).

Les trois tokens qui varient se déclarent dans `@theme` avec leur valeur mobile, puis sont redéfinis sur `:root` aux points de rupture `md` et `lg` (les utilitaires lisent la variable CSS, la redéfinition suffit).

### 4.3 Points de rupture

`md` = 768 px · `lg` = 1024 px · `xl` = 1440 px (au-delà, le contenu reste à 1200 px, les marges grandissent). Trois comportements définis par composant (`anti-patterns.md` n° 34).

---

## 5. Formes et traits

| Token | Valeur | Usage |
|---|---|---|
| `--radius-none` | 0 | **Tout** : boutons, champs, images, encarts |
| `--radius-focus` | 2 px | Anneau de focus uniquement |
| `arch` (utilitaire `@utility`) | `border-radius: 50% 50% 0 0 / 40% 40% 0 0` | Image en arche du hero `[À TRANCHER]` |
| `--aspect-hero` (`aspect-hero`) | 16 / 9 | Vidéo et poster hero desktop |
| `--aspect-portrait` (`aspect-portrait`) | 4 / 5 | Images de section, poster mobile, arche |
| `h-bande` (utilitaire `@utility`) | `min(55svh, 36rem)` | Images des services empilés à partir de 1024 px (écran tactile, mouvement réduit, sans JavaScript), prototype V4 |
| `--u`, `--zoom-course`, `--zoom-entete` (bloc M21 de `tokens.css`) | 1/18 de la largeur (réduit pour tenir en hauteur), 160svh, 10rem | File de cartes des services (M21, D52) : unité des cartes, défilement de la scène, place de l'en-tête |
| `--stroke-hairline` | 1 px | Filets, bordures, ligne des champs |
| `--stroke-focus` | **3 px** | Anneau de focus (« épais et contrasté », spec d'entrée §4.2) |
| `--focus-offset` | 3 px | Écart anneau / élément |
| `--veil-hero` | sapin à 58 % minimum | Voile sous le titre posé sur la vidéo du hero (§2.4) |
| Ombres | **aucune** | — |

Filets : or `#B8944D` sur ivoire et sur sapin, sauge sur sapin, sapin à 20 % pour les séparations discrètes sur ivoire. Jamais de filet or sur pierre.

---

## 6. Mouvement

Détail et catalogue : `docs/motion-spec.md`.

| Token | Valeur | Usage |
|---|---|---|
| `--ease-maison` | `cubic-bezier(0.22, 1, 0.36, 1)` | Révélations, transitions de page |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Survols, changements de couleur |
| `--transition-duration-micro` | 150 ms | Couleur au survol (classe `duration-micro`) |
| `--transition-duration-hover` | 300 ms | Filet qui se dessine (`duration-hover`) |
| `--transition-duration-page` | 240 ms | Fondu entre pages (`duration-page`) |
| `--transition-duration-reveal` | 700 ms | Révélation d'image (`duration-reveal`) |
| `--transition-duration-hero` | 1 000 ms | Entrée du hero (`duration-hero`) |
| `--distance-reveal` | 12 px | Déplacement vertical max d'une révélation (≤ 16 px) |
| `--stagger` | 80 ms | Décalage entre éléments d'un même groupe |

---

## 7. Couches

| Token | Valeur | Usage |
|---|---|---|
| `--z-header` | 10 | En-tête |
| `--z-menu` | 20 | Menu mobile plein écran |
| `--z-skip` | 30 | Lien d'évitement « Aller au contenu » |

---

## 8. Esquisse d'implémentation (phase 1)

**Implémentation réelle (story 1.2)** : voir `src/styles/tokens.css`. Écarts et constats par rapport à l'esquisse ci-dessous :
- `tokens.css` est le **point d'entrée CSS unique**, importé par `src/app/layout.tsx`, et commence par `@import 'tailwindcss' source(none); @source '../';`. Un `@import` de `tokens.css` depuis un autre fichier CSS **n'est pas traité** par le chargeur `@tailwindcss/turbopack` : les tokens étaient ignorés (constaté le 15/10/2026).
- Toutes les familles par défaut sont remises à zéro (`--font-*`, `--text-*`, `--radius-*`, `--shadow-*`, `--blur-*`, `--ease-*`, `--breakpoint-*`, `--container-*`…). Vérifié : `bg-red-500`, `text-sm`, `shadow`, `rounded-lg`, `mt-6` ne génèrent rien. **`p-4` génère `padding: var(--spacing-4)` = 4 px** : 4 fait partie de notre échelle ; ce n'est plus le `p-4` de Tailwind (16 px).
- Ajouts : `--color-sapin-20` (filet discret), `--spacing-button` (52 px), `--text-stamp-sm|md|lg`, graisse incluse dans chaque token de texte (`--text-*--font-weight`), `--radius-focus`. Les variables sans utilitaire (traits, focus, `--distance-reveal`, `--stagger`) vivent sur `:root` dans `@layer base` ; `[data-surface='sapin']` passe le focus en champagne.
- Polices (`src/styles/fonts.ts`) : Manrope 400 + 500 (24 ko) et, **provisoirement**, Newsreader Light + Regular **sans** axe de taille optique (56 ko) ; total préchargé 80 ko, pile au budget. Avec l'axe `opsz`, Newsreader pèse 128 ko (mesures du sous-ensemble latin, 15/10/2026). Cormorant Garamond Light + Regular : 36 ko ; Instrument Serif : 14 ko.

Illustration de la cible, **pas du code à copier tel quel**. Comportements vérifiés le 15/10/2026 en compilant avec `tailwindcss@4.3.3` :
- `--color-*: initial` supprime toute la palette par défaut (`bg-red-500` n'est plus générée).
- `--spacing-*: initial` supprime aussi le multiplicateur `--spacing` : `p-24` donne `var(--spacing-24)`, et `p-4` ou `mt-6` ne sont **plus générés** si les clés n'existent pas. Même effet sur `gap`, `w`, `h`, `inset`, `translate`.
- Les durées nommées passent par l'espace `--transition-duration-*` (classe `duration-<nom>`).
- Une variable fournie par `next/font` se référence dans un bloc `@theme inline`.

```css
/* src/styles/tokens.css : unique source de vérité */
@import "tailwindcss";

@theme {
  /* Aucune couleur, aucun espacement Tailwind par défaut : seulement la maison */
  --color-*: initial;
  --spacing-*: initial;

  --color-ivoire: #F4EDE0;
  --color-pierre: #D8C8AE;
  --color-sapin: #1C3B2A;
  --color-cypres: #3F5A3C;
  --color-sauge: #9AAE8F;
  --color-or: #B8944D;
  --color-champagne: #D2B98A;
  --color-encre: #1F1E1A;
  --color-encre-68: #1F1E1AAD;
  --color-ivoire-80: #F4EDE0CC;
  --color-terracotta: #A66A4E;

  --spacing-0: 0px;
  --spacing-4: 4px;   --spacing-8: 8px;   --spacing-12: 12px;  --spacing-16: 16px;
  --spacing-24: 24px; --spacing-32: 32px; --spacing-48: 48px;  --spacing-64: 64px;
  --spacing-96: 96px; --spacing-128: 128px; --spacing-160: 160px; --spacing-192: 192px;

  --text-display-xl: clamp(2.75rem, 2.1rem + 2.667vw, 4.5rem);
  --text-display-xl--line-height: 1.06;
  --text-display-xl--letter-spacing: -0.02em;
  /* … display-l, title-h2, title-h3, body-l, body, body-s, label, nav */

  --radius-none: 0;
  --ease-maison: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --transition-duration-micro: 150ms;
  --transition-duration-hover: 300ms;
  /* … page, reveal, hero */
}

/* Familles fournies par next/font (variables CSS posées sur <html>) */
@theme inline {
  --font-display: var(--font-serif-display);
  --font-text: var(--font-manrope);
}

/* Formes nommées plutôt que valeurs arbitraires */
@utility arch {
  border-radius: 50% 50% 0 0 / 40% 40% 0 0; /* demi-cercle en tête d'un cadre 4:5 */
}
```

---

## 9. Correspondance avec les variables Figma v2

| Figma | Token code | Changement |
|---|---|---|
| `color/bg/ivoire` | `--color-ivoire` | = |
| `color/bg/pierre` | `--color-pierre` | = |
| `color/brand/cypres` | `--color-cypres` | Passe en second rôle si sapin retenu |
| — | `--color-sapin` | **Nouveau** (PRD) |
| `color/brand/sauge` | `--color-sauge` | = |
| `color/accent/or` | `--color-or` | = |
| — | `--color-champagne` | **Nouveau** (PRD) |
| `color/accent/terracotta` | `--color-terracotta` | `#C4876A` → `#A66A4E` |
| `color/ink/encre` | `--color-encre` | = |
| `color/ink/encre-68` | `--color-encre-68` | = |
| `space/scale/*` | `--spacing-*` | + 160 dans l'échelle |
| `space/section|margin|gutter/*` | `--space-section|margin|gutter` | = |
| `space/radius/default` (2) | `--radius-none` (0) | 2 → 0 |
| `type/*` (Plus Jakarta Sans) | `--font-display` | Serif `[À TRANCHER]` ; tailles revues au §3.2 |

Après arbitrage, reporter les nouvelles valeurs dans Figma (collection v2) pour que maquette et code restent alignés.
