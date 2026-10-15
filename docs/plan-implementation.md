# Plan d'implémentation — Maison Triona

> **Statut** : v3, proposition phase 0 (15/10/2026). Révise le PRD §9 en y intégrant la DA v2 (`docs/art-direction.md`), le mouvement (`docs/motion-spec.md`), le brief assets IA (`docs/assets-ia-brief.md`, `docs/assets-manifest.md`), la spec d'entrée par besoin (`docs/ux-entry-i18n-a11y.md`, prioritaire), puis les specs **confiance, contact, sécurité, lancement** (`docs/trust-contact-launch.md`), **SEO** (`docs/seo-strategy.md`) et **partenaires** (`docs/partners-credibility.md`, phase 2).
> **Démarrage** : uniquement sur message explicite **`GO PHASE 1`** de Sady.
> **Règle d'or** : une story à la fois. À la fin de chaque story visuelle, **arrêt obligatoire** au point de contrôle (§3). Aucun enchaînement automatique d'un écran à l'autre.

---

## 1. Deux pistes en parallèle

| Piste | Qui | Quoi |
|---|---|---|
| **A · Développement** | Claude Code (agents), validé par Sady | Stories des epics 1 à 5 et 7 (§4) ; epic 6 en phase 2 |
| **B · Assets IA** | Sady génère dans Higgsfield ; `media-producer` prépare, contrôle, ingère | Lots 0 à 3 du manifeste (§5) |

La piste A n'attend pas la piste B : les stories visuelles avancent avec des **aplats de remplacement** (sapin, pierre) au ratio final, jamais avec une image du moodboard. Seule la story 2.5 (vidéo) exige le lot 1.

Les **réponses de Cat** (FAQ, déroulé, indépendance, délais, conservation) et l'**avis juridique** (vocabulaire réglementé, base légale, HDS) ne bloquent pas le développement : les pages avancent avec des brouillons balisés, mais **rien ne part en production** tant que `check:content` n'est pas vert.

---

## 2. Vue d'ensemble de la piste A (phase 1)

