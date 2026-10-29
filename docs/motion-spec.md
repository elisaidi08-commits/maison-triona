# Spécification du mouvement — Maison Triona

> **Statut** : proposition phase 0 (15/10/2026), mise à jour après le brief assets IA et la spec d'entrée par besoin. Les animations marquées **Q4** dépendent de l'arbitrage entre le brief phase 0 (qui demande des révélations au scroll) et `anti-patterns.md` n° 12 (qui les interdit). La **vidéo liée au scroll** (M13) est demandée par le brief assets ; la spec d'entrée en fixe les limites d'accessibilité (§4.3).
> **Principe** : le mouvement accompagne, il ne se montre pas. Si une animation se remarque, elle est de trop. En cas de doute : on la retire.
> **Tokens** : `docs/design-tokens.md` §6. **Recettes de code** : skill `maison-triona-motion`.

---

## 1. Principes

1. **Lent et précis** : 150 ms à 1,2 s selon le rôle. Une seule courbe pour les entrées (`--ease-maison`, `cubic-bezier(0.22, 1, 0.36, 1)`), une pour les survols (`--ease-standard`, `cubic-bezier(0.4, 0, 0.2, 1)`). **Aucun ressort, aucun rebond.**
2. **Une fois** : une révélation ne se rejoue pas quand on remonte la page.
3. **Petites amplitudes** : déplacement vertical ≤ 12 px (plafond du brief : 16 px), aucune mise à l'échelle au-delà de 1,02.
4. **`opacity` et `transform` uniquement** : jamais de `width`, `height`, `top`, `margin`, `filter: blur()` animés.
5. **Le contenu existe sans animation** : sans JavaScript, avec `prefers-reduced-motion: reduce` ou avant l'hydratation, tout le texte est lisible. Aucune animation ne masque le contenu au-delà de 300 ms.
6. **Le LCP n'est jamais animé en opacité** : l'image (ou le poster) du hero est affichée immédiatement.
7. **CSS d'abord** : survols, filets et entrée du hero en CSS pur. Motion (ex-Framer Motion) seulement pour ce que le CSS ne sait pas faire proprement (détection d'entrée dans le viewport avec repli, parallaxe liée au scroll).

---

## 2. Catalogue des animations autorisées

