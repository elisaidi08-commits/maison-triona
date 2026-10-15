<!--
Transcription fidèle de `maison-triona-prd.pdf` (racine du dossier, 26 pages), réalisée en phase 0
le 15/10/2026 à la demande du PRD lui-même (§0 : « Déposer ce fichier […] : docs/prd.md »).
Aucun contenu modifié, ajouté ou retiré : seule la mise en forme Markdown a été reconstruite.
En cas de doute, le PDF fait foi. Les décisions postérieures au PRD sont tracées dans
docs/architecture.md et docs/art-direction.md, pas ici.
-->

# Maison Triona — by K.

## PRD & Handoff développeur — BMAD-ready

> **Statut :** v1 — prêt pour le développement
> **Auteur / Product Owner :** Catriona (K.)
> **Destinataire :** développeur Web / UX-UI (Claude Code sur VS Code + Codex)
> **Type de projet :** site vitrine premium + captation de leads qualifiés
> **Confidentialité :** document interne — positionnement ultra haut de gamme et discret

---

## 0. Mode d'emploi (dev + agents IA)

Ce document est structuré selon la **méthode BMAD** (Goals → Requirements → UX → Tech → Epics/Stories). Il peut être utilisé tel quel ou éclaté ("shardé") en epics/stories individuels.

**Pour Claude Code / Codex :**

1. Déposer ce fichier à la racine documentaire du dépôt : `docs/prd.md`.
2. Faire lire l'intégralité du document à l'agent **avant** toute génération de code.
3. Travailler epic par epic (section 9). Chaque story a des **critères d'acceptation** qui servent de définition de « terminé ».
4. Les sections marquées **[À CONFIRMER]** doivent être tranchées avec le PO (Cat) avant implémentation — ne rien inventer dessus.

**Arborescence de dépôt suggérée :**

```
/maison-triona
├── docs/
│   ├── prd.md              ← ce fichier
│   ├── architecture.md     ← à produire par le dev (choix techniques figés)
│   └── design-tokens.md    ← couleurs, typos, espacements
├── src/
├── public/
│   └── brand/              ← logo « le sillage », favicon, OG image
└── README.md
```

---

## 1. Contexte & vision

**Maison Triona — by K.** est une **conciergerie de luxe / apporteur d'affaires**. Elle met en relation des prestataires indépendants d'excellence avec une clientèle fortunée, contre commission.

- **Modèle économique :** apport d'affaires. Le site **ne gère aucune transaction ni commission** — il génère et qualifie des demandes de contact. La mise en relation se fait ensuite hors ligne.
- **Discrétion comme principe :** diffusion **par site web + bouche-à-oreille uniquement**. **Aucun réseau social.** Le site est la seule vitrine publique : il doit incarner à lui seul le prestige de la marque.
- **Signature :** le « K. » — signe discret, en cachet, jamais tapageur.

**Positionnement en une phrase :**
*l'excellence sur mesure, orchestrée dans la discrétion, pour ceux qui n'ont pas le temps de chercher le meilleur.*

---

## 2. Objectifs & indicateurs de succès

**Objectifs produit :**

1. Établir une présence en ligne d'un raffinement irréprochable, à la hauteur d'une clientèle très haut de gamme.
2. Convertir un visiteur qualifié en **prise de contact confidentielle**.
3. Rassurer par la crédibilité (expérience, discrétion, exigence) sans jamais « vendre » de façon appuyée.

**Indicateurs (à mesurer avec un analytics respectueux de la vie privée) :**

- Taux de complétion du formulaire de contact.
- Qualité des leads (renseignée manuellement par Cat, hors outil).
- Performance : Lighthouse ≥ 95 sur Performance, Accessibilité, SEO.
- Temps de chargement perçu < 1,5 s sur mobile 4G.

---

## 3. Périmètre

### MVP (à livrer)

- Site vitrine multi-pages, responsive, bilingue.
- Présentation de la maison, de la promesse et de l'univers de services.
- Couverture géographique (Belgique, France, Luxembourg, Monaco, Suisse).
- **Formulaire de contact confidentiel** (demande qualifiée) + envoi email sécurisé.
- Système de design (tokens couleurs/typo), intégration du logo « le sillage ».
- SEO technique, mentions légales / politique de confidentialité (RGPD), bandeau cookies minimal.

