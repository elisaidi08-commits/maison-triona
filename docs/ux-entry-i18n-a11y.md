<!--
Spec rédigée par Sady (PO), enregistrée telle quelle le 15/10/2026 (sections 1 à 7).
Les annexes A à D (après la section 7) sont les propositions de Claude demandées en §7.
-->

# MAISON TRIONA — by K. · SPEC « ENTRÉE PAR BESOIN » + i18n FR/EN + ACCESSIBILITÉ

> **Statut** : 3ᵉ complément du prompt Claude Code. À placer dans `docs/ux-entry-i18n-a11y.md`.
> Ordre de priorité en cas de conflit : **ce document** > brief assets IA (storyboard §3) > prompt Phase 0 (§3-4) > PRD (design). Le PRD reste la référence fonctionnelle (formulaire, RGPD, SEO).
> **Phase 0 = zéro code applicatif** : tu écris uniquement dans `docs/`, `.claude/`, `CLAUDE.md`.
> Auteur / PO : Sady. Cliente : Cat (« K. »).

---

## 1. Objectif

Dès le premier écran, le visiteur dit **ce dont il a besoin** et arrive **directement** sur le service concerné, sans scroller « pour scroller ». Le site reste **minimaliste, luxueux et convivial**, en **français et en anglais**, et **utilisable par tout le monde** (y compris des personnes âgées, des aidants, des lecteurs d'écran, un téléphone d'une main).

Principe : **un seul choix clair, une seule étape, puis le service.**

---

## 2. L'ENTRÉE PAR BESOIN (premier écran)

### 2.1 Décision de formulation `[À VALIDER par Sady, puis Cat]`
Ne pas demander « Vous êtes une personne âgée ? ». Raisons :
- Les demandes viennent souvent **d'un proche** (enfant, conjoint, aidant) ou d'une personne qui ne se définit pas par l'âge.
- Une étiquette « personne âgée » peut être ressentie comme stigmatisante dans une marque de luxe.

On demande plutôt **de quoi la personne a besoin**, avec des mots simples, qui conviennent à « pour moi » comme à « pour un proche ». La précision « pour qui » est posée **plus tard, dans le formulaire**, de façon facultative.

### 2.2 Contenu (FR / EN)

| | FR | EN |
|---|---|---|
| Accroche (déjà validée) | Une seconde vie, comme des vacances qui ne s'arrêtent pas. | A second life, like a holiday that never ends. |
| Question | Que pouvons-nous faire pour vous, ou pour l'un de vos proches ? | What can we do for you, or for someone close to you? |
| Choix 1 | **Organiser le quotidien** · Conciergerie de luxe | **Arrange everyday life** · Luxury concierge |
| Choix 2 | **Accompagner un proche, ou vous-même** · Accompagnement du grand âge | **Support a loved one, or yourself** · Companionship in later life |
| Choix 3 | **Veiller sur les enfants** · Garde d'enfants | **Look after the children** · Childcare |
| Choix 4 | **Je ne sais pas encore** · Parlons-en, en toute discrétion | **I'm not sure yet** · Let's talk, in complete discretion |

- Le choix 4 mène **directement au formulaire** (`/contact`).
- La « mise en relation avec les meilleurs indépendants » est le **modèle** de la maison, pas un choix à part : elle est expliquée dans chaque service.
- Les textes sont **indicatifs**. Marque `[CONTENU À FOURNIR PAR CAT]` tant que Cat n'a pas validé.