| ID | Nom | Déclencheur | Propriétés | Durée | Courbe | Décalage | Repli `reduced-motion` | Techno | Statut |
|---|---|---|---|---|---|---|---|---|---|
| M1 | `hero-entree` | Premier affichage de l'Accueil | Titre, intro, cachet : `opacity` 0 → 1, `translateY` 12 → 0 px. **Image : aucune animation.** | 900 ms | maison | 0 / 120 / 240 ms | Aucune animation | CSS `@keyframes` | Proposé |
| M2 | `revelation-image` | Image entrant à 20 % dans le viewport | `opacity` 0 → 1, `translateY` 12 → 0 px | 700 ms | maison | — | Aucune animation | Motion `whileInView`, `once` | **Q4** |
| M3 | `revelation-groupe` | Titre de section entrant dans le viewport | Label + filet + titre : `opacity` 0 → 1, `translateY` 8 → 0 px. **Paragraphes jamais animés.** | 700 ms | maison | 80 ms | Aucune animation | Motion `whileInView`, `once` | **Q4** ; à l'essai sur la section Territoires de l'accueil (D37), en CSS, sans Motion |
| M4 | `filet-survol` | Survol ou focus d'un lien, du bouton, d'une ligne de service | Filet 1 px or : `scaleX` 0 → 1, origine à gauche | 300 ms | standard | — | Filet affiché sans transition | CSS | Proposé |
| M5 | `couleur-survol` | Survol d'un lien | Couleur encre ou sapin → cyprès ; sur sapin : ivoire → champagne | 150 ms | standard | — | Changement instantané | CSS | Proposé |
| M6 | `transition-page` | Navigation interne | Nouvelle page : `opacity` 0 → 1 (entrée seulement) | 240 ms | maison | — | Aucune | CSS ou Motion dans `template.tsx` (à valider en phase 1) | **Posé (D37)** : `template.tsx` + `TransitionPage`, CSS ; jamais au premier affichage |
| M7 | `parallaxe-hero` | Scroll dans le hero, **desktop ≥ 1024 px et pointeur fin uniquement** | Image intérieure du cadre en arche : `translateY` de 0 à −24 px sur la hauteur du hero | lié au scroll | linéaire | — | Désactivée | Motion `useScroll` + `useTransform` | P2, **Q4** |
| M8 | `menu-mobile` | Ouverture / fermeture du menu | Panneau `opacity` 0 → 1 ; entrées `translateY` 8 → 0 px | 240 ms | maison | 40 ms | Fondu seul, 120 ms | CSS | Proposé |
| M9 | `confirmation` | Affichage de la confirmation d'envoi | « K. » et message : `opacity` 0 → 1 | 600 ms | maison | 120 ms | Aucune | CSS | Proposé |
| M10 | `video-hero-fondu` | Vidéo hero prête (`canplay`) | Poster → vidéo : fondu croisé | 1 000 ms | maison | — | **Vidéo jamais chargée**, poster fixe | CSS + script de chargement | P2 |
| M11 | `focus` | Navigation clavier | Anneau **3 px** affiché | instantané | — | — | Identique | CSS `:focus-visible` | Obligatoire |
| M12 | `ancre-service` | Clic sur un choix d'entrée (`/fr#grand-age`) | Défilement fluide vers la scène, puis **focus déplacé sur son titre** (`tabindex="-1"`), `scroll-margin-top` = hauteur de l'en-tête (+ mini-menu) | natif | natif | — | Défilement **instantané**, focus déplacé quand même | CSS `scroll-behavior` (sous `no-preference`) + quelques lignes de JS pour le focus ; sans JS, l'ancre fonctionne | Proposé (spec d'entrée §2.3) |
| M13 | `video-scrub` | Scène V01 ou V07 visible, **desktop** dans les conditions vidéo | `currentTime` de la vidéo suit la progression de la scène dans le viewport | lié au scroll | linéaire | — | **Poster fixe**, aucune vidéo | JS (`requestAnimationFrame` + IntersectionObserver), sans Motion | Proposé, **2 scènes max** (brief assets §7) |
| M15 | `seuil-entree` (D19) | Sortie de l'écran 1 de l'Accueil, **desktop** dans les conditions vidéo | V01-s (avancée lente vers la fenêtre) : `currentTime` suit le défilement sur la hauteur de la scène (environ 1,5 écran), vidéo collante (`position: sticky`) pendant ce passage ; scroll natif, jamais bloqué | lié au scroll | linéaire | — | **Poster fixe**, scènes empilées | Même moteur que M13 (compte dans les 2 scènes scrub : V01-s et V07) | **Rétabli par D26** (retiré par D25 au profit de M16) ; seul geste lié au défilement de l'accueil |
| M16 | `ouverture` (D25) | Première arrivée sur l'accueil pendant la visite | Film d'environ 20 s posé sur toute la page (fenêtre modale) : un plan toutes les 3 s en fondu enchaîné d'1 s (montage `scripts/montage-ouverture.sh`), légendes en grand corps sur voile sapin à 60 % (le nom, chaque service, les pays, la phrase de la maison), fin sur « Entrer » ; sortie en fondu 700 ms | ≈ 20 s + 700 ms | maison | — | **Mêmes plans en photos**, changement sans fondu ; mobile et économie de données : photos en fondu, jamais de vidéo | JS (une fois par visite, `sessionStorage`) ; masquée sans JavaScript | **Retiré par D26** : aucune animation ne doit retarder la lecture ; le montage reste dans `scripts/montage-ouverture.sh` pour un autre usage |
| M14 | `pause-video` | Bouton « Mettre la vidéo en pause » | Arrêt / reprise, choix mémorisé pour la session | instantané | — | — | Sans objet (aucune vidéo) | HTML + JS | **Obligatoire** dès qu'une vidéo joue > 5 s (WCAG 2.2.2) |
| M17 | `film-entree` (D27, D28, prototype V5) | Accueil du prototype, **desktop** dans les conditions vidéo | Ouverture : les portes s'ouvrent seules 3 s après `load` (moins de 5 s : pas de pause exigée), puis `currentTime` suit le défilement ; voilage au premier plan qui s'écarte (`translateX` jusqu'à 105 % de sa largeur, parallaxe par calques, au-delà de M7 par choix de Sady) ; pièces collantes qui glissent l'une sur l'autre ; geste de la conciergerie lié au défilement ; légendes en cascade (M3 : `opacity` et 12 px, 90 ms d'écart) ; filet or de progression (`scaleX`) | lié au scroll ; 700 ms pour les légendes | maison | 90 ms | **Mêmes pièces en images fixes**, aucune vidéo, aucun voilage, légendes visibles d'emblée | JS (`requestAnimationFrame`, IntersectionObserver), sans Motion ni bibliothèque de défilement | **Retiré par D34** (23/10/2026) ; code dans l'historique Git (commit `673452b`) |
| M18 | `film-accueil` (D31, prototype V5) | Arrivée sur l'accueil calme du prototype, **desktop**, sans mouvement réduit, avec JavaScript, sans économie de données | Fenêtre modale de quatre plans plein cadre : chaque plan s'ouvre en cercle depuis le centre (`clip-path: circle()`, 1 400 ms) par-dessus le précédent ; la ligne du plan en cours se remplit (`scaleX`, 3,2 s, suspendue par « Pause ») ; titre et phrase entrent comme M1 ; au dernier plan, l'aplat et la bande s'effacent et la scène se resserre sur le cadre des portes de l'accueil (`clip-path: inset()` et `transform`, 1 400 ms), puis les portes s'ouvrent (5 s, une fois) | ≈ 14 s + 1 400 ms | maison | — | **Aucun film** : l'accueil tout de suite, portes fixes | CSS (transitions, `@starting-style` non requis), un composant client sans bibliothèque ; « Passer » et Échap à tout moment ; filet de sécurité : le film disparaît seul après 20 s si le script ne prend pas la main | **Retiré par D33** (23/10/2026) ; code dans l'historique Git (commit `981b0ea`) |
| M19 | `menu-panneau` (D31, prototype V5) | Ouverture du menu de l'en-tête sur les pages du prototype | Voile sapin qui apparaît ; trois aplats (pierre, cyprès, ivoire) glissent depuis la droite à 120 ms d'écart (575 ms chacun) ; les liens montent de 24 px et apparaissent en cascade (50 ms) ; au survol ou au focus d'un lien, sa pièce apparaît en fondu (300 ms) ; fermeture : tout repart ensemble | 575 ms ; 700 ms pour les liens | maison | 120 ms, 50 ms | **Ouverture et fermeture sans mouvement** | CSS (`@starting-style`, `:has()`), `<details>` : fonctionne sans JavaScript (sans fermeture animée) | **Retiré par D33** (23/10/2026) ; code dans l'historique Git (commit `981b0ea`) |
| M21 | `file-services` (D52, prototype V4) | Défilement de l'accueil sur la section des services, **desktop ≥ 1024 px avec souris** ; survol ou focus d'une carte | Scène collée (`position: sticky`) environ deux écrans ; cartes au rang p : bord gauche à u × p², largeur u × (2p + 1), réduites depuis leur coin bas gauche (`translateX`, `scale`) ; étiquette : `opacity` 0 → 1, lignes `translateY` 12 → 0 px | lié au défilement (étiquette : 300 ms, lignes 700 ms) | linéaire (étiquette : standard, lignes : maison) | lignes : 80 ms | **Services empilés**, aucune animation | CSS (`[data-zoom]`, `tokens.css`, hors couche) et composant client (rang de chaque carte au défilement, `requestAnimationFrame`) | Prototype V4, à regarder avec Cat |
| M22 | `pied-four` (D54) | Pied de page : souris, clic sur une partie vide, première apparition du nom | Disque et dalle (`transform` SVG) : penchant vers la souris (3,5 % de la largeur) et passage à la composition suivante ; lettres du nom : `translateY` 110 % → 0 à la première apparition, graisse 300 → 400 autour du pointeur ; touche : flèche qui part en haut et revient par le bas | rapprochement continu (7,5 % par image) ; nom : 1 s, graisse 300 ms ; flèche 700 ms | maison (flèche : `cubic-bezier(0.6, 0, 0.2, 1)`) | lettres : 70 ms | Disque placé sans glisser, nom affiché, flèche immobile | Composants client `PiedFond`, `PiedMot` ; CSS (`[data-pied]`, `tokens.css`) | **Validé** (Cat, D54), tout le site |