### Hors périmètre MVP (Phase 2 — à noter, pas à construire)

- Espace client privé / connexion.
- Annuaire ou onboarding des prestataires.
- Suivi des commissions, facturation, paiement en ligne.
- Blog / contenu éditorial récurrent.
- Toute intégration réseau social (volontairement exclue).

---

## 4. Exigences

### 4.1 Fonctionnelles (FR)

- **FR1** — Le site présente Maison Triona sur plusieurs pages (accueil, la maison/notre approche, services/univers, zones desservies, contact).
- **FR2** — Un formulaire de contact permet une demande confidentielle avec, au minimum : nom, moyen de contact (email/téléphone), pays/zone, nature de la demande, message libre.
- **FR3** — La soumission du formulaire envoie un email sécurisé à Cat et affiche une confirmation soignée à l'utilisateur.
- **FR4** — Le formulaire est protégé contre le spam (honeypot + limitation de débit ; pas de captcha intrusif type reCAPTCHA visible).
- **FR5** — Le site est disponible en **FR (langue principale)** et **EN** (voir [À CONFIRMER] §10), avec sélecteur de langue discret.
- **FR6** — Chaque page dispose de métadonnées SEO propres (title, description, OpenGraph, image de partage).
- **FR7** — Le logo « le sillage » est présent en en-tête, en pied de page et en favicon.
- **FR8** — Pages légales accessibles : mentions légales, politique de confidentialité (RGPD), gestion des cookies.

### 4.2 Non-fonctionnelles (NFR)

- **NFR1 — Esthétique :** rendu « luxe discret » irréprochable (voir §6). Aucune sur-animation, aucun effet « démonstratif ».
- **NFR2 — Performance :** Lighthouse ≥ 95 (Perf/A11y/SEO), images optimisées (formats modernes, lazy-loading), polices auto-hébergées.
- **NFR3 — Accessibilité :** conformité WCAG 2.1 AA (contrastes, navigation clavier, alt, focus visibles).
- **NFR4 — Responsive :** mobile-first, testé de 360 px à 1440 px+.
- **NFR5 — Confidentialité / RGPD :** collecte de données minimale, analytics sans cookies traceurs (ex. Plausible ou équivalent), consentement clair, données du formulaire chiffrées en transit, aucune revente/tracking tiers.
- **NFR6 — Sécurité :** HTTPS forcé, en-têtes de sécurité (CSP, HSTS), validation serveur des entrées, secrets hors du dépôt (.env).
- **NFR7 — Maintenabilité :** code typé, composants réutilisables, tokens de design centralisés.
- **NFR8 — SEO discret :** indexable et bien référencé sur son nom, mais sobre — pas de sur-optimisation agressive.

---

## 5. Architecture de l'information (sitemap)

```
/ (Accueil)
├── /la-maison          (notre approche, l'exigence, la discrétion, le K.)
├── /services           (univers de services : conciergerie, accompagnement du grand âge, garde d'enfants, etc.)
├── /territoires        (BE · FR · LU · MC · CH)
├── /contact            (formulaire confidentiel + confirmation)
├── /mentions-legales
└── /confidentialite
```

> Navigation minimaliste (4 entrées max dans le menu principal). Le formulaire est le point de conversion central, accessible depuis chaque page.

---

## 6. Direction UX / UI & identité de marque

### 6.1 Identité arrêtée (verrouillée)

- **Palette :** vert sapin + champagne, sur fond ivoire.
- **Logo :** « le sillage » — un trait manuscrit formant un **T** (Triona) évoquant le sillage d'une pirogue (écho au nom de famille de la fondatrice : « le navigateur sur une pirogue »).
- **Le vert** est la couleur signature de la marque.
- **Ton :** sobre, sûr, chaleureux mais retenu. Le prestige se ressent, il ne se crie pas.

### 6.2 Design tokens — propositions de départ [À VALIDER par le designer sur le logo réel]