| Ordre | Story | Réf. spec | Réf. PRD | ⛳ | Effort | Bloquée par |
|---|---|---|---|---|---|---|
| 0 | Arbitrages de phase 0 | — | — | — | Sady | — |
| 1 | 1.1 Initialisation et qualité | — | 1.1 | — | ½ j | — (D17 : dossier actuel) |
| 2 | 1.2 Tokens + banc d'essai serif | — | 1.2 | ⛳ | 1 j | Serif, vert |
| 3 | 1.3 Logo, favicon, image OG | — | 1.3 | ⛳ | ½ j | Logo SVG (contournable) |
| 4 | 1.4 Layout global + squelette i18n (`/fr`, `/en`) | E4-S4 (partiel) | 1.4 | ⛳ | 1 j | — |
| 5 | **1.5 Préproduction protégée** | **E5-S7** | — | — | ½ j | Vercel Pro |
| 6 | **2.1 Entrée par besoin** (desktop + mobile) | **E2-S1** | 2.1 | ⛳ | 1 j | Textes (brouillons balisés) |
| 7 | 2.2 Accueil : scènes S2 à S7, statiques (+ emplacement partenaires vide) | E6 (préparation) | 2.1 | ⛳ | 1 j | — |
| 8 | **2.3 Scènes et pages de service** (× 3) | **E2-S2** | 2.3 | ⛳ | 1½ j | Textes ; vocabulaire réglementé (avis juridique) |
| 9 | 2.4 Mouvement | — | — | ⛳ | 1 j | Arbitrage Q4 |
| 10 | 2.5 Médias vidéo (+ scrub) | E5-S5 (pause) | — | ⛳ | 1½ j | **Lot 1** de la piste B |
| 11 | 2.6 La Maison | — | 2.2 | ⛳ | ½ j | — |
| 12 | 2.7 Territoires | — | 2.4 | ⛳ | ½ j | — |
| 13 | **2.8 FAQ** | **E2-S3** | — | ⛳ | 1 j | Réponses de Cat (brouillons sinon) |
| 14 | **2.9 Comment ça se passe + langage simple + PDF** | **E2-S4** | — | ⛳ | 1½ j | Déroulé et délais validés par Cat |
| 15 | **2.10 Notre indépendance** | **E2-S5** | — | ⛳ | ½ j | Confirmations de Cat, relecture juridique |
| 16 | **2.11 Partage familial** | **E2-S6** | — | ⛳ | ½ j | Choix `navigator.share` |
| 17 | **3.1 Formulaire en étapes** | **E3-S5** | 3.1 | ⛳ | 1½ j | Variante de wireframe (A recommandée) |
| 18 | **3.2 Coffre sécurisé** | **E3-S8** | — | — | 2½ j | Option D.7, durée de conservation, base légale |
| 19 | **3.3 Envoi, e-mails, confirmation, échec** | **E3-S9** | 3.2 | ⛳ | 1½ j | Domaine, fournisseur e-mail, contenu de la notification |
| 20 | **3.4 Formulaire prérempli** | **E3-S4** | — | ⛳ | ½ j | — |
| 21 | 3.5 Anti-abus | — | 3.3 | — | ½ j | — |
| 22 | **3.6 Rappel à la demande** | **E3-S6** | — | ⛳ | 1 j | Q téléphone et créneaux |
| 23 | **3.7 Situation urgente** *(conditionnelle)* | **E3-S7** | — | ⛳ | ½ j | D04 : sans doute close sans code `[À CONFIRMER]` |
| 24 | **4.1 i18n FR/EN complète** | **E4-S4** | 4.1 | ⛳ | 1 j | Traduction relue |
| 25 | 4.2 CMS | — | PRD §8 | — | 1½ j | Choix du CMS |
| 26 | **7.1 Revalidation de l'étude SEO** | **E7-S1** | — | — | ½ j | Pays prioritaires |
| 27 | **7.2 Architecture SEO et briefs de contenu** | **E7-S2** | — | — | 1 j | Faits fournis par Cat |
| 28 | **4.3 SEO technique** | **E7-S3** | 4.2 | — | 1 j | Domaine |
| 29 | **7.3 Visibilité dans les moteurs IA** | **E7-S6** | — | — | ½ j | 2.8, 2.9 |
| 30 | 4.4 Pages légales, RGPD, mention IA, déclaration d'accessibilité | — | 4.3 | ⛳ | 1 j | Données légales réelles, avis juridique |
| 31 | 5.1 En-têtes de sécurité (site + coffre) | — | 5.1 | — | ½ j | — |
| 32 | **5.2 Mesure respectueuse + Search Console** | **E5-S6**, **E7-S5** | 5.2 | — | 1 j | Compte Plausible, domaine |
| 33 | **5.3 Accessibilité 2.2 AA + performance** | **E5-S5** | 5.3 | ⛳ | 1½ j | — |
| 34 | **5.4 Tests utilisateurs** | **E5-S8** | — | ⛳ | 1½ j (+ corrections) | 5 participants recrutés |
| 35 | **5.5 Checklist de lancement et mise en production** | **E5-S9** | 5.4 | ⛳ | 1 j | Domaine, contenus et images validés, avis juridique |
| 36 | **7.4 Audit `claude-seo`** | **E7-S4** | — | — | 1 j | **Après le lancement** (D13) ; accord de Sady, code du plugin relu |

Total estimé : **~35 jours** de développement assisté (v2 : ~20), hors attentes de validation, hors production des assets, hors corrections issues des tests utilisateurs.

**Phase 2** (après la mise en ligne) : epic 6, partenaires (§4), ~2½ jours, puis une page de fond par mois (briefs E7-S2).

---

## 3. Point de contrôle visuel ⛳

À la fin de chaque story marquée ⛳, Claude Code **s'arrête** et remet à Sady :
1. Captures pleine page en **1440**, **834** et **390**, plus `prefers-reduced-motion` (stories 2.4, 2.5) et le parcours mobile complet « choisir → service → contacter » (stories 2.1, 2.3, 3.4). Formulaire en étapes et rappel (3.1, 3.6) : chaque étape **avec** JavaScript, plus la page complète **sans** JavaScript. Pages de réassurance (2.8 à 2.10) : aussi la version imprimée.
2. Les écarts avec la maquette Figma et la DA v2 (agent `art-director`).
3. Le rapport `qa-a11y-perf` (axe, contrastes, clavier ; Lighthouse dès la story 2.1) et la mise à jour de `docs/a11y-report.md`.
4. La liste des contenus et visuels encore provisoires.

Puis **attend** « OK story X.Y ». Une demande de correction relance la même story.

---

## 4. Stories de la piste A