### 2.3 Comportement
- **Ce sont de vrais liens** (`<a href>`), pas des boutons JS : ils fonctionnent sans JavaScript, au clavier, au lecteur d'écran, et peuvent être partagés.
- Destination de chaque choix : l'ancre de la **scène du service** sur l'accueil (`/fr#grand-age`) **et** une page dédiée (`/fr/services/grand-age`) pour le SEO et les liens directs. `[À TRANCHER dans docs/architecture.md : recommandation = les deux, l'accueil pointant vers l'ancre, la page dédiée existant pour le partage]`.
- Au clic : défilement fluide vers la scène (instantané si `prefers-reduced-motion`), puis **focus déplacé sur le titre de la scène** (`tabindex="-1"`) pour que le clavier et les lecteurs d'écran suivent.
- **Aucune modale bloquante**, aucun écran de choix obligatoire : un visiteur qui ne choisit pas peut simplement scroller l'histoire.
- Après le hero, un **mini-menu discret** (3 services + contact) reste accessible pour changer de service sans remonter.
- **Pas de réordonnancement dynamique** des sections selon le choix (évite les sauts de mise en page et la complexité).
- Le choix est **transmis au formulaire** via `?service=` (ex. `/fr/contact?service=grand-age`) et **présélectionné** dans le champ « nature de la demande ». Aucun cookie ; si besoin d'un état, `sessionStorage` uniquement.

### 2.4 Desktop et mobile
- **Desktop** : hero (vidéo V01 en fond, voir brief assets) avec l'accroche, la question et les 4 choix sur une ligne ou en grille 2×2 sobre. Le visuel ne doit jamais gêner la lecture (voile ivoire/sapin, contraste vérifié).
- **Mobile** : pas de vidéo. Photo d'ambiance courte, accroche, question, puis les **4 choix en cartes empilées**, hauteur ≥ 56 px, une ligne de description max. **Tout le parcours « choisir → service → contacter » tient en 3 écrans.** Barre fixe en bas : « Écrire en toute discrétion ».

### 2.5 La scène de service (arrivée après le choix)
Structure identique pour les 3 services, courte et rassurante :
1. Titre + promesse en une phrase (ex. « Une seule interlocutrice pour tout organiser. »).
2. **3 points de réassurance** : une interlocutrice unique · des personnes choisies une à une · discrétion absolue. `[CONTENU À FOURNIR PAR CAT]` pour la formulation finale.
3. **Comment ça se passe** en 3 étapes (vous nous écrivez → Cat vous répond personnellement → mise en relation avec la bonne personne). `[À CONFIRMER avec Cat : le vrai déroulé, délais, canaux]`
4. **CTA unique** : « Parlez-nous de votre situation » (FR) / « Tell us about your situation » (EN) → formulaire prérempli.
5. Pas de tarifs, pas de liste de prestataires.

### 2.6 Points à confirmer avec Cat `[BLOQUANT pour les textes]`
- **« Garde-malade »** : Cat propose-t-elle réellement ce service ? Le PRD parle d'**accompagnement du grand âge**, pas de soins. Les soins infirmiers et la garde-malade sont **réglementés** et varient selon le pays (BE, FR, LU, MC, CH). Reste sur « accompagnement / présence » et **n'affiche aucune promesse médicale** tant que Cat n'a pas confirmé le périmètre et le cadre légal (à faire valider par un professionnel du droit, ce n'est pas un avis juridique).
- **Numéro de téléphone** : un bouton « Appeler » aiderait beaucoup les personnes âgées, mais peut contredire la discrétion voulue. Cat décide.
- **Vocabulaire** : « grand âge », « aîné », « proche » : lequel lui parle le plus ?

---

## 3. INTERNATIONALISATION : FRANÇAIS (principal) + ANGLAIS