| Rôle | Nom | Hex proposé |
|---|---|---|
| Fond principal | Ivoire | `#F7F2E7` |
| Couleur signature | Vert sapin | `#1C3B2A` |
| Vert secondaire | Sapin clair | `#2E5D45` |
| Accent précieux | Champagne | `#D2B98A` |
| Champagne clair | | `#E8DAB8` |
| Texte | Noir chaud | `#1A1A17` |

> Ces valeurs sont un point de départ cohérent avec « vert sapin & champagne sur ivoire ». **Le designer les ajuste** à partir des fichiers réels du logo pour une harmonie exacte.

### 6.3 Typographie — direction proposée [À VALIDER]

- **Titres/display :** serif élégante à fort caractère (ex. *Cormorant Garamond*, *Playfair Display* ou une didone raffinée).
- **Texte courant :** sans-serif humaniste sobre et lisible (ex. *Inter*, ou une grotesque douce).
- Polices **auto-hébergées** (pas de Google Fonts en ligne, pour la confidentialité et la performance).

### 6.4 Principes de design

1. **Le vide est un luxe** — beaucoup d'espace, peu d'éléments, rythme lent.
2. **Le champagne en touches** — l'or/champagne souligne, il ne remplit jamais.
3. **Photographie choisie** — imagerie feutrée, matières nobles, jamais de banque d'images clichée ; à défaut, textures/dégradés discrets.
4. **Micro-interactions minimales** — transitions douces, aucune animation ostentatoire.
5. **Le « K. » en cachet** — présent comme une signature, discret.

---

## 7. Contenu par page (structure — textes définitifs fournis par Cat)

