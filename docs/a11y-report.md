# Rapport d'accessibilité — Maison Triona

> **Statut** : premiers tests automatisés le 15/10/2026 (stories 1.1 et 1.2). Rempli par l'agent `qa-a11y-perf` à chaque story (puis par Sady pour les tests manuels). Les tests VoiceOver, NVDA, texte agrandi et mobile réel n'ont pas encore eu lieu.
> **Cible** : WCAG 2.2 niveau AA ; contraste **AAA (7:1) pour le texte courant** quand la palette le permet (`docs/ux-entry-i18n-a11y.md` §4).

---

## 1. Matrice de tests

Une ligne par page et par langue. ✅ conforme · ⛔ non conforme (avec lien vers le constat) · — non applicable.

| Page | Langue | axe (CI) | Lighthouse A11y | Clavier | VoiceOver (macOS / iOS) | NVDA (Windows) | Zoom 200 % | Texte agrandi | Reduced-motion | Mobile réel | Date | Testé par |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Banc d'essai `/demo` (interne, story 1.2) | FR | ✅ 0 violation | 100 (mobile et desktop) | ✅ ordre logique, focus visible sur lien, bouton, champs, liste | non testé | non testé | ✅ 720 px sans débordement | non testé | — (aucune animation) | non testé | 15/10/2026 | Claude (automatisé) |
| Accueil provisoire (story 1.1) | FR | ✅ 0 violation | 100 | — (aucun élément interactif) | non testé | non testé | — | non testé | — | non testé | 15/10/2026 | Claude (automatisé) |
| Accueil (entrée par besoin) | FR | | | | | | | | | | | |
| Accueil (entrée par besoin) | EN | | | | | | | | | | | |
| Services · conciergerie | FR / EN | | | | | | | | | | | |
| Services · grand âge | FR / EN | | | | | | | | | | | |
| Services · enfants | FR / EN | | | | | | | | | | | |
| La Maison | FR / EN | | | | | | | | | | | |
| Territoires | FR / EN | | | | | | | | | | | |
| Contact (+ `?service=`) | FR / EN | | | | | | | | | | | |
| Confirmation, échec, 404 | FR / EN | | | | | | | | | | | |
| Mentions légales, confidentialité | FR / EN | | | | | | | | | | | |

## 2. Points de contrôle spécifiques

| Critère | Exigence du projet | Résultat |
|---|---|---|
| 1.4.3 / 1.4.6 Contraste | Texte courant ≥ 7:1 ; paires du tableau `docs/design-tokens.md` §2.2 uniquement | Ratios recalculés au build sur `/demo` (15/10/2026), identiques à `contrast-check.mjs` : encre/ivoire 14,33 ; sapin/ivoire 10,56 ; ivoire-80/sapin 7,37 ; encre-68/ivoire 5,34. Aides de champ et sous-libellés passés en encre (AAA) après relecture DA |
| 1.4.4 / 1.4.10 Agrandissement, reflux | 200 % et 320 px de large sans perte | `/demo` : aucun débordement à 320 et 720 px ; le tableau des contrastes défile dans une zone focalisable en mobile |
| 1.4.11 Contraste des composants | Lignes de champs, focus, bordures ≥ 3:1 | |
| 2.1.1 / 2.1.2 Clavier, pas de piège | Y compris scrollytelling, menu mobile, vidéo | |
| 2.2.2 Pause | Bouton pause sur toute vidéo de plus de 5 s | |
| 2.3.3 / reduced-motion | Version statique complète (photo + texte) | |
| 2.4.1 Lien d'évitement | « Aller au contenu » en premier élément focalisable | |
| 2.4.3 Ordre du focus | Entrée par besoin → focus sur le titre de la scène choisie | |
| 2.4.7 / 2.4.11 Focus visible et non masqué | Anneau 3 px ; jamais caché par l'en-tête, le mini-menu ou la barre mobile | |
| 2.5.8 Taille des cibles | ≥ 48 px (exigence projet, au-delà du minimum de 24 px) ; entrées mobiles ≥ 56 px | Composants de base mesurés : lien 48, bouton 52, champs 48, lignes d'entrée 85 à 97 px |
| 3.1.1 / 3.1.2 Langue | `<html lang>` correct ; `lang` sur les liens FR · EN | |
| 3.2.6 Aide cohérente | Contact au même endroit sur chaque page | |
| 3.3.1 / 3.3.3 Erreurs | Messages près du champ, résumé en tête, focus sur le résumé | |
| 3.3.7 Pas de ressaisie | Valeurs conservées en cas d'erreur ou d'échec d'envoi | |
| 4.1.2 Nom, rôle, valeur | Liens d'entrée = vrais liens ; vidéo `aria-hidden` ; bouton pause nommé | |

## 3. Constats

| # | Date | Page | Critère | Constat | Gravité | Statut | Story |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