**Si Q4 est tranché en faveur de `anti-patterns.md`** : M2, M3 et M7 sont retirés ; le site garde M1 (entrée du hero, unique « mouvement » visible), les survols, la transition de page et le menu. C'est déjà suffisant pour un rendu soigné.

**Recommandation** : garder M2 et M3 dans leur forme minimale (images et titres de section seulement, jamais les paragraphes), différer M7 en P2 et ne le livrer que si Cat le remarque positivement sur une préproduction.

---

## 3. Interdits

| Interdit | Pourquoi | À la place |
|---|---|---|
| Ressorts, rebonds, élasticité (`type: "spring"`, `bounce`) | Ton ludique, contraire à la retenue | Courbe `--ease-maison` |
| Zoom au survol d'une image, `scale` > 1,02, ombre qui grandit, opacité au survol | `anti-patterns.md` n° 14 | Filet or qui se dessine (M4) |
| Animation de paragraphes, mots ou lettres (split text, machine à écrire) | Ralentit la lecture, effet démonstratif | Texte statique |
| Fondu au scroll généralisé à toutes les sections | `anti-patterns.md` n° 12 | M3 limité aux titres, sous réserve de Q4 |
| Curseur personnalisé, effet magnétique, halo qui suit la souris | `anti-patterns.md` n° 13 | Curseur système |
| Défilement « lissé » qui détourne le scroll (bibliothèques de smooth scroll) | Accessibilité, sensation de lourdeur | Scroll natif |
| Carrousel automatique, bandeau défilant | `anti-patterns.md` n° 32 | Empilement vertical |
| Compteurs animés | `anti-patterns.md` n° 31 | Chiffre écrit, ou mieux, une phrase |
| Écran de chargement, splash, logo animé à l'arrivée | Retarde le contenu, nuit au LCP | Contenu immédiat |
| Parallaxe sur le texte | Lisibilité, performance | Parallaxe image hero seule (M7) |
| Scrollytelling qui **piège** le clavier, le lecteur d'écran ou le zoom ; scène épinglée qui empêche de lire le texte | Spec d'entrée §4.3 : « l'accessibilité gagne » | Scènes empilées simplement ; scrub (M13) sans épinglage si un test le dégrade |
| Défilement détourné (« scroll hijacking ») : molette ralentie, accélérée ou capturée | Spec d'entrée §4.3 | Défilement natif, toujours |
| Boucles infinies (hors vidéo hero) | Distraction, batterie | Aucune |
| Animation de `filter`, `width`, `height`, `top`, `left`, `box-shadow` | Recalcul de mise en page, saccades | `transform` et `opacity` |
| Durée > 1,2 s, délai cumulé > 300 ms avant que le texte soit lisible | Lenteur perçue | Plafonds du §1 |
| Animation déclenchée à chaque passage | Fatigue | `once: true` |
| Lottie, GIF animés, animations de dégradés | Poids, cliché | Aucune |