- **Accueil :** accroche signature, promesse en une phrase, aperçu des univers de services, appel au contact discret. *(hero + 3 blocs + CTA)*
- **La Maison :** l'histoire, l'exigence, la discrétion, le sens du nom, les 20+ ans d'expérience métier.
- **Services :** présentation des univers (conciergerie de luxe, accompagnement du grand âge, garde d'enfants, mise en relation avec les meilleurs indépendants). Pas de tarifs affichés.
- **Territoires :** BE · FR · LU · MC · CH — évoqués avec élégance.
- **Contact :** formulaire confidentiel + réassurance sur la discrétion et la confidentialité des échanges.

> **Placeholder de contenu :** utiliser des textes neutres balisés `[CONTENU À FOURNIR PAR CAT]` là où le texte final manque, jamais de faux texte publié en dur.

---

## 8. Hypothèses techniques — recommandation (le dev tranche selon Claude Code/Codex)

- **Framework :** Next.js (App Router) + TypeScript — SEO, performance, rendu statique/serveur.
- **Styles :** Tailwind CSS + couche de design tokens centralisée.
- **i18n :** `next-intl` (FR/EN), architecture prête pour d'autres langues.
- **Contenu :** MDX pour le MVP (simple) — ou CMS headless léger (ex. Sanity) **si Cat veut éditer elle-même** [À CONFIRMER §10].
- **Formulaire :** Server Action + envoi email via un service transactionnel (ex. Resend) ; anti-spam honeypot + rate-limit.
- **Hébergement :** Vercel (ou équivalent), HTTPS, en-têtes de sécurité.
- **Analytics :** privacy-first sans cookies traceurs (ex. Plausible).
- **Polices :** auto-hébergées via `next/font`.

> Ce sont des recommandations cohérentes avec les NFR. Le développeur reste libre de son stack tant que les exigences des §4 sont respectées ; il **fige ses choix dans `docs/architecture.md`**.

---

## 9. Epics & Stories (cœur BMAD)

> Ordre d'exécution recommandé : Epic 1 → 5. Chaque story se valide sur ses **critères d'acceptation (CA)**.

### Epic 1 — Fondations & système de design

- **1.1** Initialiser le projet (framework, TS, lint, formatage, Git).
  - CA : le projet démarre en local ; CI de base (lint + build) passe.
- **1.2** Mettre en place les design tokens (couleurs §6.2, typos §6.3, espacements, rayons).
  - CA : tokens centralisés, réutilisables ; page de démo affichant la palette et les styles typographiques.
- **1.3** Intégrer le logo « le sillage » (SVG), le favicon et l'image OG.
  - CA : logo net en en-tête/pied ; favicon visible ; carte de partage correcte.
- **1.4** Layout global : en-tête (nav 4 entrées + sélecteur de langue), pied de page, structure responsive.
  - CA : header/footer présents sur toutes les pages ; navigation clavier OK ; responsive 360→1440 px.

### Epic 2 — Pages vitrines

- **2.1** Page **Accueil** (hero + blocs services + CTA contact).
  - CA : structure §7 respectée ; CTA mène à `/contact` ; Lighthouse ≥ 95.
- **2.2** Page **La Maison**.
- **2.3** Page **Services**.
- **2.4** Page **Territoires** (BE·FR·LU·MC·CH).
  - CA (2.2–2.4) : contenu balisé `[CONTENU À FOURNIR]` là où nécessaire ; a11y AA ; responsive.

### Epic 3 — Contact & captation de leads

- **3.1** Formulaire de contact (champs FR2) avec validation client + serveur.
  - CA : champs requis validés ; messages d'erreur clairs et élégants.
- **3.2** Envoi email sécurisé + page/état de confirmation soignée.
  - CA : email reçu par Cat ; confirmation affichée ; aucune donnée en clair dans les logs.
- **3.3** Anti-spam (honeypot + rate-limit).
  - CA : soumissions robots bloquées ; aucun captcha visible intrusif.

### Epic 4 — Internationalisation & SEO

- **4.1** i18n FR/EN sur toutes les pages + sélecteur discret.
  - CA : bascule de langue sans perte de page ; URLs localisées ou stratégie équivalente.
- **4.2** SEO technique par page (title, description, OG, sitemap.xml, robots.txt).
  - CA : chaque page a des métadonnées propres ; Lighthouse SEO ≥ 95.
- **4.3** Pages légales (mentions, confidentialité RGPD, cookies).
  - CA : pages accessibles depuis le footer ; bandeau cookies minimal et conforme.

### Epic 5 — Qualité, sécurité & mise en ligne

- **5.1** En-têtes de sécurité (CSP, HSTS…), HTTPS forcé, secrets en `.env`.
- **5.2** Analytics privacy-first branché.
- **5.3** Passe finale a11y (WCAG AA) + performance (images, polices).
- **5.4** Déploiement production + domaine + monitoring de base.
  - CA (5.x) : NFR2/3/5/6 vérifiées ; site en ligne, stable, mesuré.

---

## 10. À confirmer avec Cat (bloquant avant certaines stories)

- **[À CONFIRMER] Langues :** FR seul, ou FR + EN ? (recommandation : FR + EN vu Monaco/Suisse/international). D'autres langues à prévoir ?
- **[À CONFIRMER] Autonomie éditoriale :** Cat veut-elle modifier les textes elle-même (→ CMS headless) ou une mise à jour par le dev suffit (→ MDX) ?
- **[À CONFIRMER] Nom de domaine** et adresse email de réception des demandes.
- **[À CONFIRMER] Fichiers de marque :** logo « le sillage » en vectoriel (SVG), déclinaisons, favicon — à fournir au dev.
- **[À CONFIRMER] Textes définitifs** par page (ou validation des placeholders).
- **[À CONFIRMER] Imagerie :** photos/matières fournies, ou direction 100 % typographique/texturée ?
- **[À CONFIRMER] Palette exacte** (hex du §6.2) à valider sur le logo réel.

---

## 11. Definition of Done (checklist de handoff)

- [ ] Toutes les stories des Epics 1–5 remplissent leurs critères d'acceptation.
- [ ] Lighthouse ≥ 95 (Perf / A11y / SEO) sur mobile et desktop.
- [ ] WCAG 2.1 AA vérifié.
- [ ] RGPD : politique de confidentialité, cookies conformes, analytics sans traceurs.
- [ ] Formulaire testé de bout en bout (réception email + anti-spam).
- [ ] `docs/architecture.md` rédigé (stack figé) + `README.md` d'installation.
- [ ] Aucun secret dans le dépôt ; `.env.example` fourni.
- [ ] Site en production, HTTPS, domaine configuré.

---

*Fin du document — Maison Triona — by K. · PRD v1 (BMAD-ready)*
