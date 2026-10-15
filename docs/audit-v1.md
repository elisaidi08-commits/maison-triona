# Audit de la maquette Figma actuelle — Maison Triona

> **Date** : 15/10/2026 · **Auteur** : Claude Code (phase 0), pour Sady
> **Source** : fichier Figma `fAbQP3eV9zM6R3Bq75ehFN` (MCP Figma, lecture seule ; aucune modification du fichier)
> **Méthode** : `get_metadata`, `get_screenshot`, `get_variable_defs`, scripts `use_figma` en lecture seule (inventaire des variables, text styles, couleurs réellement appliquées) ; contrastes calculés par `docs/tools/contrast-check.mjs`.
> **Vocabulaire** : « maquette v1 » = l'état actuel des pages 01 à 08 du fichier (celle que Cat a vue) ; « charte v1 » = les pages `v1 · 02` à `v1 · 11` (brand book de septembre) ; « DA v2 » = la refonte décrite dans `docs/art-direction.md`.

---

## 0. Synthèse

1. Le fichier est **beaucoup plus complet** que ne le laisse penser le brief : 20 écrans (7 desktop, 6 iPad, 7 mobile), 16 planches de composants, un moodboard v2, les états du formulaire, 404 et une annexe des points ouverts. L'audit couvre tout.
2. Les **6 constats du brief sont confirmés**, dont 2 avec nuance : la typo display est un **substitut** (Satoshi visée, Plus Jakarta Sans en attendant), et le `letterSpacing: 12` du caption est correct dans Figma (12 %) mais **piégeux à l'export**.
3. Trois **bloquants hors design** dominent : le **logo « le sillage » n'existe pas encore**, les **photos n'ont pas de droits d'utilisation** et sont en basse définition, et **tous les textes sont fictifs** (non balisés).
4. Les documents de référence **se contredisent** (PRD, `anti-patterns.md`, Figma, brief phase 0) sur la typo, le vert, la motion, l'espacement et l'italique. Sans arbitrage, chaque agent appliquera une règle différente.
5. L'accessibilité de la maquette est **saine** : toutes les paires texte/fond passent AA. Seul échec : la ligne d'erreur terracotta (2,57:1, seuil UI 3:1).

---

## 1. Ce que contient le fichier

| Page | ID | Contenu | Remarque |
|---|---|---|---|
| 01 · Couverture | `0:1` (frame `7:12`) | Couverture charte | Encore liée aux variables **v1** (`#2D5016` sur `#F5F0E8`) |
| 02 · Fondations | `72:2` (frame `74:2`) | Planche des fondations v2 | 1920 × 9347 |
| 03 · Composants | `72:3` | 16 planches : `stamp-k` 80:2, `rule` 80:13, `logo` 80:20, `lang` 80:26, `link-text` 80:43, `nav-link` 81:2, `button` 81:43, `field-text` 82:2, `field-textarea` 82:70, `field-select` 82:138, `service-block` 84:2, `header` 85:5, `menu-mobile` 85:67, `footer` 85:103, `section-cta` 89:125 | `logo/placeholder` = wordmark texte |
| 04 · Écrans Desktop | `72:4` | D·01 Accueil `90:2`, D·02 La Maison `92:124`, D·03 Services `92:233`, D·04 Territoires `93:293`, D·05 Contact `93:411`, D·06 Confirmation `94:441`, D·07 Mentions légales `94:514` | 1440 px |
| 05 · Écrans iPad | `72:5` | I·01 Accueil `99:2` … I·06 Confirmation `102:466` | 834 px |
| 06 · Écrans Mobile | `72:6` | M·01 Accueil `104:2` … M·06 Confirmation `106:334`, M·Menu ouvert `106:382` | 390 px |
| 07 · Moodboard v2 | `72:7` (frame `109:2`) | 8 images retenues + 4 règles photo | Mention « droits à obtenir » |
| 08 · États & annexes | `72:8` | Formulaire `110:7`, Échec `111:107`, 404 D `111:213` / M `111:282`, Annexe `113:370` | Annexe = liste officielle des manques |
| v1 · 02 à 11 | `7:2` à `7:11` | Charte v1 (vision, signe, palette, typo, échelles, espacements, composants, photo, ton, à éviter) | `v1 · 03 Le signe` : « Logo en cours de refonte » |

**Variables** : deux systèmes coexistent.