### 3.1 Exigences
- **FR + EN complets dès la v1**, sur toutes les pages, **y compris** formulaire, erreurs, e-mails, pages légales, métadonnées SEO, `alt` des images, `aria-label`.
- Architecture **prête pour d'autres langues** (ex. néerlandais pour la Belgique, allemand pour la Suisse/le Luxembourg) sans refonte.
- **URLs localisées** : `/fr/...` et `/en/...`, avec `hreflang` + `x-default`, sitemap multilingue, `<html lang>` correct.
- **Sélecteur de langue** : discret mais **lisible** (« FR · EN », jamais de drapeaux), `lang` sur chaque lien, présent aussi sur mobile.
- **Détection** : à la première visite, **proposer** la langue du navigateur sans l'imposer. Évalue l'impact RGPD du cookie de préférence de langue (`NEXT_LOCALE` ou équivalent) : s'il n'est pas strictement fonctionnel, évite-le et préfère l'URL comme seule source de vérité.
- **Contenu** : le CMS headless gère les deux langues **champ par champ**, avec **indicateur de traduction manquante** pour Cat. Aucun contenu publié sans sa version FR **et** EN validée.
- **Pas de traduction automatique publiée sans relecture.** Le français est la source ; l'anglais est traduit avec le même ton (chaleureux, retenu) puis **relu par un humain** (Sady / Cat / relecteur natif).
- **E-mail reçu par Cat** : indique la **langue du visiteur** et le service choisi.
- **Test d'intégrité** (phase 1) : un script échoue le build si une clé existe dans une langue et pas dans l'autre.

### 3.2 Glossaire de départ (à compléter dans la skill `maison-triona-copy-fr-en`)

| FR | EN |
|---|---|
| Conciergerie de luxe | Luxury concierge |
| Accompagnement du grand âge | Companionship in later life |
| Garde d'enfants | Childcare |
| Parlons-en, en toute discrétion | Let's talk, in complete discretion |
| Demande confidentielle | Confidential enquiry |
| La maison | The house / the Maison |
| Territoires | Where we work |
| Belgique · France · Luxembourg · Monaco · Suisse | Belgium · France · Luxembourg · Monaco · Switzerland |

Ton : vouvoiement en français, formulations simples, phrases courtes ; en anglais, registre « polished but warm ».

---

## 4. ACCESSIBILITÉ « POUR TOUT LE MONDE »

**Cible : WCAG 2.2 niveau AA** (le PRD visait 2.1 AA ; 2.2 est la version récente et renforce la cible tactile et le focus). Pour le **texte courant**, vise un contraste **≥ 7:1 (AAA)** quand la palette le permet.

### 4.1 Lisibilité et langage
- Corps de texte **18 px minimum**, interligne **≥ 1,6**, longueur de ligne ≤ 70 caractères.
- Titres display à partir de 40 px seulement, jamais en petit corps.
- **Langage clair** : phrases courtes, pas de jargon ; teste la lisibilité des textes FR et EN.
- **Aucune information portée par la couleur seule**. L'or `#B8944D` n'est **jamais** une couleur de texte sur ivoire.
- Le site doit rester utilisable **zoomé à 200 %** et en **texte agrandi**, sans perte de contenu.

