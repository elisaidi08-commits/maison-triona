# Maison Triona — by K. · mémoire projet

Site vitrine d'une **conciergerie de luxe / apporteur d'affaires** : met en relation des prestataires indépendants d'excellence avec une clientèle fortunée (Belgique · France · Luxembourg · Monaco · Suisse). Le site **ne gère aucune transaction** : il présente la maison et recueille des **demandes de contact confidentielles**. **3 services** (conciergerie de luxe, accompagnement du grand âge, garde d'enfants) ; la mise en relation est le **modèle** de la maison. **Aucun tarif affiché.** **Entrée par besoin** dès le premier écran. Site **bilingue FR (principal) + EN**, textes éditables par Cat via un **CMS headless**. **Tous les visuels sont générés par IA.**

- **PO / dev** : Sady (code avec Claude Code et Codex). **Cliente** : Catriona, « Cat », signature « K. ».
- **Langue de travail** : français. Identifiants de code en anglais, commentaires et documentation en français. Prompts de génération en anglais.
- **Retour client (10/2026)** : concept validé, mais « il manquait du luxe ». Objectif : **du luxe et de la convivialité**, en élevant l'exécution sans refroidir.

## Phase en cours

**Phase 1 ouverte le 15/10/2026** (`GO PHASE 1` confirmé par Sady, `docs/decisions.md` D16). Une story à la fois, dans l'ordre de `docs/plan-implementation.md` (piste A dev, piste B assets IA en parallèle). Stories 1.1 (fusionnée) et 1.2 (validée, PR #2) livrées sur le dépôt privé `elisaidi08-commits/maison-triona`. **En cours : piste B, lot 0 des assets IA** (style sheet A01-A03). Prochaine story de la piste A : 1.3. Dépôt dans le dossier actuel (D17).

## Règles d'or

1. **Périmètre d'écriture** : en phase 0, uniquement `docs/`, `.claude/` et ce fichier. À partir de la phase 1, seulement ce que la story en cours exige.
2. **Rien ne s'invente** : tout point `[À CONFIRMER]` ou `[À TRANCHER]` remonte à Sady. Aucun faux texte publié en dur : `[CONTENU À FOURNIR PAR CAT]` ou brouillon balisé ; `check:content` bloque la production.
3. **Points de contrôle** : à la fin de chaque story visuelle, **s'arrêter**, livrer les captures 1440 / 834 / 390 et attendre « OK story X.Y ». Aucun enchaînement automatique d'écrans.
4. **Honnêteté technique** : si un outil ou une API n'est pas disponible ou pas vérifié, le dire et proposer un plan B. Ne jamais inventer d'API ; vérifier la doc à jour avant de figer une version.
5. **Le luxe se ressent, il ne se crie pas** : aucune animation démonstrative, aucun effet gratuit. Entre « plus » et « moins » : **moins**. Et si l'accessibilité et un effet s'opposent, **l'accessibilité gagne**.

## Discrétion (non négociable)

- **Aucun réseau social**, aucun bouton de partage social, aucune intégration sociale. Seuls « Envoyer à un proche » (menu natif ou `mailto:`) et « Copier le lien », en texte, sans script tiers.
- **Aucun tracker tiers**, aucun pixel, aucun script externe. Analytics = Plausible **servi via notre domaine**, sans cookie, mesure **agrégée** (jamais liée à une personne ou une IP).
- **Aucun appel réseau tiers depuis le navigateur** : polices auto-hébergées (`next/font`), images et médias servis par le site.
- **Aucun cookie** (langue portée par l'URL, `NEXT_LOCALE` désactivé).
- Le choix d'un service peut révéler une situation de santé : **aucun champ santé**, rien de sensible dans les logs. Détail : `docs/privacy.md`.
- Aucune donnée du formulaire dans les logs. Chaque demande est **stockée chiffrée dans un coffre hébergé dans l'UE** (accès nominatif, A2F, journal d'accès) ; l'e-mail à Cat n'est qu'une **notification minimale** sans contenu sensible. Dépôt git **privé**.
- **Partenaires** : jamais affichés sans **accord écrit** ; aucun lien, e-mail ni téléphone de partenaire ; aucun critère, chiffre ou label non vérifié (`docs/partners-credibility.md`).

## Documents de référence

**Priorité en cas de conflit** : `docs/ux-entry-i18n-a11y.md` > `docs/trust-contact-launch.md` > `docs/seo-strategy.md` > `docs/assets-ia-brief.md` > `docs/art-direction.md` > PRD (design). **Fonctionnel** (formulaire, RGPD, SEO) : `docs/prd.md`, précisé par `docs/trust-contact-launch.md`.