| Collection | Contenu | Utilisée par |
|---|---|---|
| `maison-triona/primitives` + `/color` + `/space` (v1) | ivory `#F5F0E8`, forest `#2D5016`, olive `#4E5E47`, sage `#8FA087`, gold `#B8944D`, charcoal `#1A1A1A` ; espaces 4 à 160 | Couverture, pages charte v1 |
| `color` + `space` + `type` (v2) | ivoire `#F4EDE0`, pierre `#D8C8AE`, cyprès `#3F5A3C`, sauge `#9AAE8F`, **terracotta `#C4876A`**, or `#B8944D`, encre `#1F1E1A`, encre-68 `#1F1E1AAD` ; espaces 4…192, sections 160/112/72, marges 120/64/24, gouttières 24/20/16, `radius/default 2`, `radius/none 0`, focus 2 px ; type desktop/ipad/mobile | Tous les écrans 04 à 08 |

**Text styles** : 37, dont 5 styles charte v1 (`display/hero` 96, `display/h1` 72, `display/h2` 48, `wordmark/triona` 32, `heading/h3`, `body/*`, `label/uppercase` +8 %) et 30 styles responsives v2 (`desktop|ipad|mobile/…`). **Seule la collection v2 doit servir de source au code.**

---

## 2. Vérification des constats du brief

| # | Constat du brief | Verdict | Preuve | Précision apportée |
|---|---|---|---|---|
| 1 | Photographie : deux étalonnages, scène à table saturée au bleu vif, rien ne dit « excellence » | **Confirmé, aggravé** | `90:2` hero `cosmos_759147631` vs services `cosmos_1758708434` | S'ajoutent : lac de Côme très saturé (`cosmos_46868240`, D·04) et fenêtre sur mer froide et bleue (`cosmos_147496275`, D·03/D·05). **Aucun droit d'utilisation** (moodboard `109:2`, annexe `113:370`), basse définition (façade 896 px de large, cible 2 400 px). |
| 2 | Display Plus Jakarta Sans Medium, interlettrage très serré, rendu « startup » ; hero et Territoires en concurrence | **Confirmé, nuancé** | `90:2` : hero 88/92 `desktop/display/xl`, Territoires 64/70 `desktop/display/l` | Plus Jakarta est un **substitut** de **Satoshi** (`bascule-satoshi.js`, planche `stamp/k`, annexe). L'interlettrage est de −2 % (−0,02 em), modéré : c'est la géométrie sans-serif Medium en corps 88 qui fait « startup », pas le tracking. Le hero occupe 4 lignes desktop. |
| 3 | L'or quasi absent, « K. » minuscule ; vert plus clair que le sapin du PRD ; vert de couverture plus saturé | **Confirmé, expliqué** | Script couleurs page 04 : or = 9 occurrences, toutes le point du « K. » | « K. » en pied de page = 24 px. Trois verts coexistent : PRD `#1C3B2A`, charte v1 `#2D5016` (couverture, encore liée aux variables v1), maquette `#3F5A3C`. L'écart couverture/accueil n'est pas perçu, il est réel. |
| 4 | Bloc Contact : aplat pierre + lien souligné, point de conversion le plus faible | **Confirmé** | `section/cta` (`99:88`, `89:125`) | Moitié droite vide en desktop. Le bloc est **répété à l'identique** en fin de 4 pages : il devient du décor. Cyprès sur pierre = 4,67:1 (passe, mais de peu). |
| 5 | Services : photo alignée sur 01-02, item 03 seul avec un grand vide | **Confirmé** | iPad `99:56` : image 429 px de haut, liste 664 px ; idem desktop `90:2` | En plus : **3 services sur l'Accueil, 4 sur la page Services** (« Mise en relation » absente de l'Accueil), alors que le PRD §7 en liste 4. |
| 6a | Logo « le sillage » absent de l'en-tête | **Confirmé, plus grave** | `v1 · 03 Le signe` (`7:14`), `planche/logo` (`80:20`) | Le logo **n'existe pas** : l'arche v1 a été écartée le 24/09 (`LOGO/_archive-v1/LISEZ-MOI.txt`), le nouveau n'est pas livré. |
| 6b | Navigation petite et légère | **Nuancé** | `header` `85:5` : Manrope Regular 17 px, encre | 17 px est une taille correcte. Le vrai problème : **5 liens** (Accueil, La Maison, Services, Territoires + Contact) de même poids, alors que le PRD fixe 4 entrées max. « Accueil » double le wordmark. |
| 6c | Caption `letterSpacing: 12`, probablement 12 % mal converti | **Infirmé dans Figma, confirmé à l'export** | Text style `desktop/caption` = 12 % ; `get_variable_defs` sur `99:2` renvoie `letterSpacing: 12` sans unité (et `-2` pour le display) | Règle pour le code : **tout letterSpacing Figma est un pourcentage → diviser par 100 et l'exprimer en `em`**. Arbitrage ouvert dans l'annexe : +12 % (brief) ou +8 % (`anti-patterns.md` n° 28). |