### 4.2 Navigation et interaction
- Tout est utilisable **au clavier** ; **focus visible** épais et contrasté ; **lien d'évitement** « Aller au contenu » ; ordre de tabulation logique.
- Zones tactiles **≥ 48 px** (les 4 choix d'entrée sont de grandes zones).
- **Pas d'interaction réservée au survol**, pas de geste complexe, pas de minuterie.
- Landmarks et titres corrects (un seul `h1` par page), liens explicites (pas de « cliquez ici »).
- **Formulaire** : étiquettes visibles, erreurs claires et placées près du champ, `autocomplete` adapté, aucune perte de saisie, aucun captcha intrusif (le honeypot du PRD suffit).

### 4.3 Mouvement et vidéo (point critique avec le scrollytelling)
- Toute vidéo qui joue plus de 5 s doit avoir un **bouton pause/lecture** accessible (critère WCAG 2.2.2). Les vidéos sont **muettes** et décoratives (`aria-hidden`).
- `prefers-reduced-motion` : **plus d'animation** de défilement ni de vidéo, mais une version **statique** complète (photo + texte).
- Le **scrollytelling ne doit jamais piéger** le clavier, le lecteur d'écran ou le zoom : le contenu doit rester **lisible sans JavaScript** et en **empilement simple** si l'effet est désactivé. Si une scène « épinglée » nuit à l'accessibilité, **l'accessibilité gagne**.
- Pas de défilement détourné (scroll hijacking) : la molette garde son comportement natif.

### 4.4 Images et médias IA
- `alt` utile, court, traduit (FR/EN) ; décoratif = `alt=""`.
- Aucune information essentielle uniquement dans une image ou une vidéo.

### 4.5 Vérifications
Axe (CI), Lighthouse ≥ 95, **test manuel clavier**, **lecteur d'écran** (VoiceOver et NVDA), zoom 200 %, mobile réel. Documente chaque résultat dans `docs/a11y-report.md`.

---

## 5. CONFIDENTIALITÉ ET MESURE (lié au choix du besoin)

- Le choix d'un service **peut révéler une situation de santé ou de vie privée** (ex. accompagnement d'un proche âgé). Considère ces informations comme **sensibles** : possibles « données de santé » au sens du RGPD si le visiteur détaille son état.
- **Dans le formulaire** : message clair « Inutile de nous donner des détails médicaux ; nous en parlerons de vive voix. » **Pas de champ santé.**
- **Analytics** : mesure **uniquement agrégée et anonyme** (ex. nombre de clics par choix d'entrée via un événement sans identifiant). **Ne stocke jamais** le choix associé à une personne ou à une adresse IP, ne le place pas dans les logs de serveur sous forme identifiante. Documente ce que tu mesures dans `docs/privacy.md`.
- **Aucune donnée** envoyée à un tiers inutile ; politique de confidentialité FR + EN à jour.
- Vérifie le **cadre légal** de chaque pays desservi avec Cat (hors périmètre technique) : cette spec n'est pas un avis juridique.

---

## 6. IMPACT SUR LES AUTRES DOCUMENTS (à mettre à jour en phase 0)

- **`docs/assets-ia-brief.md` §3 (storyboard)** : la scène **S1** devient « **hero + entrée par besoin** » (V01 en fond, texte lisible). Les scènes S3, S4, S5 deviennent les **destinations des choix 1, 2, 3**. Le choix 4 mène au contact (S7). L'ordre de défilement reste le même.
- **`docs/assets-manifest.md`** : ajoute la colonne « destination du choix » et vérifie que chaque service a au moins une photo (mobile) et une vidéo (desktop).
- **`docs/plan-implementation.md`** : ajoute les stories ci-dessous.
- **Agents** : `i18n-copy-editor` (glossaire + parité FR/EN), `qa-a11y-perf` (WCAG 2.2, vidéo/pause, zoom, lecteur d'écran), `security-privacy-reviewer` (mesure du choix, données sensibles), `art-director` (entrée sobre, luxe + convivialité).
- **Skill** `maison-triona-copy-fr-en` : glossaire §3.2, vouvoiement, langage clair, rappel « aucune promesse médicale ».

### Stories à ajouter (avec critères d'acceptation)

| ID | Story | Critères d'acceptation |
|---|---|---|
| E2-S1 | Entrée par besoin (desktop + mobile) | 4 choix en vrais liens ; fonctionne sans JS ; focus déplacé sur la scène ; mobile ≤ 3 écrans ; zones ≥ 48 px |
| E2-S2 | Scènes de service | Structure §2.5 identique ×3 ; CTA vers `/contact?service=…` ; aucun tarif |
| E3-S4 | Formulaire prérempli | `?service=` présélectionne ; message « pas de détails médicaux » ; aucune donnée sensible loggée |
| E4-S4 | i18n FR/EN complet | Parité des clés testée en CI ; `hreflang` correct ; sélecteur lisible ; e-mail indique la langue |
| E5-S5 | Accessibilité 2.2 AA | Bouton pause vidéo ; reduced-motion = version statique ; test clavier + lecteur d'écran + zoom 200 % consignés |
| E5-S6 | Mesure respectueuse | Événement anonyme par choix, aucun identifiant ; `docs/privacy.md` à jour |

---

## 7. CE QUE TU FAIS EN PHASE 0 SUR CE SUJET

1. Mets à jour les documents de la §6 ; crée `docs/ux-entry-i18n-a11y.md` (ce document) et `docs/privacy.md` (brouillon).
2. Propose **2 variantes de wireframe en texte** (structure + hiérarchie, pas de code) de l'écran d'entrée : A = 4 cartes en grille 2×2 ; B = liste verticale de 4 lignes très sobres. Recommande-en une avec ses raisons (lisibilité, luxe, mobile).
3. Écris les **textes FR et EN** de l'entrée et des 3 scènes de service en utilisant les placeholders `[CONTENU À FOURNIR PAR CAT]` pour ce qui n'est pas validé.
4. Ajoute au rapport de fin de phase 0 : les **points §2.6** (garde-malade, téléphone, vocabulaire) formulés comme des questions à une ligne pour Sady, avec **ta recommandation**.
5. Rappelle-toi la phrase finale : **« Phase 0 terminée. J'attends `GO PHASE 1`. »**

---
---

# Annexes : propositions de phase 0 (Claude, 15/10/2026)

## Annexe A · Décisions et écarts relevés

| Sujet | Proposition | Raison |
|---|---|---|
| Ancre **et** page dédiée (§2.3) | **Les deux.** Les choix de l'accueil pointent vers l'ancre (`/fr#grand-age`) ; `/fr/services/grand-age` existe pour le partage et le SEO (EN : `/en/services/later-life`) | Arrivée immédiate sur l'accueil, URL partageable et indexable ailleurs |
| Défilement et focus | `scroll-behavior: smooth` seulement sous `prefers-reduced-motion: no-preference` ; `h2` de la scène en `tabindex="-1"`, focus déplacé après l'arrivée ; `scroll-margin-top` égal à la hauteur de l'en-tête | Le titre ciblé ne doit pas finir sous l'en-tête (WCAG 2.2, critère 2.4.11 « focus non masqué ») |
| Texte sur la vidéo (§2.4) | Calcul fait (`docs/design-tokens.md` §2.4) : pour garantir AA sur **n'importe quelle** image, un voile sapin sous un texte ivoire doit être opaque à **73 %** (87 % pour AAA). **Proposition** : la question et les 4 choix sont posés sur un **aplat ivoire** (colonne de gauche, 5 colonnes sur 12) ; seul le titre peut déborder sur la vidéo, avec un voile sapin ≥ 58 % (grand texte, 3:1). Variante mesurée possible à l'ingestion (pire pixel réel du poster) | La vidéo reste visible sur plus de la moitié de l'écran, la lecture est garantie |
| Mini-menu (§2.3) | Desktop : rangée « Conciergerie · Grand âge · Enfants · Contact » qui devient collante **sous** l'en-tête une fois le hero passé. Mobile : pas de mini-menu (le menu de l'en-tête et la barre du bas suffisent) | Deux barres collantes en mobile masqueraient trop d'écran |
| Barre mobile « Écrire en toute discrétion » | Hauteur 56 px, `scroll-padding-bottom` équivalent, masquée sur `/contact` et pendant la saisie au clavier | Ne jamais masquer un élément focalisé (2.4.11) |
| Langues (§3.1) | Préfixe **toujours présent** (`/fr`, `/en`) ; `/` redirige vers `/fr` (`x-default`) ; **aucune redirection automatique** ; suggestion discrète côté navigateur (« This site is also available in English »), fermeture mémorisée en `sessionStorage` ; **cookie `NEXT_LOCALE` désactivé** | L'URL suffit à porter la langue : un cookie n'est pas strictement nécessaire, donc on s'en passe |
| Indicateur de traduction manquante | CMS : validation bloquante si FR **ou** EN est vide (publication impossible) + vue « Traductions manquantes » dans le Studio | « Aucun contenu publié sans sa version FR et EN » |
| CTA et barre mobile vs `anti-patterns.md` n° 24 | « Parlez-nous de votre situation » et « Écrire en toute discrétion » sortent de la liste autorisée (« Nous écrire », « Prendre contact ») | Cette spec prime : **mettre `anti-patterns.md` à jour** |
| WCAG 2.2 | Cible tactile 48 px (au-delà des 24 px du critère 2.5.8) ; focus 3 px ; aide cohérente (contact au même endroit sur chaque page, critère 3.2.6) ; pas de ressaisie (3.3.7) | Spec §4 |
| Corps 18 px, AAA | Corps 18 px sur tous les écrans ; texte secondaire sur sapin relevé à **ivoire 80 %** (7,4:1) ; `encre-68` réservé aux placeholders et aux éléments non textuels | Spec §4.1 |

## Annexe B · Wireframes de l'écran d'entrée

### Variante A · Grille 2 × 2

```
DESKTOP 1440 ──────────────────────────────────────────────────────────────────
 [sillage] Maison Triona        La Maison  Services  Territoires  Contact  FR·EN
┌──────────────────────────────────┬─────────────────────────────────────────────┐
│ (aplat ivoire)                   │ (vidéo V01 · poster P01-d, cadre plein)     │
│ H1  Une seconde vie, comme des   │                                             │
│     vacances qui ne s'arrêtent   │                                             │
│     pas.                         │                                             │
│ Que pouvons-nous faire pour vous,│                                             │
│ ou pour l'un de vos proches ?    │                                             │
│ ┌─────────────┐ ┌─────────────┐  │                                             │
│ │ Organiser   │ │ Accompagner │  │                                             │
│ │ le quotidien│ │ un proche…  │  │                                             │
│ │ CONCIERGERIE│ │ GRAND ÂGE   │  │                                             │
│ └─────────────┘ └─────────────┘  │                                             │
│ ┌─────────────┐ ┌─────────────┐  │                                             │
│ │ Prendre soin│ │ Je ne sais  │  │                                             │
│ │ des enfants │ │ pas encore  │  │                                             │
│ └─────────────┘ └─────────────┘  │                     [Pause]                 │
└──────────────────────────────────┴─────────────────────────────────────────────┘
MOBILE 390 : photo P01-m courte · H1 · question · 4 cartes empilées (≥ 56 px) · barre « Écrire en toute discrétion »
```
**Pour** : compact, les 4 options visibles d'un coup d'œil. **Contre** : des boîtes à bordure (registre « application », proche des anti-patterns n° 05 et 08) ; ordre de lecture ambigu en 2 colonnes pour un lecteur d'écran ; libellés longs (« Accompagner un proche, ou vous-même ») coupés dans une demi-colonne ; mise en page différente entre desktop et mobile.

### Variante B · Liste verticale (recommandée)

```
DESKTOP 1440 ──────────────────────────────────────────────────────────────────
 [sillage] Maison Triona        La Maison  Services  Territoires  Contact  FR·EN
┌──────────────────────────────────┬─────────────────────────────────────────────┐
│ (aplat ivoire)                   │ (vidéo V01 · poster P01-d, cadre plein)     │
│ H1  Une seconde vie, comme des   │                                             │
│     vacances qui ne s'arrêtent   │                                             │
│     pas.                         │                                             │
│ Que pouvons-nous faire pour vous,│                                             │
│ ou pour l'un de vos proches ?    │                                             │
│ ──────────────────────── (or)    │                                             │
│ 01  Organiser le quotidien       │                                             │
│     CONCIERGERIE DE LUXE         │                                             │
│ ──────────────────────── (or)    │                                             │
│ 02  Accompagner un proche, ou    │                                             │
│     vous-même                    │                                             │
│     ACCOMPAGNEMENT DU GRAND ÂGE  │                                             │
│ ──────────────────────── (or)    │                                             │
│ 03  Veiller sur les enfants      │                                             │
│     GARDE D'ENFANTS              │                                             │
│ ──────────────────────── (or)    │                                             │
│     Je ne sais pas encore.       │                                             │
│     Parlons-en, en toute         │                     [Pause]                 │
│     discrétion.                  │                                             │
└──────────────────────────────────┴─────────────────────────────────────────────┘

MOBILE 390
┌──────────────────────────┐   Écran 1 : photo P01-m (bande de ~200 px), H1 (44 px),
│ Maison Triona      Menu  │   question, 4 lignes pleine largeur (≥ 56 px chacune)
│ [photo P01-m, courte]    │   Écran 2 : la scène du service (titre, promesse,
│ H1 Une seconde vie…      │   3 points de réassurance)
│ Que pouvons-nous faire…? │   Écran 3 : 3 étapes + « Parlez-nous de votre
│ ─────────────────────── │   situation » → formulaire prérempli
│ 01 Organiser le quotid. ›│
│ ─────────────────────── │
│ 02 Accompagner un proche │
│ ─────────────────────── │
│ 03 Prendre soin des enf. │
│ ─────────────────────── │
│    Je ne sais pas encore │
├──────────────────────────┤
│ Écrire en toute discrétion│  ← barre fixe, 56 px
└──────────────────────────┘
```
(Le « › » du croquis mobile n'est qu'un repère de lecture : aucune icône, la ligne entière est le lien.)

**Recommandation : variante B.**
- **Lisibilité** : une seule colonne, des libellés entiers sur une ligne, un ordre de lecture unique ; un lecteur d'écran annonce « liste, 4 éléments ».
- **Luxe** : une liste typographique à filets or, comme un carnet ou une carte de restaurant, dans la continuité de la liste des services ; aucune boîte, aucun pictogramme.
- **Mobile** : la même structure que sur desktop (pas de recomposition), des lignes pleine largeur faciles à toucher d'une main.
- **Vidéo** : la colonne de texte est étroite, la vidéo occupe plus de la moitié de l'écran.
- Le choix 4 est volontairement **moins appuyé** (pas de numéro, ton de conversation) : c'est une porte de sortie, pas un service.

## Annexe C · Textes FR / EN

Statut de tous les textes ci-dessous : **brouillon**, `[À VALIDER PAR CAT]` sauf mention contraire. Rien n'est publié sans sa validation (garde-fou `check:content`).

### C.1 Écran d'entrée
| Élément | FR | EN |
|---|---|---|
| H1 (accroche, **validée**) | Une seconde vie, comme des vacances qui ne s'arrêtent pas. | A second life, like a holiday that never ends. |
| Question (h2) | Que pouvons-nous faire pour vous, ou pour l'un de vos proches ? | What can we do for you, or for someone close to you? |
| Choix 1 | Organiser le quotidien · CONCIERGERIE DE LUXE | Arrange everyday life · LUXURY CONCIERGE |
| Choix 2 | Accompagner un proche, ou vous-même · ACCOMPAGNEMENT DU GRAND ÂGE | Support a loved one, or yourself · SENIOR COMPANIONSHIP |
| Choix 3 | Veiller sur les enfants · GARDE D'ENFANTS | Look after the children · CHILDCARE |
| Choix 4 | Je ne sais pas encore. Parlons-en, en toute discrétion. | I'm not sure yet. Let's talk, in complete discretion. |
| Mini-menu | Conciergerie · Grand âge · Enfants · Contact | Concierge · Companionship in later life · Childcare · Contact |
| Barre mobile | Écrire en toute discrétion | Write to us in confidence |
| Bouton vidéo | Mettre la vidéo en pause / Lire la vidéo | Pause the video / Play the video |
| Suggestion de langue | Ce site existe aussi en français. · Passer en français · Fermer | This site is also available in English. · Switch to English · Close |

### C.2 Scènes de service (structure identique)

| Élément | Conciergerie de luxe | Accompagnement du grand âge | Garde d'enfants |
|---|---|---|---|
| Titre (h2) FR | Conciergerie de luxe | Accompagnement du grand âge | Garde d'enfants |
| Titre EN | Luxury concierge | Companionship in later life | Childcare |
| Promesse FR | Une seule interlocutrice pour tout organiser. | Des journées qui gardent leur rythme et leurs plaisirs. | Une présence choisie, pour quelques heures ou pour une saison. |
| Promesse EN | One person to arrange everything for you. | Days that keep their rhythm and their pleasures. | A trusted presence, for a few hours or a whole season. |
| Réassurance FR | `[CONTENU À FOURNIR PAR CAT]` (pistes de la spec : une interlocutrice unique · des personnes choisies une à une · une discrétion absolue) | idem | idem |
| Réassurance EN | `[CONTENT TO BE PROVIDED BY CAT]` (A single point of contact · People chosen one by one · Complete discretion) | idem | idem |
| Étapes FR `[À CONFIRMER AVEC CAT]` | 1. Vous nous écrivez. 2. Cat vous répond personnellement. 3. Elle vous présente la bonne personne. | idem | idem |
| Étapes EN | 1. You write to us. 2. Cat replies to you personally. 3. She introduces you to the right person. | idem | idem |
| Le modèle (mise en relation) FR | Chaque personne que la maison vous présente, Cat la connaît personnellement. | idem | idem |
| Le modèle EN | Every person we introduce to you is someone Cat knows personally. | idem | idem |
| Précision FR | — | `[À CONFIRMER]` Pour tout besoin médical, nous vous orientons vers les professionnels de santé adaptés. (phrase de Cat, D39) | — |
| Précision EN | — | `[TO BE CONFIRMED]` For any medical need, we will refer you to the appropriate health professionals. | — |
| CTA FR | Parlez-nous de votre situation | idem | idem |
| CTA EN | Tell us about your situation | idem | idem |
| Lien | `/fr/contact?service=conciergerie` | `/fr/contact?service=grand-age` | `/fr/contact?service=enfants` |

« Cat » ou « Catriona » : décision en attente (question du rapport de phase 0).

### C.3 Formulaire (ajouts de la spec)
| Élément | FR | EN |
|---|---|---|
| Champ facultatif « pour qui » | Pour qui ? (facultatif) · Pour moi · Pour un proche · Je préfère ne pas le dire | Who is it for? (optional) · For myself · For someone close to me · I'd rather not say |
| Aide sous le message | Inutile de nous donner des détails médicaux ; nous en parlerons de vive voix. | There's no need to share any medical details; we'll talk about it in person. |
| Nature de la demande (présélectionnée par `?service=`) | Conciergerie de luxe · Accompagnement du grand âge · Garde d'enfants · Je ne sais pas encore | Luxury concierge · Companionship in later life · Childcare · I'm not sure yet |

## Annexe D · Documents mis à jour en conséquence

`docs/assets-ia-brief.md` (§3) · `docs/assets-manifest.md` (destinations, couverture) · `docs/art-direction.md` (hero, entrée, scènes, barre mobile) · `docs/design-tokens.md` (18 px, 48 px, focus 3 px, AAA, voiles) · `docs/motion-spec.md` (ancre et focus, scrub, pause) · `docs/architecture.md` (routes, i18n, formulaire, mesure) · `docs/plan-implementation.md` (stories E2-S1 à E5-S6) · `docs/privacy.md` (créé) · `docs/a11y-report.md` (modèle créé) · agents `i18n-copy-editor`, `qa-a11y-perf`, `security-privacy-reviewer`, `art-director`, `media-producer` · skills `maison-triona-copy-fr-en`, `maison-triona-qa`, `maison-triona-design-system`, `maison-triona-media`.