---

## 4. Accessibilité

- **`prefers-reduced-motion: reduce`** : toutes les animations du catalogue sont remplacées par leur repli (colonne dédiée), soit, dans la plupart des cas, **aucune animation**. Côté Motion : `<MotionConfig reducedMotion="user">` à la racine **ne suffit pas** (il coupe les transformations mais conserve l'opacité) ; les composants de révélation lisent aussi `useReducedMotion()` et rendent alors le contenu dans son état final, sans `initial`. Côté CSS : un bloc `@media (prefers-reduced-motion: reduce)` qui neutralise `animation` et `transition` sur les éléments concernés.
- **Sans JavaScript** : les éléments révélés par Motion portent un attribut `data-reveal` ; une règle dans `<noscript>` les force à `opacity: 1; transform: none` (style autorisé par empreinte dans la CSP).
- **Vidéo** : jamais chargée en `reduced-motion` ni en `Save-Data` ; si elle joue, un contrôle pause est atteignable au clavier (WCAG 2.2.2 : contenu en mouvement de plus de 5 s).
- **Focus** : l'anneau n'est jamais animé ni masqué par une transition.
- **Clignotement** : aucun élément ne clignote plus de 3 fois par seconde (WCAG 2.3.1).

---

## 5. Performance et architecture

- **Bibliothèque** : paquet **`motion`** (v14 au 15/10/2026), successeur de Framer Motion ; le paquet `framer-motion` n'est plus qu'un alias historique, ne pas l'installer. Imports : `LazyMotion`, `domAnimation`, `MotionConfig`, `useReducedMotion`, `useScroll`, `useTransform` depuis `motion/react` ; composants `m` via `import * as m from "motion/react-m"`.
- **Chargement réduit** : `LazyMotion` avec le jeu `domAnimation` et `strict` activé, composants `m.*` uniquement (jamais `motion.*`, ~43 ko). Avec `strict`, l'usage d'un `motion.*` sous `LazyMotion` lève une erreur.
- **Client Components minimaux** : deux ou trois feuilles `'use client'` (`<Reveal>`, `<HeroParallax>`, `<MotionProvider>`) ; tout le reste en Server Components. Aucune page entière en client.
- **Budget** : `m` + `LazyMotion` ≈ 5 ko gzip, `domAnimation` + 24 ko, soit **~30 ko gzip** pour tout le mouvement (chiffres de la doc Motion, à confirmer par l'analyse de bundle en phase 1). Si M2, M3 et M7 sont retirés (Q4), Motion n'est plus nécessaire : tout passe en CSS, budget 0 ko. C'est un argument de plus pour la sobriété.
- **Pas de layout thrash** : aucune lecture de dimension dans une boucle d'animation ; `will-change` posé seulement pendant l'animation.
- **Vérification** : Lighthouse ≥ 95 sur une page avec toutes les animations actives ; CLS = 0 (aucune animation ne déplace la mise en page) ; trace Performance de Chrome sans tâche longue liée au mouvement.

---

## 6. Recette de validation (par animation)

1. Déclenchée une seule fois, au bon moment.
2. Durée et courbe conformes au catalogue (mesurées dans l'onglet Animations de Chrome DevTools).
3. Repli `reduced-motion` vérifié (émulation `prefers-reduced-motion` dans DevTools).
4. Contenu lisible avec JavaScript désactivé.
5. Aucun effet sur le LCP ni le CLS (rapport Lighthouse avant / après).
6. Passage de l'agent `art-director` : « est-ce que ça se remarque ? » Si oui, on retire.