---

## 3. Nouveaux constats

| ID | Constat | Où | Impact |
|---|---|---|---|
| N1 | **Logo inexistant**. FR7 (logo en en-tête, pied, favicon) et la story 1.3 sont bloqués. Un placeholder typographique est en place. | `7:14`, `80:20` | Bloquant story 1.3 |
| N2 | **Photos sans droits** (images issues d'un moodboard Cosmos, sources inconnues) et **basse définition** (677 à 1 280 px de large). Les 4 photos Unsplash du dossier sont en HD mais **écartées** par le moodboard. 3 vidéos `cosmos_*.mp4` (1080 × 1350 max, une avec piste audio) : provenance et droits inconnus. | `109:2`, `ASSETS PHOTO MAQUETTE/` | Bloquant mise en ligne |
| N3 | **Tous les textes sont fictifs** et **non balisés**, ce qui contredit le PRD §7 (`[CONTENU À FOURNIR PAR CAT]`). Les mentions légales contiennent des valeurs inventées (capital, siège, numéros). Arbitrage ouvert : « Catriona » ou « Cat » sur le site. | Annexe `113:370` | Bloquant mise en ligne ; risque de publier du faux |
| N4 | **Deux systèmes de tokens** dans le même fichier (v1 et v2) et des text styles charte v1 encore présents. Un agent qui lit `get_variable_defs` sur la couverture récupère le mauvais vert. | Variables, `7:12` | Risque d'erreur d'extraction |
| N5 | **Conflits entre documents de référence** (détail au §5). Le plus structurant : `anti-patterns.md` **interdit le fade-in au scroll** (n° 12), limite les transitions de page à 150 ms et proscrit l'italique décoratif (n° 18), ce que le brief phase 0 demande. | `anti-patterns.md` vs brief §3-4 | Bloquant motion et typo |
| N6 | Le **moodboard v2 fixe la règle 02 « Plein cadre : aucun arrondi »**, qui contredit le **motif d'arche** de la DA v2. | `109:2` | À arbitrer |
| N7 | **Territoires « Au-delà »** illustré par le lac de Côme et cité avec Majorque : deux lieux **hors des 5 pays**. Message à valider par Cat (promesse commerciale implicite). | D·04 `93:293` | Contenu |
| N8 | **Corps 12 px très présents** (36 occurrences sur mobile : labels de formulaire, captions, numéros) en capitales. Lisible mais fatigant pour une partie du public (familles d'un parent âgé, clientèle mûre). | Pages 04-06 | Confort de lecture |
| N9 | **Sélecteur « Pays / zone » sans chevron** (arbitrage 03 de l'annexe) : un select natif sans affordance est peu découvrable. Une rangée de choix BE · FR · LU · MC · CH · Autre serait plus accessible et plus rapide. | `110:7`, `82:138` | A11y, conversion |
| N10 | L'écran d'échec promet « Votre message n'est pas perdu : il est resté dans le formulaire ». C'est une **contrainte d'implémentation** : conserver l'état du formulaire en cas d'erreur serveur. | `111:107` | Architecture formulaire |
| N11 | **Pas d'écran « Confidentialité »** maquetté (seulement Mentions légales D·07) et **pas de version EN** (annexe : « à produire »). | Pages 04-08 | Epic 4 |
| N12 | Le wordmark d'en-tête (Plus Jakarta 24 px) et le « K. » de pied ne sont reliés à **aucun text style**. | `85:5`, `85:103` | Cohérence système |
| N13 | Le formulaire est **bien pensé** : résumé d'erreurs en tête (lu par les lecteurs d'écran), messages en encre, états vide / saisie / erreur / envoi en cours. À conserver tel quel. | `110:7` | Point fort |
| N14 | Le **ton des textes est juste** (concret, sans buzzword, conforme à `anti-patterns.md` n° 17 et 22) : « Vingt ans à orchestrer, en silence. », « Aucun tarif n'est publié. », « Chaque demande est lue personnellement ». À conserver comme base de travail, sous réserve de validation par Cat. | D·02, D·03 | Point fort |

---

## 4. Contrastes WCAG des paires réellement utilisées

Paires extraites par script de toutes les couches texte et filets des pages 04, 06 et 08 ; ratios calculés par `node docs/tools/contrast-check.mjs`. Les alphas sont composés sur leur fond.

| Avant-plan | Fond | Ratio | Usage réel | Verdict |
|---|---|---|---|---|
| cyprès `#3F5A3C` | ivoire `#F4EDE0` | 6,58:1 | Titres, nav active, liens, CTA (17 à 88 px) | OK AA |
| encre `#1F1E1A` | ivoire | 14,33:1 | Corps, nav, labels (12 à 20 px) | OK AAA |
| encre-68 `#1F1E1AAD` (= `#636059`) | ivoire | 5,34:1 | Placeholders, EN inactif, séparateurs | OK AA |
| encre | pierre `#D8C8AE` | 10,16:1 | Corps du bloc Contact | OK AAA |
| cyprès | pierre | 4,67:1 | Titre et lien du bloc Contact | OK AA (marge faible) |
| or `#B8944D` | ivoire | 2,44:1 | Point du « K. » | Exempté (logotype, WCAG 1.4.3) |
| encre-68 | ivoire | 5,34:1 | Ligne des champs au repos | OK (UI ≥ 3:1) |
| cyprès | ivoire | 6,58:1 | Soulignement bouton, anneau de focus | OK (UI ≥ 3:1) |
| sauge `#9AAE8F` | ivoire | 2,04:1 | Filets, soulignement désactivé | Décoratif / état désactivé (exempté) |
| terracotta `#C4876A` | ivoire | 2,57:1 | Ligne d'erreur des champs | **Échec UI 1.4.11** (atténué : l'erreur est aussi portée par le texte) |
| forest v1 `#2D5016` | ivory v1 `#F5F0E8` | 8,15:1 | Couverture | OK AAA |
| olive v1 `#4E5E47` | ivory v1 | 6,14:1 | Sous-titre de couverture | OK AA |

**À retenir**
- La maquette est **conforme AA sur tout le texte**. Les marges sont confortables, sauf cyprès sur pierre (4,67:1) et encre-68 sur pierre (4,53:1).
- **Terracotta** : proposer `#A66A4E` (3,76:1 sur ivoire) pour la ligne d'erreur, ou une ligne de 2 px (voir `docs/design-tokens.md`).
- **L'or `#B8944D` ne peut jamais porter de texte sur ivoire** (2,44:1) ni sur pierre (1,73:1). Sur sapin profond, il passe pour un filet ou une bordure (4,32:1, UI), pas pour du texte courant : utiliser alors le champagne clair `#D2B98A` (6,47:1).
- Tableaux complets (v1, v2 proposée, PRD) : `docs/design-tokens.md` §3.

---

## 5. Écarts avec le PRD et conflits entre documents

### 5.1 Écarts maquette ↔ PRD

| Sujet | PRD | Maquette | Écart / action |
|---|---|---|---|
| Vert signature | sapin `#1C3B2A` | cyprès `#3F5A3C` | Plus clair, plus doux. À trancher (question Q2). |
| Ivoire | `#F7F2E7` | `#F4EDE0` | Plus chaud, plus pierre. Garder `#F4EDE0` (brief). |
| Champagne | `#D2B98A` + `#E8DAB8` | Absent ; seul l'or antique `#B8944D` | Réintroduire `#D2B98A` pour l'or sur fond sombre. |
| Texte | `#1A1A17` | `#1F1E1A` | Équivalent. Garder Figma. |
| Display | Serif (Cormorant, Playfair, didone) | Sans (Satoshi visée, Plus Jakarta en substitut) | À trancher (Q1). |
| Texte courant | Inter | Manrope | Manrope acté par le brief. |
| Navigation | 4 entrées max | 5 liens + sélecteur | Retirer « Accueil » (le logo y mène). |
| FR7 logo | En-tête, pied, favicon | Placeholder texte | Logo à livrer (Q5). |
| §7 Services | 4 univers | 3 sur l'Accueil, 4 sur Services | Aligner l'Accueil sur 4 univers. |
| §7 Placeholders | `[CONTENU À FOURNIR PAR CAT]` | Textes fictifs non balisés | Statut à trancher (Q9). |
| FR8 pages légales | Mentions, confidentialité, cookies | Mentions seulement | Maquetter Confidentialité ; page cookies inutile si aucun cookie (voir `docs/architecture.md`). |
| FR5 EN | FR + EN | FR seulement | Version EN à produire. |
| §6.4.3 photo | « Jamais de banque d'images clichée » | Images de moodboard, sources inconnues | Q6. |

### 5.2 Conflits entre documents de référence

Ordre de priorité fixé par le brief : **brief phase 0 > PRD** sur la direction artistique, **PRD > brief** sur le fonctionnel. `anti-patterns.md` (Sady, 24/09, « contraignant, un item violé = un bug bloquant ») n'est pas cité par le brief : il faut l'arbitrer explicitement.

| Sujet | PRD | `anti-patterns.md` | Figma | Brief phase 0 | Proposition |
|---|---|---|---|---|---|
| Display | Cormorant / Playfair | Cormorant + Inter, ou Fraunces + Instrument Sans ; Instrument Serif proscrit en combo avec Space Grotesk (n° 19) | Satoshi (Plus Jakarta en substitut) | Serif : Cormorant, Newsreader ou Instrument Serif | Serif retenue par banc d'essai ; Instrument Serif en dernier (signature 2024-2025 citée par n° 19) |
| Texte | Inter | Inter | Manrope | Manrope | **Manrope** |
| Apparition au scroll | « transitions douces » | **Interdit** (n° 12) | — | Reveal fondu + 16 px, une fois | À trancher (Q4). Reco : reveal **limité au hero et aux images**, texte statique |
| Transition de page | — | Fondu 150 ms max | — | Fondu ≤ 400 ms | 240 ms (compromis) |
| Italique | — | 1 par page max, sens réel (n° 18) | Aucun | « Mot en italique possible dans le hero » | Aucun italique en V1 du hero ; à tester au banc d'essai |
| Espacements | — | 4…160, base 8 stricte (n° 15) | 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192 + sections 160/112/72, marges 120/64/24, gouttières 24/20/16 | 4…96 + section 112 | **Figma v2** (plus fin, déjà appliqué) ; mettre à jour `anti-patterns.md` (l'annexe Figma le demande, arbitrage 08) |
| Rayon | — | 0 ou 2 px max | 2 (UI), 0 (images) | 0 | **0 partout**, 2 px réservé à l'anneau de focus |
| Tracking caption | — | +8 % (n° 28) | +12 % | ≈ 0,12 em | **+0,12 em** (brief), en `em` |
| Arche | — | — | Moodboard règle 02 : aucun arrondi | Motif d'arche (2-3 occurrences) | À trancher (Q4) ; reco : **une seule arche** (hero) |
| Pied de page | — | Minimal, une ligne (n° 30) | 3 colonnes | « K. » plus grand, filet or, liens légaux | Pied minimal 2 niveaux (voir DA) |
| Bouton CTA | — | Texte souligné, sans flèche | Texte + filet 1 px dessous | Fine bordure or | Bordure or **sur fond sapin uniquement** ; souligné ailleurs |

---

## 6. Priorisation

Effort : **XS** < 1 h · **S** ≤ ½ j · **M** 1-2 j · **L** > 2 j ou dépendance externe.

### P0 · bloquant (avant la phase 1 ou avant la mise en ligne)

| ID | Action | Porteur | Effort | Bloque |
|---|---|---|---|---|
| P0-1 | Arbitrer les conflits du §5.2 et mettre `anti-patterns.md` à jour | Sady | S | Tokens, motion, typo |
| P0-2 | Choisir la serif display par banc d'essai (story 1.2) | Sady + Cat | M | Toute la typo |
| P0-3 | Fixer le vert signature (sapin `#1C3B2A` ou cyprès `#3F5A3C`) | Sady + Cat | XS | Tokens |
| P0-4 | Livrer le logo « le sillage » en SVG (+ favicon) | Cat / designer | L | Story 1.3 (contournable par le wordmark) |
| P0-5 | Droits et HD des photos, ou bascule vers des visuels générés | Cat + Sady | L | Mise en ligne |
| P0-6 | Domaine + adresse de réception des demandes | Cat | XS | Story 3.3 (envoi et e-mails) |
| P0-7 | Statut des textes fictifs (brouillons balisés ou placeholders) | Cat | M | Mise en ligne |
| P0-8 | Bloc Contact en sapin profond, texte ivoire, bouton à filet or, réassurance | Phase 1 | S | Conversion |

### P1 · forte valeur, faible risque (phase 1)

| ID | Action | Effort |
|---|---|---|
| P1-1 | Hiérarchie titres : hero serif plus mesuré, Territoires ramené au niveau titre (h2) | S |
| P1-2 | Services : 4 univers alignés Accueil ↔ Services ; lignes de hauteur égale, filets or | S |
| P1-3 | En-tête : logo + wordmark, 4 entrées (sans « Accueil »), FR · EN discret | S |
| P1-4 | Pied de page : « K. » 48 px, filet or, liens légaux, une ligne en desktop | S |
| P1-5 | Étalonnage photo unique (grade chaud, désaturé, grain fin) et remplacement de la scène à table | M |
| P1-6 | Nettoyer Figma : relier la couverture aux variables v2, marquer la collection v1 « deprecated » | S |
| P1-7 | Ligne d'erreur terracotta → `#A66A4E` | XS |
| P1-8 | Pays / zone en rangée de choix (BE · FR · LU · MC · CH · Autre) | S |
| P1-9 | Maquetter la page Confidentialité et la version EN | M |
| P1-10 | Planche de conversion Figma → code (letterSpacing %, interlignes px) | XS |

### P2 · finitions (après validation de la v2 statique)

| ID | Action | Effort |
|---|---|---|
| P2-1 | Motif d'arche (selon arbitrage Q4) | S |
| P2-2 | Carte au trait très abstraite pour Territoires | M |
| P2-3 | Vidéo hero (après poster validé et budget perf tenu) | L |
| P2-4 | Labels de formulaire et captions à 13 px minimum | XS |
| P2-5 | Remplacer ou retirer le lac de Côme (hors zone) | XS |
| P2-6 | Relier wordmark et « K. » à des text styles | XS |

---

## 7. Captures de référence

Les captures ont été générées par `get_screenshot` pendant l'audit (URL temporaires, non conservées dans le dépôt). Pour les reproduire, demander « capture du node `<ID>` » avec le fichier `fAbQP3eV9zM6R3Bq75ehFN`.

| Sujet | Node |
|---|---|
| Accueil desktop / iPad / mobile | `90:2` / `99:2` / `104:2` |
| Hero iPad (texte, image) | `99:48`, `99:51` |
| Services iPad (rang, image, liste) | `99:56`, `99:57`, `99:58` |
| Territoires iPad | `99:84` |
| Bloc Contact (instance, planche) | `99:88`, `89:125` |
| Header, footer, menu mobile | `85:5`, `85:103`, `106:382` |
| Cachet « K. », bouton, logo placeholder | `80:2`, `81:43`, `80:20` |
| États du formulaire, échec, 404 | `110:7`, `111:107`, `111:213` |
| Moodboard v2, annexe | `109:2`, `113:370` |
| Couverture (variables v1) | `7:12` |
| Charte v1 « Le signe » | `7:14` |

---

## 8. Décisions postérieures à l'audit (15/10/2026)

Deux documents de Sady sont arrivés après cet audit et en tranchent plusieurs points. L'audit reste un instantané de la maquette ; ce qui suit fait foi.

| Point de l'audit | Décision | Source |
|---|---|---|
| N2, P0-5 · photos sans droits | **Tous les visuels seront générés par IA** (Higgsfield) ; aucune photo ni vidéo existante n'est publiée | `docs/assets-ia-brief.md` §0 |
| Q7 · vidéo en mobile | **Aucune vidéo téléchargée en mobile** ; photos fixes | Brief assets §7, spec d'entrée §2.4 |
| P1-2, §5.1 · 3 ou 4 univers | **3 services** ; la mise en relation est le modèle de la maison, expliqué dans chaque service | `docs/ux-entry-i18n-a11y.md` §2.2 |
| Hero | Devient l'**entrée par besoin** (4 choix en vrais liens) sur la vidéo V01 | Spec d'entrée §2 |
| Langues | URL `/fr` et `/en` toujours préfixées, aucun cookie de langue | Spec d'entrée §3.1 |
| Accessibilité | Cible relevée à **WCAG 2.2 AA**, corps 18 px, cibles 48 px, texte courant AAA quand possible | Spec d'entrée §4 |
| Vidéo liée au scroll | Autorisée sur 1 ou 2 scènes, sans jamais piéger le clavier, le lecteur d'écran ni le zoom | Brief assets §7, spec d'entrée §4.3 |