### Definition of Done commune
- `npm run lint`, `npm run typecheck`, build de production : OK.
- `anti-patterns.md` (annexe B, mis à jour après les arbitrages) ; aucune classe Tailwind arbitraire ; aucun token contourné.
- Aucun appel réseau tiers, aucun secret, **aucune référence au moodboard** (`cosmos_`, `docs/moodboard`) dans `src/` ou `public/`.
- **WCAG 2.2 AA** sur les pages touchées, FR et EN : axe 0 violation, clavier, focus 3 px visible et jamais masqué, cibles ≥ 48 px, corps 18 px, texte courant à 7:1 quand la palette le permet.
- À partir de 2.1 : Lighthouse ≥ 95 (Perf, A11y, SEO) mobile et desktop ; INP ≤ 200 ms.
- Parité FR/EN des clés touchées (`check-i18n`) ; textes provisoires balisés.
- Toute page publique : `title` et `description` uniques par langue, `canonical`, `hreflang` FR/EN/`x-default` (skill `maison-triona-seo` §3).
- Toute story qui touche une demande : **aucune donnée de demande dans les journaux** (vérifié), revue `security-privacy-reviewer`.

### Story 0 · Arbitrages (Sady)
**Avancement au 15/10/2026** : décisions D01 à D16 dans `docs/decisions.md` (coffre Scaleway, wireframe A, notification minimale, délai de 48 heures, partage épuré, Belgique d'abord, pas d'outils SEO payants ni de fiche Google). `GO PHASE 1` confirmé (D16) ; dépôt dans le dossier actuel (D17). Restent ouverts : serif (au banc d'essai 1.2), vert, logo, Q4, Q9, domaine, CMS, mention IA.

Réponses aux questions des rapports de phase 0 ; mise à jour de `anti-patterns.md` (typographie, espacements, mouvement, scrub, CTA, barre mobile, pied de page, focus, **n° 21 à 23** selon `docs/art-direction.md` §9) ; emplacement du dépôt ; validation du storyboard (brief assets §3) ; choix de l'option technique du coffre (`docs/trust-contact-launch.md` annexe D.7) ; demande d'avis juridique lancée (`docs/seo-strategy.md` §K, `docs/privacy.md` §9).

### Epic 1 · Fondations

**1.1 Initialisation et qualité** — Next.js 16.4, TypeScript strict, Tailwind 4.3, ESLint, Prettier, `.nvmrc`, `.env.example`, `.gitignore` et `.vercelignore` (moodboard, `media-incoming/`, dossiers de travail), dépôt **privé**. Scripts `dev`, `build`, `lint`, `typecheck`, `format`, `test:e2e`, `test:a11y`, `lighthouse`, `check:content`, `check:third-party`, `check:i18n`. Déplacer `docs/tools/ingest-media.sh` vers `scripts/`. CI : lint, typecheck, format, build.
**CA** : le projet démarre ; la CI passe ; aucun fichier de travail suivi par Git.

**1.2 Tokens et banc d'essai ⛳** — `src/styles/tokens.css` (`docs/design-tokens.md`), palettes par défaut supprimées ; page `/fr/demo` (`noindex`) : palette et ratios, échelle typographique, filets, cachet, bouton, champs, liste d'entrée ; banc d'essai des serifs sur ivoire et sur sapin.
**CA** : `bg-red-500`, `text-sm`, `mt-6` ne compilent pas et `p-4` vaut 4 px (token d'échelle, plus les 16 px de Tailwind) ; corps 18 px ; focus 3 px ; Sady choisit la serif sur pièce. *Réalisation* : la démo est servie sur `/demo` jusqu'à la story 1.4, puis déplacée sous `/fr/demo`.

**1.3 Logo, favicon, image OG ⛳** — SVG « le sillage » dans `public/brand/` ; favicon ; OG FR et EN (composition typographique sur un recadrage de P01-d quand il existe, sinon sur ivoire). Sans logo : wordmark et emplacement réservé, story laissée ouverte.

**1.4 Layout global et squelette i18n ⛳** — next-intl, `localePrefix: 'always'`, `/` → `/fr`, sans détection serveur ni cookie ; en-tête (4 entrées, FR · EN avec `lang` sur chaque lien), pied de page (« K. », liens légaux, mention IA si retenue), lien d'évitement, repères ARIA ; suggestion de langue refermable.
**CA** : en-tête et pied présents partout ; clavier complet, menu mobile fermable par Échap ; 360 → 1440 px ; bascule FR/EN sans perte de page.

**1.5 Préproduction protégée (E5-S7)** — Protection standard de Vercel + **liens partageables** pour Cat (sans compte, révocables) ; `X-Robots-Tag: noindex` vérifié (ajouté par nous si un domaine personnalisé est attribué à la branche) ; base de préproduction distincte ; fournisseur e-mail en mode test. Repli : authentification simple dans `proxy.ts` quand `VERCEL_ENV = preview`.
**CA** : URL inaccessible sans lien ni compte ; `noindex` présent (en-tête et robots) ; **aucune donnée réelle** ; Cat ouvre une préproduction datée et commente par captures annotées.

### Epic 2 · Accueil, scènes et pages

**2.1 Entrée par besoin ⛳ (E2-S1)** — Hero S1 selon la variante retenue (B recommandée) : titre, question, **4 choix en vrais liens** vers les ancres (`#conciergerie`, `#grand-age`, `#enfants`) et `/fr/contact` ; aplat ivoire sous le texte, emplacement vidéo réservé (aplat sapin au ratio 16:9 tant que P01-d n'existe pas) ; mobile : bande photo, 4 lignes ≥ 56 px, barre « Écrire en toute discrétion » ; défilement vers la scène (instantané en reduced-motion) et **focus sur son titre** ; mini-menu desktop.
**CA** : fonctionne **sans JavaScript** ; focus déplacé sur la scène ; parcours mobile « choisir → service → contacter » en **3 écrans** ; zones ≥ 48 px (≥ 56 px pour les choix) ; aucune modale ; aucun réordonnancement de sections ; focus jamais masqué par la barre mobile ni le mini-menu.

**2.2 Accueil : scènes S2 à S7, statiques ⛳** — Scènes « La maison », Territoires, Contact (S7) dans l'ordre du storyboard ; aplats de remplacement au ratio final ; aucune animation. **Emplacement partenaires** : composant `PartnersBand` branché sur la requête publique filtrée (`docs/architecture.md` §5.1), qui **ne rend rien** tant qu'aucun partenaire n'est validé.
**CA** : structure du storyboard ; Lighthouse ≥ 95 ; rendu fidèle à la DA v2 ; aucune trace de la section partenaires dans le HTML avec zéro partenaire.

**2.3 Scènes et pages de service ⛳ (E2-S2)** — Composant de scène unique (`docs/art-direction.md` §7.8) instancié 3 fois sur l'accueil et sur `/fr/services/{conciergerie,grand-age,enfants}` ; CTA « Parlez-nous de votre situation » vers `/contact?service=…` ; liens vers « Comment ça se passe », la FAQ et « Notre indépendance ».
**CA** : structure identique × 3 ; aucun tarif, aucune liste de prestataires, **aucune promesse médicale**, aucun terme réglementé non validé (`docs/seo-strategy.md` §K) ; CTA correct ; pages dédiées indexables, ancres partageables.

**2.4 Mouvement ⛳** — Catalogue de `docs/motion-spec.md` (M1, M4 à M6, M8, M9, M11, M12 ; M2 et M3 selon Q4 ; M7 en P2).
**CA** : conformité au catalogue ; repli reduced-motion ; contenu lisible sans JS ; LCP et CLS inchangés ; JS de mouvement ≤ 30 ko gzip.

**2.5 Médias vidéo ⛳** — Intégration de V01 à V03 (lot 1) puis des suivantes : poster LCP, chargement conditionnel, une vidéo à la fois, **bouton pause** (M14), scrub sur V01 et/ou V07 (M13).
**CA** : Lighthouse ≥ 95 **vidéo comprise** ; aucune vidéo en mobile, en reduced-motion ni en Save-Data ; pause atteignable au clavier ; poids conformes (`docs/media-pipeline.md` §3) ; scrub sans piège clavier, lecteur d'écran ni zoom.

**2.6 La Maison ⛳ · 2.7 Territoires ⛳** — une story et un point de contrôle par page.
**CA** : contenus balisés ; a11y 2.2 AA ; 360 → 1440 px ; Lighthouse ≥ 95 ; aucune image ni légende de lieu identifiable.

**2.8 FAQ ⛳ (E2-S3)** — `/fr/faq`, `/en/faq` ; 8 questions de `docs/trust-contact-launch.md` annexe B.1, réponses depuis le CMS ; `<details>`/`<summary>` natifs, **une ancre par question** (ouverte à l'arrivée par l'ancre), ouvertes à l'impression ; la question « délai » masquée tant que Cat ne s'engage pas ; JSON-LD `FAQPage` léger (sans résultat enrichi attendu).
**CA** : contenu lisible **sans JS** ; accordéon utilisable au clavier et annoncé correctement ; FR/EN ; aucune réponse inventée (`check:content`).

**2.9 Comment ça se passe + langage simple + PDF ⛳ (E2-S4)** — 5 étapes (annexe B.2), version en langage simple (`/langage-simple`, `/easy-read`), page imprimable et **PDF balisé FR/EN** généré au build (`docs/architecture.md` §6.8).
**CA** : 4 à 5 étapes ; version simple liée depuis la page et le PDF ; PDF avec texte réel, langue, titres, signets, contrôlé (PAC ou veraPDF) ; **aucun délai non validé** ; PDF absent tant que le texte n'est pas validé.

**2.10 Notre indépendance ⛳ (E2-S5)** — Squelette conditionnel (annexe B.3) : chaque bloc rendu seulement si `confirme_par_cat` ; liens vers la FAQ et, en phase 2, vers « Comment nous choisissons ».
**CA** : seulement des affirmations validées par Cat ; relu juridiquement ; FR/EN ; aucun montant.

**2.11 Partage familial ⛳ (E2-S6)** — `ShareLinks` sur « Comment ça se passe », les pages de service et la FAQ : `mailto:` prérempli FR/EN, « Copier le lien » (message `aria-live`), lien vers le PDF ; feuille `print.css` des pages de réassurance ; `navigator.share` seulement si Sady le valide.
**CA** : `mailto:` correct dans les deux langues ; copie annoncée aux lecteurs d'écran ; sans JS, le lien reste visible ; **aucun widget ni script tiers** ; impression lisible sans navigation.

### Epic 3 · Contact et coffre

**3.1 Formulaire en étapes ⛳ (E3-S5)** — Un seul formulaire HTML en 4 `fieldset` (`docs/architecture.md` §6.1 et §6.2), variante de wireframe retenue (A recommandée) : titre d'étape qui reçoit le focus, filet de progression, Retour ; sans JS, les 4 parties à la suite ; brouillon `sessionStorage` limité à besoin, pays, langue, créneau ; mention des services d'urgence quand « urgent » est coché ; case de consentement ; labels visibles, `autocomplete`, résumé d'erreurs, ligne terracotta, valeurs conservées.
**CA** : 4 écrans ; fonctionne **sans JS** ; brouillon **non sensible** uniquement (vérifié dans le stockage du navigateur) ; mot libre **jamais** sauvegardé ; consentement requis ; erreurs près du champ et annoncées ; focus sur le résumé ; aucune ressaisie (WCAG 3.3.7) ; INP ≤ 200 ms au changement d'étape.

**3.2 Coffre sécurisé (E3-S8)** — Base UE de l'option retenue, chiffrement au repos ; sealed box (clé publique côté serveur, clé privée déchiffrée dans le navigateur de l'admin, copie de secours hors ligne) ; `/coffre` : 2 comptes nominatifs, mot de passe + TOTP obligatoire (passkey en complément), inscriptions fermées, verrouillage ; liste triable sur les colonnes en clair ; lecture, export et suppression **journalisés** ; tâche de rétention ; procédures écrites (perte de clé, restauration et rejeu des suppressions). Versions des bibliothèques vérifiées à ce moment-là.
**CA** : chiffré, hébergé UE ; A2F obligatoire ; journal d'accès ; durée de conservation appliquée et suppression effective (sauvegardes : fenêtre documentée dans `docs/privacy.md`) ; **aucune donnée dans les logs** ; une fuite simulée de la base ne révèle aucun nom ni message ; revue `security-privacy-reviewer`.

**3.3 Envoi, e-mails, confirmation, échec ⛳ (E3-S9)** — Server Action : validation, écriture dans le coffre **et** dans la boîte d'envoi (même transaction), redirection vers `/contact/merci` ; notification minimale à Cat (lien vers le coffre), confirmation fixe au visiteur, alerte technique à Sady ; reprises par Vercel Cron ; webhooks de rebonds et plaintes ; écran d'échec sans perte de saisie ; page de confirmation (« K. » 64 px). Délivrabilité : `docs/email-deliverability.md`.
**CA** : SPF, DKIM, DMARC alignés ; tests de réception documentés (Gmail, Outlook, Proton, Apple) ; **aucun pixel de suivi** ni lien traqué ; reprise prouvée (fournisseur coupé en test) ; aucune demande perdue ; confirmation **sans écho** du contenu ; aucune donnée en clair dans les logs.

**3.4 Formulaire prérempli ⛳ (E3-S4)** — `?service=` présélectionne la nature de la demande (étape 1) ; `?s=` renseigne la source anonyme (liste fermée) ; aide « Inutile de nous donner des détails médicaux… » ; aucun champ santé.
**CA** : présélection correcte pour les 4 valeurs, sans JS compris ; valeur inconnue ignorée sans erreur ; **aucune donnée sensible journalisée** (vérifié dans les logs) ; `?s=` jamais transmis à la mesure.

**3.5 Anti-abus** — Honeypot, horodatage signé, limitation de débit (IP hachée, adresse de confirmation), taille de requête limitée, sur le formulaire et le rappel.
**CA** : robots bloqués (tests E2E) ; aucun captcha visible ; une même adresse ne reçoit pas plus de N confirmations par jour.

**3.6 Rappel à la demande ⛳ (E3-S6)** — `/contact/rappel` : nom, numéro, langue, créneau et jours, « Ne pas laisser de message vocal », consentement ; même coffre (type `rappel`), même notification.
**CA** : créneau, langue et « pas de message vocal » visibles dans le coffre ; confirmation claire ; sans JS ; mêmes protections que 3.5.

**3.7 Situation urgente ⛳ (E3-S7, conditionnelle)** — *Décision D04 : Cat répond sous 24 à 48 h dans tous les cas ; proposition : pas de lien d'en-tête, story close sans code `[À CONFIRMER]`.* Seulement si Cat valide qu'elle peut y répondre : lien discret (en-tête, contact) vers une variante courte, marquée « prioritaire » dans le coffre et l'objet de la notification ; mention des services d'urgence avec les numéros vérifiés (annexe D.5, revérifiés avant l'ouverture).
**CA** : implémentée seulement si Cat valide ; mention des services d'urgence ; **aucune promesse de délai** ; si non validée, la story est close sans code.

### Epic 4 · Langues, contenu, SEO technique, légal

**4.1 i18n FR/EN complète ⛳ (E4-S4)** — Toutes les pages, formulaire, rappel, erreurs, e-mails, PDF, pages légales, métadonnées, `alt`, `aria-label` ; chemins localisés (`docs/architecture.md` §4).
**CA** : `check-i18n` vert en CI ; `hreflang` + `x-default` corrects ; sélecteur lisible avec `lang` ; e-mails dans la langue du visiteur ; anglais relu par un humain.

**4.2 CMS** — Branchement derrière `lib/cms`, champs `{ fr, en }`, **validation bloquante** si une langue manque, vue « Traductions manquantes », FAQ et blocs « indépendance » éditables, webhook signé, guide d'édition pour Cat. Aucune donnée interne (partenaires, demandes) dans le CMS.
**CA** : Cat publie un texte FR/EN en moins d'une minute sans redéploiement ; impossible de publier une seule langue ; aucun composant modifié.

**4.3 SEO technique (E7-S3)** — Métadonnées par page et par langue, `hreflang` réciproques, sitemap multilingue, `robots.txt`, `canonical`, JSON-LD (`Organization` sans adresse ni personne, `BreadcrumbList`, `FAQPage` et `Service` légers), `noindex` sur confirmation, impression, démo, 404, coffre (`docs/seo-strategy.md` §G).
**CA** : schema.org valides ; Lighthouse SEO ≥ 95 ; alternances correctes ; nom de Cat absent de toute métadonnée.

**4.4 Pages légales, RGPD, mention IA, déclaration d'accessibilité ⛳** — Mentions légales, confidentialité (FR/EN, d'après `docs/privacy.md` : coffre, consentement, conservation, sauvegardes, sous-traitants, risques résiduels), section « cookies » (aucun sur le site public), mention des images générées, **déclaration d'accessibilité** (d'après `docs/a11y-report.md`).
**CA** : données légales réelles ; avis juridique obtenu sur le bandeau, la mention IA, la base légale et la conservation.

### Epic 5 · Qualité, sécurité, mise en ligne

**5.1 En-têtes de sécurité** — CSP statique du site, CSP à nonce du coffre, HSTS, etc. (`docs/architecture.md` §9.1).
**CA** : en-têtes vérifiés sur toutes les routes ; `/coffre` en `no-store` et `noindex`.

**5.2 Mesure respectueuse + Search Console (E5-S6, E7-S5)** — Plausible via notre domaine ; événements `Entrée` (propriété `choix`), `Langue`, `Partage` **sans identifiant** ; pages vues **sans** paramètres de requête ; Search Console (propriété de domaine, sans script) ; modèle de **rapport mensuel simple** ; `docs/privacy.md` à jour.
**CA** : aucune requête vers un domaine tiers ; aucun identifiant ni IP associés au choix ; `/contact?service=…&s=…` enregistré comme `/contact` ; aucun objectif de classement promis.

**5.3 Accessibilité 2.2 AA et performance ⛳ (E5-S5)** — Passe complète : axe, Lighthouse, **clavier**, **VoiceOver et NVDA**, **zoom 200 %**, texte agrandi, mobile réel, reduced-motion (version statique complète), bouton pause, formulaire en étapes, accordéon, PDF.
**CA** : `docs/a11y-report.md` rempli pour toutes les pages et les deux langues ; budgets d'octets tenus ; INP ≤ 200 ms.

**5.4 Tests utilisateurs ⛳ (E5-S8)** — Protocole `docs/usability-protocol.md` sur la préproduction : 5 participants minimum (2 seniors, 2 enfants adultes aidants, 1 utilisateur de lecteur d'écran), consentement, aucune donnée médicale réelle ; rapport `docs/usability-report.md` ; corrections décidées avec Sady.
**CA** : seuils de succès définis **avant** les tests ; problèmes classés (bloquant / important / mineur) ; bloquants corrigés avant 5.5.

**5.5 Checklist de lancement et mise en production ⛳ (E5-S9)** — Domaine, HTTPS, région UE, surveillance, sauvegardes et **restauration testée**, README, `docs/architecture.md` figé, DoD du PRD §11, tous les points de `docs/launch-checklist.md` ; **lancement en douceur** (cercle restreint, puis ouverture générale).
**CA** : checklist entièrement cochée et datée ; `noindex` retiré **uniquement** à l'ouverture ; soumission de bout en bout réussie (formulaire et rappel).

### Epic 7 · SEO et visibilité

L'étude de phase 0 (`docs/seo-strategy.md` Partie II) est une première version d'E7-S1. Agent : `seo-strategist` ; skill : `maison-triona-seo`.

**7.1 Revalidation de l'étude (E7-S1)** — **Belgique d'abord, puis Luxembourg** (D10). Résultats Google **localisés** par pays prioritaire (google.be puis google.lu ; les autres pays ensuite), fourchettes de volume (Keyword Planner, gratuit avec un compte Ads), Google Trends ; mise à jour des tableaux §B à §D avec URL, date et confiance.
**CA** : par pays et par besoin ; sources et dates ; 3 types de concurrents ; aucun chiffre inventé (volumes en fourchettes sourcées ou « non mesuré »).

**7.2 Architecture SEO et briefs de contenu (E7-S2)** — Briefs FR/EN dans `docs/content-briefs/` pour les pages de §E (modèle de la skill), à partir des faits fournis par Cat.
**CA** : une page cible par intention ; FR/EN ; pas de pages vides ou dupliquées ; aucun fait non validé ; vocabulaire réglementé signalé.

**4.3 SEO technique (E7-S3)** — voir Epic 4.

**7.3 Visibilité dans les moteurs IA (E7-S6)** — Réponse principale en tête de chaque page de fond, FAQ visible, faits sourcés et datés, données structurées valides ; `llms.txt` non prioritaire (`docs/seo-strategy.md` §I).
**CA** : FAQ et pages claires ; données structurées valides ; réponses sourcées ; aucun texte écrit « pour les robots ».

**5.2 Mesure anonyme et suivi (E7-S5)** — voir Epic 5.

**7.4 Audit `claude-seo` (E7-S4)** — *Reportée après le lancement (D13 : aucun budget d'outils SEO pour l'instant).* Relire le code et les scripts du plugin (appels externes, écritures disque, modifications de `~/.claude.json`), en rendre compte à Sady, installer **seulement après accord**, extensions payantes désactivées ; `/seo technical`, `/seo hreflang`, `/seo schema` sur le site réel, par lots.
**CA** : code relu avant installation ; audit sur le site réel ; plan d'action priorisé ; aucune extension à compte sans accord.

### Epic 6 · Partenaires (phase 2, après la mise en ligne)

Spec : `docs/partners-credibility.md`. Rien n'est affiché sans accord écrit du partenaire.

| ID | Story | Critères d'acceptation | Effort |
|---|---|---|---|
| **E6-S1** | Section partenaires (preuve de crédibilité) : `PartnersBand` alimenté, champs internes dans le coffre, champs publics dans le CMS (`docs/architecture.md` §5.1) | Aucun lien/contact partenaire ; niveau d'affichage respecté ; publication impossible sans consentement ; FR/EN ; alt corrects ; section masquée si vide | 1 j |
| **E6-S2** | Page « Comment nous choisissons » | Critères vérifiés uniquement ; texte validé par Cat ; renvoi depuis chaque service | 1 j |
| **E6-S3** | « Notre indépendance » complétée | Explique la rémunération sans montants ; cohérente avec la section partenaires (la page existe depuis 2.10) | ½ j |

---

## 5. Piste B · Assets IA (Sady + `media-producer`)

Détail, prompts et budget : `docs/assets-manifest.md` §4 et §5.

| Lot | Contenu | Crédits | Porte de sortie | Débloque |
|---|---|---|---|---|
| 0 | Style sheet A01-A03 (+ test `STYLE_ANCHOR` v1 / v1.1) | ~16 | **Validation Cat** | Tous les lots suivants |
| 1 | S1-S3 : P01-d, P02-d, P03-d → V01, V02, V03 → versions mobiles | ~100 | Sady puis Cat | Stories 2.1 (image réelle), 2.5 |
| 2 | S4-S7 : P04-P08 → V04-V08 → versions mobiles | ~118 | Sady puis Cat | Finalisation 2.2, 2.3, 2.5 |
| 3 | P09 (détails), P06b si retenue, reprises | ~32 | Sady | Finitions |

Budget du compte : 278,88 crédits (offre starter) ; total estimé ~266 → **recharge recommandée avant le lot 2**. Chaque lot : `generate cost` → accord de Sady → génération → journal → `/ingest-media` → contrôle qualité → validation. Les pages de réassurance (2.8 à 2.10) n'ont **pas** de visuel : aucune génération supplémentaire.

---

## 6. Correspondance avec le PRD §9 et les specs

| Source | Ce plan |
|---|---|
| PRD 1.1 à 1.4 | 1.1 à 1.4 (1.4 inclut le squelette i18n `/fr`, `/en`) |
| PRD 2.1 | 2.1 (entrée) + 2.2 (scènes de l'accueil) |
| PRD 2.2 à 2.4 | 2.6 (La Maison), 2.3 (services), 2.7 (territoires) |
| PRD 3.1 · 3.2 · 3.3 | 3.1 (en étapes) · 3.3 (avec le coffre 3.2) · 3.5 |
| PRD 4.1 à 4.3 | 4.1, 4.3, 4.4 |
| PRD §8 (CMS) | 4.2 |
| PRD 5.1 à 5.4 | 5.1, 5.2, 5.3, 5.5 |
| Spec entrée E2-S1 · E2-S2 | 2.1 · 2.3 |
| Spec entrée E3-S4 | 3.4 |
| Spec entrée E4-S4 | 4.1 (et 1.4) |
| Spec entrée E5-S5 · E5-S6 | 5.3 (et 2.5 pour la pause) · 5.2 |
| Spec confiance E2-S3 · E2-S4 · E2-S5 · E2-S6 | 2.8 · 2.9 · 2.10 · 2.11 |
| Spec confiance E3-S5 · E3-S6 · E3-S7 · E3-S8 · E3-S9 | 3.1 · 3.6 · 3.7 · 3.2 · 3.3 |
| Spec confiance E5-S7 · E5-S8 · E5-S9 | 1.5 · 5.4 · 5.5 |
| Spec SEO E7-S1 · E7-S2 · E7-S3 · E7-S4 · E7-S5 · E7-S6 | 7.1 · 7.2 · 4.3 · 7.4 · 5.2 · 7.3 |
| Spec partenaires E6-S1 · E6-S2 · E6-S3 | Epic 6 (phase 2) ; emplacement vide en 2.2 |
| Brief assets (vidéo, scrub) | 2.5 + piste B |