| Document | À lire quand |
|---|---|
| `docs/decisions.md` | Décisions de Sady (D01…) : à lire avant toute story, prime sur les recommandations des autres documents |
| `docs/prd.md` | Avant toute story (transcription du PDF) |
| `docs/ux-entry-i18n-a11y.md` | Entrée par besoin, scènes de service, i18n, accessibilité WCAG 2.2 |
| `docs/trust-contact-launch.md` | FAQ, « Comment ça se passe », « Notre indépendance », formulaire en étapes, rappel, coffre, e-mails, partage, préproduction, lancement |
| `docs/seo-strategy.md` | Mots-clés, concurrence, architecture SEO, SEO technique, moteurs IA |
| `docs/partners-credibility.md` | Partenaires (phase 2) : niveaux d'affichage, consentement, formulation |
| `docs/email-deliverability.md` · `docs/launch-checklist.md` · `docs/usability-protocol.md` | Délivrabilité, ouverture, tests utilisateurs |
| `docs/art-direction.md` | Avant tout travail visuel (style bible : §6) |
| `anti-patterns.md` (racine) | Avant chaque composant et chaque PR (à mettre à jour après arbitrages) |
| `docs/design-tokens.md` | Avant d'écrire une classe, une couleur, un voile |
| `docs/motion-spec.md` | Avant toute animation, scrub ou vidéo |
| `docs/assets-ia-brief.md` · `docs/assets-manifest.md` | Avant de préparer, générer, contrôler ou intégrer un visuel |
| `docs/media-pipeline.md` | Encodage, ingestion, intégration des médias |
| `docs/architecture.md` | Avant d'installer ou de configurer quoi que ce soit |
| `docs/privacy.md` | Formulaire, mesure, journaux, mention IA |
| `docs/plan-implementation.md` | Quelle story faire, ses critères |
| `docs/a11y-report.md` | Résultats des tests d'accessibilité (à remplir) |
| `docs/audit-v1.md` · `docs/moodboard/README.md` | État de la maquette Figma ; index du moodboard |

Figma : fichier `fAbQP3eV9zM6R3Bq75ehFN` (nodes dans `docs/audit-v1.md` §1). Charger la skill `figma-design-to-code` avant `get_design_context`.

## Stack (figée en story 1.1, versions dans `docs/architecture.md` §1)

Next.js 16 (App Router, `proxy.ts`, Turbopack) · React 19 · TypeScript strict · Tailwind CSS 4 (`@theme`) · Motion (`motion`, `LazyMotion` + `m`) · next-intl 4 (`/fr`, `/en` toujours préfixés) · CMS headless (reco Sanity) · Zod 4 · **coffre UE** (base chiffrée + A2F) · e-mail transactionnel UE avec boîte d'envoi et reprises · Upstash (UE) · Plausible · Vercel Pro (`cdg1`) · Playwright + axe · Lighthouse 13. Détail : `docs/architecture.md`.

## Commandes (story 1.1, détail dans `README.md`)

```bash
npm run dev | build | start | lint | typecheck | format | format:check
npm run test:e2e           # Playwright (formulaire, entrée par besoin, i18n)
npm run test:a11y          # axe, WCAG 2.2 AA, FR et EN
npm run lighthouse         # Lighthouse 13 mobile + desktop (serveur lancé sur le port 3100)
npm run check:content      # échoue s'il reste un placeholder ou un brouillon
npm run check:i18n         # échoue si une clé existe dans une langue et pas l'autre
npm run check:third-party  # échoue si un domaine externe ou une référence au moodboard apparaît
node docs/tools/contrast-check.mjs   # ratios de contraste, alphas AAA, voiles
bash scripts/ingest-media.sh …       # ingestion d'un média (via /ingest-media)
```

## Conventions de code

