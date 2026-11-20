# Rapport d'accessibilité — Maison Triona

> **Statut** : premiers tests automatisés le 15/10/2026 (stories 1.1 et 1.2), pré-passe automatisée de la story 5.3 le 19/11/2026 (§0 bis). Rempli par l'agent `qa-a11y-perf` à chaque story (puis par Sady pour les tests manuels). Les tests VoiceOver, NVDA, appareils mobiles réels et tests utilisateurs n'ont pas encore eu lieu.
> **Cible** : WCAG 2.2 niveau AA ; contraste **AAA (7:1) pour le texte courant** quand la palette le permet (`docs/ux-entry-i18n-a11y.md` §4).

---

## 0. Relevé du 18/11/2026 (point de contrôle ③, lot C)

- **axe** (WCAG 2.2 AA, `tests/a11y/pages.spec.ts`) : 0 violation sur les 32 adresses testées, FR et EN : accueil, services, pages de service, La Maison, Territoires, FAQ, Comment ça se passe et sa version simple, Notre indépendance, contact, mentions légales, confidentialité, accessibilité, démo, 404.
- **Lighthouse 13** : accessibilité 100 partout ; performance 96 à 100 ; SEO et bonnes pratiques 100 ; CLS 0. LCP mobile de 2,0 à 2,8 s sur les pages de texte (story 5.3).
- **Clavier, sans JavaScript, impression** : couverts par les tests e2e (FAQ en `<details>`, menu, lien d'évitement à 48 px, partage, impression des pages de réassurance).
- **Non fait** : VoiceOver, NVDA, zoom 200 %, appareils mobiles réels, tests utilisateurs (5.4). La déclaration d'accessibilité (`/fr/accessibilite`) le dit.

## 0 bis. Pré-passe de la story 5.3 du 19/11/2026 (automatisée)

Build de production (`main` après la 3.10), Chromium par Playwright, **34 adresses** FR et EN : toutes celles de `tests/a11y/pages.spec.ts` (plus `/en/services/childcare`, ajoutée à la liste d'axe), `/fr/contact?service=grand-age` et la 404 anglaise. Navigateur en anglais : sur les pages françaises, la suggestion de langue est affichée, ce qui est le cas le plus contraignant pour le bas de l'écran.

| Contrôle | Méthode | Résultat |
|---|---|---|
| Clavier (2.1.1, 2.1.2, 2.4.1, 2.4.7) | Tabulation jusqu'au retour au premier élément, à 1280 × 800 et 390 × 844, défilement doux attendu | ✅ 19 à 40 arrêts par page, aucun piège ; « Aller au contenu » en premier (153 × 48 px au focus) ; anneau de 3 px sur chaque arrêt |
| Focus non masqué (2.4.11) | Centre et coins de l'élément focalisé, comparés à l'élément affiché à cet endroit | ⛔ puis ✅ : deux cas corrigés (constats n° 1 et 2) ; plus aucun focus masqué à 1280 et 390 |
| Reflux (1.4.10) | Largeur 320 px | ✅ aucun débordement horizontal |
| Zoom 200 % (1.4.4) | 1280 × 800 à 200 % = 640 × 400 | ✅ aucun débordement ; avec la suggestion de langue et la barre mobile, 129 px fixes sur 400 en bas d'écran (refermable) |
| Texte agrandi | Taille de police du navigateur simulée (`html` à 150 % et 200 %) ; les tailles du site sont en `rem` et suivent | ✅ 200 % à 1280 px et 150 % à 390 px sur les 34 adresses ; ⚠️ 200 % à 390 px (constat n° 4, au-delà du critère) |
| Espacement du texte (1.4.12) | Interlignage 1,5, lettres 0,12 em, mots 0,16 em, paragraphes 2 em, à 390 px | ✅ aucun débordement ni texte rogné |
| Contraste des composants (1.4.11) | Couleurs calculées du formulaire, sans JavaScript (4 étapes visibles) | ✅ filet des champs encre 68 % sur ivoire ≈ 5,3:1 ; boutons radio et cases natifs `accent-sapin` (bordure grise de Chromium ≈ 3,9:1) |
| Mouvement réduit (2.3.3) | `prefers-reduced-motion: reduce` | ✅ aucune animation en cours, aucune vidéo |
| Titres (1.3.1) | Ordre des `h1` à `h6` visibles | ✅ un seul `h1` par page, aucun niveau sauté |
| Langue (3.1.1, 3.1.2) | `<html lang>`, liens de changement de langue | ✅ `lang` conforme à l'adresse ; liens FR · EN et suggestion de langue marqués dans leur langue |
| Aide cohérente (3.2.6) | Lien Contact de l'en-tête et du pied de page | ✅ même position dans l'en-tête sur toutes les pages, présent au pied de page partout |
| axe (CI) | `tests/a11y/pages.spec.ts` | ✅ 0 violation, 35 adresses |

Tests ajoutés : `tests/e2e/focus-non-masque.spec.ts` (sommaires collants, bouton pause de l'immersion, « Close » à 48 px). Ils échouaient avant la correction. **Restent manuels** : VoiceOver (macOS et iOS), NVDA, appareils mobiles réels, tests utilisateurs (5.4), Lighthouse des pages de la 3.10 (`/contact/appel/…`, avec une base).

## 0 ter. Relevé automatisé du 20/11/2026 (story 5.3, après les stories 2.16, 3.9 et 3.13)

Build de production de `main` (e50bafb, avant la typographie D76), agent `qa-a11y-perf`. Puis contrôles du texte agrandi et du reflux refaits sur `main` avec Inter (D76) et la correction D73.

| Contrôle | Résultat |
|---|---|
| axe (`npm run test:a11y`) | ✅ 43 sur 43, 0 violation ; les pages de la 3.9 (`/contact/appel`, `/envoye`, FR et EN) sont dans la liste |
| e2e sans base (`npm run test:e2e`) | ✅ 204 réussis, 2 ignorés (coffre, avec base) |
| Lighthouse 13, mobile et desktop | ✅ 100 partout en performance, accessibilité et bonnes pratiques sur l'accueil, Grand âge, La Maison, FAQ, Contact, demande de lien ; LCP mobile 0,9 s au plus (2,0 à 2,8 s le 18/11) ; CLS 0. ⛔ SEO 86 sur la demande de lien (constat n° 7) |
| Reflux 320 × 800, 37 adresses | ✅ aucun défilement en largeur |
| 1280 px à 400 % (320 × 200, 320 × 256) | ⛔ puis ✅ : Territoires (constat n° 6) |
| 390 px, texte à 200 % | ⛔ puis ✅ : 9 pages avant D73, aucune après sur les 36 pages publiques (constat n° 4) |
| Cibles et focus du pied de page neuf (2.16) et des pages de demande de lien | ✅ cibles ≥ 48 × 48, anneau de 3 px, aucun focus masqué |
| Réseau et console | ✅ aucune requête tierce, aucune erreur, aucun cookie |

**Pas testé** : pages à jeton de la réservation (avec base), Lighthouse des autres pages publiques, INP et poids avant LCP, clavier complet page par page (fait sur 6 pages), VoiceOver, NVDA, appareils réels.

## 1. Matrice de tests

Une ligne par page et par langue. ✅ conforme · ⛔ non conforme (avec lien vers le constat) · — non applicable.

| Page | Langue | axe (CI) | Lighthouse A11y | Clavier | VoiceOver (macOS / iOS) | NVDA (Windows) | Zoom 200 % | Texte agrandi | Reduced-motion | Mobile réel | Date | Testé par |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Banc d'essai `/demo` (interne, story 1.2) | FR | ✅ 0 violation | 100 (mobile et desktop) | ✅ ordre logique, focus visible sur lien, bouton, champs, liste | non testé | non testé | ✅ 720 px sans débordement | non testé | — (aucune animation) | non testé | 15/10/2026 | Claude (automatisé) |
| Accueil provisoire (story 1.1) | FR | ✅ 0 violation | 100 | — (aucun élément interactif) | non testé | non testé | — | non testé | — | non testé | 15/10/2026 | Claude (automatisé) |
| Accueil (entrée par besoin) | FR | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ | ⚠️ [n° 4](#3-constats) | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Accueil (entrée par besoin) | EN | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ | ⚠️ [n° 4](#3-constats) | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Services (immersion) | FR / EN | ✅ 0 violation | 100 | ✅ après [n° 2](#3-constats) | non testé | non testé | ✅ | ⚠️ [n° 4](#3-constats) | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Services · conciergerie | FR / EN | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ | ⚠️ FR [n° 4](#3-constats) | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Services · grand âge | FR / EN | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ | ✅ | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Services · enfants | FR / EN | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ | ✅ | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| La Maison | FR / EN | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ | ✅ | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Territoires | FR / EN | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ (carte : [n° 5](#3-constats)) | ✅ | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| FAQ | FR / EN | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ | ✅ | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Comment ça se passe, langage simple | FR / EN | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ | ✅ | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Notre indépendance | FR / EN | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ | ⚠️ [n° 4](#3-constats) | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Contact (+ `?service=`) | FR / EN | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ | ⚠️ FR [n° 4](#3-constats) | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Confirmation, 404 | FR / EN | ✅ 0 violation | 100 | ✅ | non testé | non testé | ✅ | ✅ | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Mentions légales, confidentialité, accessibilité | FR / EN | ✅ 0 violation | 100 | ✅ après [n° 1](#3-constats) | non testé | non testé | ✅ | ⚠️ confidentialité FR [n° 4](#3-constats) | ✅ | non testé | 19/11/2026 | Claude (automatisé) |
| Réservation d'appel `/contact/appel/…` (3.10) | FR / EN | ✅ 0 violation (tests de la 3.10) | à mesurer | non testé ici | non testé | non testé | non testé | non testé | non testé | non testé | — | — |

## 2. Points de contrôle spécifiques

| Critère | Exigence du projet | Résultat |
|---|---|---|
| 1.4.3 / 1.4.6 Contraste | Texte courant ≥ 7:1 ; paires du tableau `docs/design-tokens.md` §2.2 uniquement | Ratios recalculés au build sur `/demo` (15/10/2026), identiques à `contrast-check.mjs` : encre/ivoire 14,33 ; sapin/ivoire 10,56 ; ivoire-80/sapin 7,37 ; encre-68/ivoire 5,34. Aides de champ et sous-libellés passés en encre (AAA) après relecture DA |
| 1.4.4 / 1.4.10 Agrandissement, reflux | 200 % et 320 px de large sans perte | `/demo` : aucun débordement à 320 et 720 px ; le tableau des contrastes défile dans une zone focalisable en mobile. 19/11/2026 : 34 adresses sans débordement à 320 et 640 px (§0 bis) |
| 1.4.11 Contraste des composants | Lignes de champs, focus, bordures ≥ 3:1 | 19/11/2026 : filet des champs ≈ 5,3:1, radios et cases natifs ≈ 3,9:1, anneau sapin sur ivoire 10,56:1, champagne sur sapin 6,47:1 |
| 1.4.12 Espacement du texte | Aucune perte avec les espacements du critère | 19/11/2026 : ✅ 34 adresses à 390 px |
| 2.1.1 / 2.1.2 Clavier, pas de piège | Y compris scrollytelling, menu mobile, vidéo | 19/11/2026 : ✅ parcours complet de chaque page jusqu'au retour au début, à 1280 et 390 px |
| 2.2.2 Pause | Bouton pause sur toute vidéo de plus de 5 s | 19/11/2026 : ✅ bouton présent et nommé sur l'immersion des services et les pages de service |
| 2.3.3 / reduced-motion | Version statique complète (photo + texte) | 19/11/2026 : ✅ aucune animation en cours, aucune vidéo |
| 2.4.1 Lien d'évitement | « Aller au contenu » en premier élément focalisable | 19/11/2026 : ✅ premier arrêt partout (sauf la 404 statique, sans en-tête), 153 × 48 px au focus |
| 2.4.3 Ordre du focus | Entrée par besoin → focus sur le titre de la scène choisie | |
| 2.4.7 / 2.4.11 Focus visible et non masqué | Anneau 3 px ; jamais caché par l'en-tête, le mini-menu ou la barre mobile | 19/11/2026 : ✅ après correction des constats n° 1 et 2, suggestion de langue affichée ; test `focus-non-masque.spec.ts` |
| 2.5.8 Taille des cibles | ≥ 48 px (exigence projet, au-delà du minimum de 24 px) ; entrées mobiles ≥ 56 px | Composants de base mesurés : lien 48, bouton 52, champs 48, lignes d'entrée 85 à 97 px. 19/11/2026 : « Close » de la suggestion de langue porté à 48 px de large (constat n° 3) ; radios natifs de 24 px dans une ligne cliquable ≥ 48 px |
| 3.1.1 / 3.1.2 Langue | `<html lang>` correct ; `lang` sur les liens FR · EN | 19/11/2026 : ✅ |
| 3.2.6 Aide cohérente | Contact au même endroit sur chaque page | 19/11/2026 : ✅ en-tête (même position) et pied de page |
| 3.3.1 / 3.3.3 Erreurs | Messages près du champ, résumé en tête, focus sur le résumé | |
| 3.3.7 Pas de ressaisie | Valeurs conservées en cas d'erreur ou d'échec d'envoi | |
| 4.1.2 Nom, rôle, valeur | Liens d'entrée = vrais liens ; vidéo `aria-hidden` ; bouton pause nommé | |

## 3. Constats

| # | Date | Page | Critère | Constat | Gravité | Statut | Story |
|---|---|---|---|---|---|---|---|
| 1 | 19/11/2026 | `/fr/confidentialite` (1280 × 800) | 2.4.11 | Le sommaire collant, plus haut que la fenêtre, donnait le focus à ses trois derniers liens hors de l'écran, sans défilement possible | Important | Corrigé : sommaire limité à la place libre, qui défile seul (`sommaire-collant`, aussi sur La Maison) | 5.3 |
| 2 | 19/11/2026 | `/fr/services` (bureau, suggestion de langue affichée) | 2.4.11 | Le bouton pause de l'immersion, au pied de la scène collante, était entièrement masqué par la suggestion de langue | Important | Corrigé : bouton remonté de la hauteur du bandeau (`translate`, CLS 0) ; même protection pour le bouton des pages de service | 5.3 |
| 3 | 19/11/2026 | Toutes les pages, langue du navigateur différente | 2.5.8 (exigence 48 px du projet) | « Close » de la suggestion de langue mesurait 39 px de large (le minimum AA de 24 px était tenu) | Mineur | Corrigé | 5.3 |
| 4 | 19/11/2026 | Accueil, services, contact FR, Notre indépendance, conciergerie FR, confidentialité FR (390 px) | Au-delà de 1.4.4 | Avec le texte du navigateur à 200 % sur un téléphone, la page défile en largeur : un mot long d'un titre ne tient pas (« Accompagnement » en `title-h2`, 481 px), et le menu fermé déborde. Rien à 150 % | Mineur | **Corrigé le 20/11/2026** (D73) : coupure sans tiret des mots trop longs pour la ligne (`overflow-wrap: anywhere` sur `body`), sans césure ; plus aucun défilement en largeur sur les 36 pages publiques FR et EN (test `titres-texte-agrandi.spec.ts`), affichage normal inchangé (captures identiques). Le menu fermé n'était pas en cause (relevé du 20/11, §0 ter). À revoir sur un vrai téléphone | 5.3 |
| 5 | 19/11/2026 | `/fr/territoires`, `/en/where-we-work` (320 px) | — (visuel) | Étiquettes de la carte qui se chevauchent (« Suisse » sur une autre). La carte est `aria-hidden` et les pays sont repris en texte juste au-dessus : aucune information perdue | Mineur | Ouvert | 5.3 |
| 6 | 20/11/2026 | `/fr/territoires`, `/en/where-we-work` (1280 × 800 et 1280 × 1024 à 400 %, soit 320 px à l'horizontale) | 1.4.10 | La page défilait de 15 px en largeur : à l'horizontale, la carte et le texte passaient en deux colonnes de 128 px, trop étroites pour « Luxembourg » et « Switzerland ». La pré-passe ne mesurait 320 px qu'en portrait | Important | Corrigé le 20/11/2026 : deux colonnes à l'horizontale seulement dès 568 px de large (35,5 rem) ; une colonne en dessous (test dans `territoires-carte.spec.ts`) | 5.3 |
| 7 | 20/11/2026 | `/fr/contact/appel`, `/en/contact/call` (Lighthouse) | — (seuil SEO du projet) | SEO à 86 : pas de meta description (aussi `/contact/appel/envoye`, `/contact/call/sent`, `/contact/merci`), pages en `noindex` | Mineur | Ouvert : descriptions FR et EN à ajouter en brouillon, validation de Cat (choix de Sady du 20/11/2026) | 5.3 |
| 8 | 20/11/2026 | `/en/the-house`, `/fr/la-maison` | — (rendu) | Le prénom « Catriona », isolé dans un `<span data-nosnippet>`, s'affiche parfois avec un dessin différent du reste de la phrase sur les captures de Chromium, d'une capture à l'autre ; même police et même largeur mesurées à chaque fois | Mineur | Ouvert : à vérifier dans Safari et Chrome réels | 5.3 |
