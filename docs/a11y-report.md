# Rapport d'accessibilité — Maison Triona

> **Statut** : modèle créé en phase 0 (15/10/2026). **Aucun test n'a encore eu lieu** : le site n'existe pas. Rempli par l'agent `qa-a11y-perf` à chaque story (puis par Sady pour les tests manuels).
> **Cible** : WCAG 2.2 niveau AA ; contraste **AAA (7:1) pour le texte courant** quand la palette le permet (`docs/ux-entry-i18n-a11y.md` §4).

---

## 1. Matrice de tests

Une ligne par page et par langue. ✅ conforme · ⛔ non conforme (avec lien vers le constat) · — non applicable.

| Page | Langue | axe (CI) | Lighthouse A11y | Clavier | VoiceOver (macOS / iOS) | NVDA (Windows) | Zoom 200 % | Texte agrandi | Reduced-motion | Mobile réel | Date | Testé par |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
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
| 1.4.3 / 1.4.6 Contraste | Texte courant ≥ 7:1 ; paires du tableau `docs/design-tokens.md` §2.2 uniquement | |
| 1.4.4 / 1.4.10 Agrandissement, reflux | 200 % et 320 px de large sans perte | |
| 1.4.11 Contraste des composants | Lignes de champs, focus, bordures ≥ 3:1 | |
| 2.1.1 / 2.1.2 Clavier, pas de piège | Y compris scrollytelling, menu mobile, vidéo | |
| 2.2.2 Pause | Bouton pause sur toute vidéo de plus de 5 s | |
| 2.3.3 / reduced-motion | Version statique complète (photo + texte) | |
| 2.4.1 Lien d'évitement | « Aller au contenu » en premier élément focalisable | |
| 2.4.3 Ordre du focus | Entrée par besoin → focus sur le titre de la scène choisie | |
| 2.4.7 / 2.4.11 Focus visible et non masqué | Anneau 3 px ; jamais caché par l'en-tête, le mini-menu ou la barre mobile | |
| 2.5.8 Taille des cibles | ≥ 48 px (exigence projet, au-delà du minimum de 24 px) ; entrées mobiles ≥ 56 px | |
| 3.1.1 / 3.1.2 Langue | `<html lang>` correct ; `lang` sur les liens FR · EN | |
| 3.2.6 Aide cohérente | Contact au même endroit sur chaque page | |
| 3.3.1 / 3.3.3 Erreurs | Messages près du champ, résumé en tête, focus sur le résumé | |
| 3.3.7 Pas de ressaisie | Valeurs conservées en cas d'erreur ou d'échec d'envoi | |
| 4.1.2 Nom, rôle, valeur | Liens d'entrée = vrais liens ; vidéo `aria-hidden` ; bouton pause nommé | |

## 3. Constats

| # | Date | Page | Critère | Constat | Gravité | Statut | Story |
|---|---|---|---|---|---|---|---|
| | | | | | | | |