- **Server Components par défaut.** `'use client'` seulement sur des feuilles minimales (formulaire, menu mobile, mouvement, vidéo).
- **Tokens uniquement** : aucune classe Tailwind arbitraire, aucune couleur ni espacement hors `src/styles/tokens.css`.
- **Rayon 0** (rayon 2 px pour l'anneau de focus seulement). Aucune ombre, aucun dégradé décoratif, aucun `backdrop-blur`.
- **Or** : filets, point du « K. », bordure de bouton sur sapin. **Jamais en texte sur fond clair.** Texte or = champagne `#D2B98A` sur sapin uniquement.
- **Typo** : serif display Light/Regular ≥ 40 px desktop (≥ 32 px mobile) ; Manrope ailleurs ; **corps 18 px minimum** ; labels capitales +0,12 em, 13 px.
- **Accessibilité** : WCAG **2.2 AA**, texte courant **AAA** quand possible ; focus **3 px** jamais masqué ; cibles **≥ 48 px** (56 px pour les choix d'entrée) ; vrais liens ; tout fonctionne sans JavaScript ; `prefers-reduced-motion` = version statique complète ; **bouton pause** sur toute vidéo.
- **Texte sur image** : seul le titre display du hero, sur voile sapin ≥ 58 % ; tout texte courant sur aplat (`docs/design-tokens.md` §2.4).
- **Aucune icône pictographique** ; séparateurs = filets 1 px ou glyphes.
- **CTA** : « Nous écrire », « Prendre contact », « Parlez-nous de votre situation », « Écrire en toute discrétion ». Pas de tiret cadratin dans les titres, la navigation ni les CTA.
- **Images** : `next/image` (AVIF puis WebP), `aspect-ratio` réservé ; le poster est l'élément LCP. Aucune vidéo en mobile.
- **Formulaire** : validation serveur Zod, `?service=` présélectionne la demande, langue passée explicitement, aucun champ santé.
- **Contenu** : textes éditoriaux via `lib/cms` ; libellés d'interface dans `messages/{fr,en}.json` ; jamais de traduction automatique publiée sans relecture.
- **Dépendances** : aucune nouvelle dépendance sans justification écrite. **Commits** : français, impératif, une story par branche.

## Assets IA (règles courtes, détail dans `docs/assets-manifest.md`)

- Le **moodboard** est une référence de style **interne** : jamais publié, jamais dans `public/`, **jamais passé en entrée** d'une génération (`--image`, `--start-image`…), jamais reproduit (lieu, visage, scène, cadrage).
- **Aucune ressemblance** avec une personne réelle ; jamais le visage de Cat ni d'un client sans accord écrit. **Aucun lieu identifiable**. Ni texte, ni logo, ni marque, ni écran dans les images.
- **Higgsfield** : CLI installée et connectée (offre starter, budget limité). **Toujours** `higgsfield generate cost` puis **accord explicite de Sady** avant toute génération. Vidéo : `kling3_0 --mode pro --sound off` ; jamais Seedance 2.5 sans demande (128 crédits / clip).
- Chaque génération est notée dans le journal du manifeste. Sorties brutes dans `media-incoming/`, intégration par `/ingest-media` après contrôle qualité et validations Sady puis Cat.

## Agents, skills, commandes

- Agents (`.claude/agents/`) : `art-director` (ne code pas) · `design-system-engineer` · `motion-engineer` · `media-producer` · `i18n-copy-editor` · `qa-a11y-perf` (bloque si seuils non atteints) · `security-privacy-reviewer` · `seo-strategist`.
- Skills projet (`.claude/skills/`) : `maison-triona-design-system` · `maison-triona-motion` · `maison-triona-media` · `maison-triona-copy-fr-en` · `maison-triona-qa` · `maison-triona-seo`. Skill utilisateur : `higgsfield-generate` (ses défauts « qualité d'abord, sans estimer le coût » sont **remplacés** par nos règles).
- Commandes : `/audit-ecran <écran>` · `/verifier-dod <story>` · `/prompt-higgsfield <ID>` · `/ingest-media <fichier ou dossier>`.
- Hooks proposés (**non activés**, testés) : `.claude/hooks/README.md`.

## Pièges connus

- Figma : `letterSpacing` exporté sans unité = **pourcentage** (`12` → `0.12em`) ; collection `maison-triona/*` (v1) **dépréciée** ; Plus Jakarta Sans n'est qu'un substitut de Satoshi.
- **Deux dossiers « moodboard »** : `ASSETS PHOTO MAQUETTE/` = moodboard v2 (celui de la style bible) ; `MOODBOARD PHOTO/` = direction v1 futuriste, écartée (à confirmer par Sady).
- Le prompt V04 du brief décrivait un **portrait Unsplash réel** : la version retenue montre des mains.
- **Grain incrusté = vidéo incompressible** : grain très léger à la génération, encodage en **deux passes** à débit cible (`docs/media-pipeline.md` §5).
- Kling et Seedance génèrent du **son par défaut** ; Soul « 2k » = 1080p réel ; aucun modèle vidéo ne sort en 4:5.
- Le logo « le sillage » **n'existe pas encore** ; tous les textes de la maquette sont **fictifs**.
- `anti-patterns.md` n° 21 (logos), 22 (chiffres), 23 (FAQ en accordéon) et 24 (CTA) sont **assouplis** par les specs récentes : appliquer la version des specs en attendant la mise à jour du fichier par Sady.
- **Concurrence** : ne rien affirmer sur un concurrent sans URL et date (`docs/seo-strategy.md` §B).
- Le dossier du projet garde ses **espaces finaux** (`MAMAN `, `MAISON TRIONA `, D17), comme les **dossiers de travail** (`ASSETS PHOTO MAQUETTE `, `LOGO `, `MOODBOARD LOGO `, `MOODBOARD PHOTO `, `TYPO `) : toujours citer les chemins entre guillemets. Dans `.gitignore` et `.vercelignore`, un espace final est **ignoré** sauf s'il est échappé (`\ `) : utiliser des motifs (`/LOGO*/`).
- Next 16 : `middleware.ts` → `proxy.ts`. Tailwind 4 : `--spacing-*: initial` supprime aussi le multiplicateur (`p-24` = 24 px). Motion : paquet `motion`.

## Outils externes

Figma MCP (claude.ai) : disponible. **Higgsfield CLI** : installée et connectée (workspace « Private ») ; le connecteur MCP Higgsfield de claude.ai n'est pas autorisé et n'est pas nécessaire. Playwright (plugin) et Chrome DevTools MCP (Lighthouse, traces) : disponibles pour la QA. ffmpeg, ffprobe, ImageMagick : installés.
