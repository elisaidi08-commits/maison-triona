# Architecture technique — Maison Triona

> **Statut** : **proposition** phase 0 (15/10/2026), mise à jour après la spec d'entrée par besoin (i18n, routes, formulaire, WCAG 2.2), le brief assets IA (médias), puis les specs **confiance, contact, sécurité, lancement** (`docs/trust-contact-launch.md` : coffre, formulaire en étapes, rappel, PDF, préproduction), **SEO** (`docs/seo-strategy.md`) et **partenaires** (`docs/partners-credibility.md`). Rien n'est installé dans le projet. Le stack sera figé en story 1.1, après réponse de Sady aux points `[À TRANCHER]`.
> **Seule installation faite** (à la demande de Sady, hors du dépôt) : la CLI Higgsfield et la skill `higgsfield-generate` au niveau utilisateur (`docs/media-pipeline.md` §1).
> **Cadre** : PRD §4 (exigences) et §8 (hypothèses), qui priment sur le fonctionnel. Versions vérifiées sur le registre npm et les documentations officielles le 15/10/2026 (source : recherche de phase 0).
> **Principe directeur** : un site public **statique**, sans dépendance réseau tierce côté navigateur. Deux parties dynamiques seulement : l'**envoi des demandes** (formulaire et rappel) vers un **coffre chiffré hébergé dans l'UE**, et l'**espace d'administration du coffre** (2 comptes, authentification forte).

---

## 1. Stack proposée

| Couche | Choix | Version vérifiée | Pourquoi | Statut |
|---|---|---|---|---|
| Runtime | Node.js **24.x** (`.nvmrc`, `engines`) | Vercel : 24.x (défaut) et 22.x (doc Vercel consultée le 15/10/2026) ; poste : 26.8.2 | Exigence Next 16 ; Node 26 n'est pas proposé par Vercel. En local, Node 26 fonctionne avec un avertissement `EBADENGINE` | **Installé (1.1)** |
| Framework | **Next.js** App Router, Turbopack, `cacheComponents`, `partialPrefetching` | `16.4.1` | SEO, rendu statique, Server Actions, `next/font`, `next/image` | **Installé (1.1)** |
| UI | React, React DOM | `19.3.1` | — | **Installé (1.1)** |
| Langage | **TypeScript strict** + `noUncheckedIndexedAccess` | `5.9.3` | NFR7 ; TypeScript 7 existe mais `typescript-eslint` exige < 6.1 | **Installé (1.1)** |
| Styles | **Tailwind CSS v4** (chargeur `@tailwindcss/turbopack`, celui que génère create-next-app 16.4.1, à la place de `@tailwindcss/postcss`) | `4.3.3` | Tokens dans `@theme`, palettes par défaut supprimées en 1.2 (`docs/design-tokens.md` §8) ; sources limitées à `src/` (les docs citent des classes en exemple) | **Installé (1.1)** |
| Mouvement | **Motion** (`motion`, ex-Framer Motion) | `14.x` | `LazyMotion` + `m`, ~30 ko ; peut tomber à 0 selon Q4 (`docs/motion-spec.md`) | Proposé |
| i18n | **next-intl** | `4.14.9` | FR/EN, chemins localisés, prêt pour d'autres langues | Proposé |
| Contenu | **CMS headless** | voir §5 | Cat édite elle-même les textes publics | `[À TRANCHER]` (reco : Sanity) |
| Validation | **Zod** | `4.6.x` | Schéma unique des demandes, côté serveur | Proposé |
| **Coffre des demandes** | Base PostgreSQL **hébergée dans l'UE** | voir §6.5 | Une panne d'e-mail ne fait jamais perdre une demande | `[À TRANCHER]` (reco : Scaleway Managed PostgreSQL) |
| **Chiffrement applicatif** | libsodium, « sealed box » | à vérifier en story E3-S8 | Une fuite de base, de sauvegarde ou de variables d'environnement ne révèle rien | Proposé |
| **Authentification du coffre** | Better Auth (mot de passe + TOTP obligatoire, passkey) | à vérifier en story E3-S8 | Comptes nominatifs, A2F, données dans notre base | `[À TRANCHER]` |
| E-mail | Transactionnel européen, **sans suivi** | voir §6.6 | Notification minimale à Cat, confirmation au visiteur | `[À TRANCHER]` (reco : Scaleway TEM) |
| File d'envoi | Table « boîte d'envoi » + tâche planifiée Vercel (Cron) | — | Reprises sans sous-traitant supplémentaire | Proposé |
| Anti-abus | Honeypot + piège temporel + limitation de débit (Upstash Redis, région UE) | `@upstash/ratelimit 2.2` | FR4, sans captcha | Proposé |
| Analytics | **Plausible**, servi via notre domaine (proxy) | — | Sans cookie, hébergé dans l'UE, aucun appel tiers vu du navigateur | Proposé |
| Hébergement | **Vercel Pro**, fonctions en région **`cdg1`** (Paris) | 20 $/mois | Hobby interdit l'usage commercial ; région UE pour les demandes | Proposé |
| PDF | **Playwright** au build (`page.pdf({ tagged: true, outline: true })`) | ≥ 1.42 (`1.64.1` prévu pour les tests) | PDF balisé « Comment ça se passe » FR/EN, même source que la page imprimable | Proposé |
| Qualité | ESLint (flat config) + `eslint-config-next` + règles recommandées `jsx-a11y`, Prettier, `next typegen && tsc --noEmit` | ESLint `9.39.5`, config `16.4.1`, jsx-a11y `6.10.2`, Prettier `3.9.10` | NFR7. ESLint 9 est marqué « no longer supported », mais ESLint 10 n'est pas encore accepté par eslint-plugin-react, jsx-a11y et import : migrer dès que `eslint-config-next` le permet | **Installé (1.1)** |
| Tests | **Playwright** + `@axe-core/playwright` | `1.64.1` / `4.14.0` | E2E formulaire, rappel, i18n, accessibilité ; Chromium de Playwright | **Installé (1.1)** |
| Performance | **Lighthouse 13** par son API Node (`scripts/lighthouse.mjs`, Chromium de Playwright) | `13.5.0` | LHCI (`0.15.1`) embarque encore Lighthouse 12.6. Hors production, l'audit `is-crawlable` est écarté du score (noindex voulu) | **Installé (1.1)** |
| Gestion de paquets | npm (installé, 11.x) | — | Aucun outil supplémentaire à installer | Proposé |

**Changements récents à connaître** (Next 16) : `middleware.ts` s'appelle désormais **`proxy.ts`** et tourne sur Node ; `create-next-app` active `cacheComponents` par défaut depuis 16.4 ; `next/image` : AVIF à activer explicitement, `qualities` obligatoire, `priority` déprécié au profit de `preload` ou `fetchPriority` ; rester sur le **dernier correctif** (faille RSC CVE-2025-55182 corrigée en 16.0.7).

**Story 1.1 (15/10/2026)** : versions installées à l'identique (`--save-exact`) ; `npm audit --omit=dev` : 0 vulnérabilité ; 5 alertes « high » en développement seulement (`braces` via `eslint-config-next` → `fast-glob`, déni de service sur des motifs malveillants, non atteignable ici ; correctif proposé par npm = rétrograder `eslint-config-next` en 14, refusé). `next dev` écrit un bloc géré dans `AGENTS.md` (documentation Next embarquée dans `node_modules/next/dist/docs/`) ; on le garde, il sert aussi à Codex.

Les versions de libsodium, Better Auth et du pilote PostgreSQL ne sont **pas** figées ici : à vérifier sur le registre et la documentation au moment de la story E3-S8 (règle d'honnêteté technique).

---

## 2. Rendu

- **Toutes les pages publiques sont prérendues** au build, pour chaque langue (`generateStaticParams` sur `[locale]`).
- Garde-fou : `export const ensureStatic = 'navigation'` dans le layout public (Next 16.4) fait **échouer le build** si un élément dynamique s'introduit. Les envois de demandes ne sont pas concernés (Server Actions en POST).
- **Espace du coffre** (`/coffre`) : hors de `[locale]`, avec son propre layout, **rendu dynamique**, `noindex`, jamais dans le sitemap, aucune ressource partagée avec le site public hormis les tokens.
- Contenu CMS lu au build et mis en cache (`'use cache'` + `cacheTag`), invalidé par un **webhook signé** du CMS (`revalidateTag`). Cat publie, la page se régénère en quelques secondes, sans redéploiement.
- Aucun rendu côté client pour le contenu : les seuls Client Components publics sont le formulaire en étapes (amélioration progressive), le rappel, le menu mobile, la copie de lien, le sélecteur de langue si nécessaire, et les deux ou trois composants de mouvement. L'espace du coffre a son propre composant client de déchiffrement.

---

## 3. Arborescence

```
.
├── CLAUDE.md
├── docs/                       ← cadrage (ce dossier)
├── .claude/                    ← agents, skills, commandes, hooks proposés
├── messages/
│   ├── fr.json                 ← libellés d'interface (nav, formulaire, erreurs, accessibilité, e-mails)
│   └── en.json
├── public/
│   ├── brand/                  ← logo « le sillage » (SVG), favicon, images OG
│   ├── media/{hero,services,territoires,contact,maison}/
│   └── documents/              ← PDF « Comment ça se passe » FR/EN, générés au build
├── src/
│   ├── app/
│   │   ├── [locale]/
│   │   │   ├── layout.tsx              ← polices, MotionProvider, Header, Footer, SkipLink
│   │   │   ├── page.tsx                ← Accueil (entrée par besoin)
│   │   │   ├── la-maison/page.tsx
│   │   │   ├── services/page.tsx       ← les 3 services
│   │   │   ├── services/[service]/page.tsx  ← conciergerie, grand-age, enfants (pages dédiées, partage, SEO)
│   │   │   ├── territoires/page.tsx
│   │   │   ├── faq/page.tsx
│   │   │   ├── comment-ca-se-passe/page.tsx
│   │   │   ├── comment-ca-se-passe/langage-simple/page.tsx
│   │   │   ├── comment-ca-se-passe/imprimer/page.tsx   ← source du PDF (noindex)
│   │   │   ├── notre-independance/page.tsx
│   │   │   ├── comment-nous-choisissons/page.tsx       ← phase 2 (E6-S2)
│   │   │   ├── contact/page.tsx        ← formulaire en étapes
│   │   │   ├── contact/rappel/page.tsx ← rappel à la demande
│   │   │   ├── contact/urgent/page.tsx ← conditionnel (E3-S7), seulement si Cat valide
│   │   │   ├── contact/merci/page.tsx  ← confirmation (noindex)
│   │   │   ├── mentions-legales/page.tsx
│   │   │   ├── confidentialite/page.tsx
│   │   │   ├── accessibilite/page.tsx  ← déclaration d'accessibilité
│   │   │   ├── demo/page.tsx           ← banc d'essai tokens et typo (noindex, retiré ou protégé en prod)
│   │   │   └── not-found.tsx
│   │   ├── coffre/                     ← espace d'administration (dynamique, noindex, A2F)
│   │   │   ├── layout.tsx · connexion/page.tsx · page.tsx (liste) · [id]/page.tsx (lecture)
│   │   ├── api/
│   │   │   ├── revalidate/route.ts     ← webhook CMS signé
│   │   │   ├── auth/[...all]/route.ts  ← authentification du coffre
│   │   │   ├── cron/outbox/route.ts    ← reprises d'envoi (appelée par Vercel Cron, secret)
│   │   │   ├── cron/retention/route.ts ← suppression des demandes échues
│   │   │   └── email-events/route.ts   ← rebonds et plaintes (webhook signé du fournisseur)
│   │   ├── sitemap.ts · robots.ts · icon.svg
│   │   └── globals.css                 ← importe styles/tokens.css
│   ├── actions/
│   │   ├── request.ts                  ← formulaire en étapes ('use server')
│   │   └── callback.ts                 ← rappel ('use server')
│   ├── components/
│   │   ├── layout/   Header, Footer, LanguageSwitcher, MobileMenu, SkipLink
│   │   ├── ui/       Button, TextLink, Rule (filet), Stamp (« K. »), Label, Field, ChoiceRow, ErrorSummary, StepProgress, Disclosure (<details>)
│   │   ├── sections/ Hero, ServicesList, Territories, ContactBlock, PartnersBand (vide tant qu'aucun partenaire validé), ShareLinks
│   │   ├── media/    HeroMedia (poster + vidéo), ArchFrame, Picture
│   │   ├── motion/   MotionProvider, Reveal, HeroParallax ('use client')
│   │   └── forms/    RequestForm, CallbackForm ('use client', amélioration progressive)
│   ├── i18n/         routing.ts, request.ts, navigation.ts
│   ├── lib/
│   │   ├── cms/        client, requêtes, types générés
│   │   ├── vault/      écriture chiffrée, lecture admin, suppression, rétention (serveur uniquement)
│   │   ├── crypto/     sealed box (clé publique côté serveur)
│   │   ├── auth/       configuration de l'authentification du coffre
│   │   ├── outbox/     boîte d'envoi, reprises, alertes
│   │   ├── email/      adaptateur unique (fournisseur interchangeable), gabarits FR/EN
│   │   ├── security/   rate-limit, honeypot, time-trap, hash d'IP
│   │   ├── validation/ schémas Zod (demande, rappel)
│   │   └── seo/        métadonnées, alternates, JSON-LD
│   ├── styles/       tokens.css (unique source de vérité), base.css, print.css
│   └── proxy.ts      ← next-intl (ex-middleware) ; protection de la préproduction en repli
├── tests/
│   ├── e2e/          request.spec.ts, callback.spec.ts, i18n.spec.ts, navigation.spec.ts, share.spec.ts
│   └── a11y/         pages.spec.ts (axe, WCAG 2.2 AA, FR et EN)
├── scripts/          check-content (placeholders), check-third-party (domaines interdits), check-i18n (parité des clés FR/EN), build-pdf, ingest-media.sh, lighthouse
├── media-incoming/   ← dépôt des sorties Higgsfield brutes (ignoré par Git ET par Vercel)
├── .vercelignore     ← docs/moodboard/, media-incoming/, dossiers de travail (assets, moodboards, typo, logo)
├── .env.example
└── .nvmrc
```

---

## 4. Internationalisation

| Paramètre | Proposition | Raison |
|---|---|---|
| Langues | `fr` (défaut), `en` | PRD FR5 |
| Préfixe | **`always`** : `/fr/…` et `/en/…` ; `/` redirige vers `/fr` (`x-default`) | Exigé par la spec d'entrée §3.1 |
| Détection automatique | **désactivée côté serveur** (`localeDetection: false`) ; **suggestion** côté navigateur (`navigator.languages`), refermable, mémorisée en `sessionStorage` | « Proposer sans imposer » (spec §3.1) : jamais de redirection automatique (Googlebot explore sans `Accept-Language`) |
| Cookie de langue | **désactivé** (`localeCookie: false`) | **Zéro cookie** sur le site public (voir §9) |
| Chemins localisés | `pathnames` de next-intl | Ci-dessous |
| `hreflang` | `alternates.languages` dans les métadonnées + sitemap ; `fr`, `en`, `x-default` → FR | SEO (`docs/seo-strategy.md` §G) |
| Server Action | La langue est **passée explicitement** (champ caché validé par Zod) | Les Server Actions n'ont pas accès aux paramètres de route racine |
| Coffre | Interface en **français** uniquement ; affiche la langue du visiteur pour chaque demande | Deux utilisateurs francophones |

| Page | FR | EN `[À VALIDER]` |
|---|---|---|
| Accueil (ancres `#conciergerie`, `#grand-age`, `#enfants`) | `/fr` | `/en` (ancres `#concierge`, `#senior-companionship`, `#childcare`) |
| La Maison | `/fr/la-maison` | `/en/the-house` |
| Services | `/fr/services` | `/en/services` |
| Conciergerie | `/fr/services/conciergerie` | `/en/services/concierge` |
| Grand âge | `/fr/services/grand-age` | `/en/services/senior-companionship` |
| Enfants | `/fr/services/enfants` | `/en/services/childcare` |
| Territoires | `/fr/territoires` | `/en/where-we-work` |
| FAQ (une ancre par question) | `/fr/faq` | `/en/faq` |
| Comment ça se passe | `/fr/comment-ca-se-passe` | `/en/how-it-works` |
| … en langage simple | `/fr/comment-ca-se-passe/langage-simple` | `/en/how-it-works/easy-read` |
| Notre indépendance | `/fr/notre-independance` | `/en/our-independence` |
| Comment nous choisissons (phase 2) | `/fr/comment-nous-choisissons` | `/en/how-we-choose` |
| Contact (`?service=…`, `?s=…`) | `/fr/contact` | `/en/contact` |
| Rappel | `/fr/contact/rappel` | `/en/contact/call-back` |
| Situation urgente (conditionnel) | `/fr/contact/urgent` | `/en/contact/urgent` |
| Confirmation | `/fr/contact/merci` | `/en/contact/thank-you` |
| Mentions légales | `/fr/mentions-legales` | `/en/legal-notice` |
| Confidentialité | `/fr/confidentialite` | `/en/privacy` |
| Accessibilité | `/fr/accessibilite` | `/en/accessibility` |
| PDF | `/documents/comment-ca-se-passe.pdf` | `/documents/how-it-works.pdf` |

**Choix d'entrée** : vrais liens vers l'ancre de la scène sur l'accueil ; la page dédiée existe pour le partage et le SEO (`docs/ux-entry-i18n-a11y.md` Annexe A). La valeur de `?service=` est un identifiant neutre et stable (`conciergerie`, `grand-age`, `enfants`), identique dans les deux langues.

**Source anonyme `?s=`** : liste fermée de codes (`carte`, `salon`, `ami`… `[À DÉFINIR avec Cat]`), toute autre valeur est ignorée ; transmise par un champ caché jusqu'au coffre, **jamais** associée à une personne dans l'outil de mesure.

**Pages pays** (`/fr/territoires/suisse`…) : **pas avant la phase 2**, et seulement avec un contenu local réel fourni par Cat. Si elles existent, chacune a son propre `canonical` et ses alternates FR/EN ; ce ne sont pas des variantes `hreflang` de la page Territoires (`docs/seo-strategy.md` §E et §G).

**Parité FR/EN** : `scripts/check-i18n` fait échouer le build si une clé de `messages/*.json` ou un champ du CMS existe dans une langue et pas dans l'autre. Aucune traduction automatique publiée sans relecture humaine.

**Répartition des textes** : contenus éditoriaux dans le CMS (champs FR/EN côte à côte), dont la FAQ, « Comment ça se passe » et « Notre indépendance » ; libellés d'interface stables (navigation, champs, erreurs, textes d'accessibilité, gabarits d'e-mails) dans `messages/*.json`, versionnés. Ajouter une langue = une entrée dans `routing.ts`, un fichier de messages, un champ par texte dans le CMS.

---

## 5. CMS `[À TRANCHER]`

Besoin : une cliente non technique édite des **textes courts, bilingues**, quelques images ; **aucune donnée personnelle dans le CMS** (les demandes vivent dans le coffre, §6.5).

| | **Sanity** (reco) | **Payload v3** | **Keystatic** |
|---|---|---|---|
| Modèle | SaaS (Content Lake) + Studio hébergé | Dans l'app Next.js (`/admin`), base de données à fournir | Fichiers dans le dépôt git |
| Coût | **Gratuit** (20 sièges, 10 000 documents) | Logiciel gratuit ; payer base et stockage | Gratuit ; Keystatic Cloud gratuit jusqu'à 3 utilisateurs |
| Bilingue | Champ par langue (plugin `internationalized-array`) ou document par langue | **Natif**, au niveau du champ | **Pas d'i18n officielle** (ticket ouvert) : contournements |
| Expérience pour Cat | Studio soigné, aperçu visuel (Presentation) inclus en gratuit | Admin générée, correcte | Simple, mais compte GitHub requis (sauf Keystatic Cloud) |
| Données / RGPD | Backend dans une région UE (Belgique) ; les fichiers téléversés peuvent être stockés hors UE ; DPA disponible | Choix libre (Postgres UE) | Chez GitHub |
| Dépendance | Moyenne (GROQ, stockage propriétaire) | Faible, mais maintenance des migrations ; v4 en bêta | Très faible |
| Limite | En gratuit, le dataset est **public** (sans gravité pour des textes publics ; **interdit** pour des données internes) | Infra et mises à jour à porter | i18n bricolée |

**Recommandation : Sanity, offre gratuite.**
- Studio hébergé à part (`*.sanity.studio`), donc rien à ajouter à la CSP ni au poids du site.
- Schéma : un document unique par page (`accueil`, `laMaison`, `services`, `territoires`, `faq`, `commentCaSePasse`, `notreIndependance`, `contact`, `mentionsLegales`, `confidentialite`, `accessibilite`) + `reglagesSite` ; chaque texte en `{ fr, en }` ; chaque image avec `alt` en `{ fr, en }`. FAQ : liste ordonnée de `{ ancre, question {fr,en}, reponse {fr,en}, visible }` (la question « délai » reste masquée tant que Cat ne s'engage pas sur un délai).
- « Notre indépendance » : chaque bloc porte un booléen `confirme_par_cat` ; un bloc non confirmé n'est jamais rendu.
- Images : servies depuis le dépôt (`public/media`) pour le hero et les visuels clés, afin de maîtriser poids et étalonnage ; le CMS ne gère que les textes au MVP.
- Garde-fou de contenu : le build de production **échoue** si un texte vaut `[CONTENU À FOURNIR PAR CAT]` ou porte le statut « brouillon » (script `check-content`).
- **Indicateur de traduction manquante** (spec d'entrée §3.1) : chaque champ `{ fr, en }` a une règle de validation **bloquante** (impossible de publier si l'une des deux langues est vide) et le Studio propose une vue « Traductions manquantes » listant les documents incomplets.
- Alternatives : **Storyblok** (éditeur visuel, région UE par défaut, offre gratuite limitée à 1 siège et 2 langues) si Cat veut éditer « dans la page » ; **Payload** si une souveraineté totale des données est exigée.

### 5.1 Modèle de contenu « Partenaire » (phase 2, rien n'est installé)

Source : `docs/partners-credibility.md` §5 et annexe. Les champs sont **répartis entre deux stockages**, parce que le dataset Sanity gratuit est public.

| Champ | Stockage | Type | Règle |
|---|---|---|---|
| `id` | les deux | identifiant opaque | Lien entre fiche interne et fiche publique ; ne contient pas le nom |
| `nom_interne` | **Coffre** (UE, A2F) | texte | Jamais publié |
| `pays`, `services` | Coffre | listes fermées | — |
| `statut` | Coffre | `prospect` · `actif` · `suspendu` · `termine` | — |
| `consentement_affichage` | Coffre **et** CMS (copie) | `aucun` · `anonymise` · `nom_et_logo` | Par défaut `aucun` |
| `consentement_date`, `consentement_reference`, `droit_logo` | Coffre | date, référence de document, conditions | `consentement_date` obligatoire pour publier |
| `licences_verifiees_le`, `notes` | Coffre | date, texte | Alerte si la vérification dépasse un seuil `[À DÉFINIR avec Cat]` |
| `visible_sur_le_site` | CMS | booléen | **Faux par défaut** |
| `logo` + `alt {fr,en}` | CMS | SVG monochrome | Niveau A seulement ; respecte la charte du partenaire |
| `description_anonymisee {fr,en}`, `territoires`, `anciennete` | CMS | textes courts | Niveau B ; parité FR/EN contrôlée |

**Interdits par le schéma** : tout champ `url`, `email`, `telephone`, `site` publiable ; toute route `/partenaires/[slug]`.

**Validations** : publication refusée si `visible_sur_le_site = true` sans `consentement_date` (copiée du coffre au moment de la validation) ou avec `consentement_affichage = aucun` ; logo refusé si `consentement_affichage ≠ nom_et_logo`.

**Requête publique** : ne lit que les champs publics où `visible_sur_le_site = true` **et** `consentement_affichage ≠ aucun` **et** `consentement_date` renseignée. Zéro résultat → `PartnersBand` ne rend **rien** (ni titre, ni espace réservé).

**Mesure** : au plus une vue agrégée de la section ; aucun événement par partenaire.

---

## 6. Demandes : formulaire en étapes, rappel, coffre, e-mails

Spec : `docs/trust-contact-launch.md` §3 et §4, annexes A à D. Textes : annexe B.4.

### 6.1 Formulaire en étapes : parcours
1. Page `/contact` : **un seul formulaire HTML en 4 `fieldset`** (Besoin · Pour qui, où, quand · Comment vous joindre · Un mot libre). Rendu côté serveur, **fonctionnel sans JavaScript** : les 4 parties s'affichent à la suite et l'envoi (POST natif vers la Server Action) fonctionne.
2. Avec JavaScript : une partie à la fois, titre « Étape 2 sur 4 · … » qui reçoit le focus à chaque changement, filet de progression, bouton Retour. Validation locale de l'étape avant de continuer. **Rien n'est envoyé au serveur avant l'envoi final.**
3. Brouillon : `sessionStorage`, clés `mt-draft-*`, **seulement** besoin, pays, langue, créneau ; effacé à l'envoi. Jamais le nom, le contact, « pour qui », l'urgence ni le message.
4. Validation serveur Zod. En cas d'erreur : la page se réaffiche **avec les valeurs conservées**, à l'étape fautive, résumé d'erreurs en tête qui reçoit le focus (maquette `110:7`).
5. Succès : écriture dans le coffre, puis redirection vers `/contact/merci` (`noindex`) ; e-mails par la boîte d'envoi (§6.6).
6. Échec d'écriture dans le coffre : état « L'envoi n'a pas abouti » (maquette `111:107`) **sans perte de la saisie** ; aucun e-mail ne part.

### 6.2 Champs de la demande

| Étape | Champ | Règle | Remarque |
|---|---|---|---|
| 1 | Nature de la demande | requis, liste fermée : `conciergerie`, `grand-age`, `enfants`, `indecis` | **Présélectionnée** par `?service=`, modifiable |
| 2 | Pour qui ? | facultatif : pour moi · pour un proche · autre | Hors brouillon |
| 2 | Pays | requis : `BE · FR · LU · MC · CH` + `autre` `[À VALIDER]` | — |
| 2 | Urgence | requis : aucune · dans les semaines à venir · urgent | « Urgent » affiche la mention des services d'urgence (annexe D.5) ; hors brouillon |
| 3 | Nom | requis, 2-120 caractères | `autocomplete="name"` |
| 3 | E-mail | e-mail valide | `autocomplete="email"` ; **au moins un des deux** (e-mail ou téléphone) |
| 3 | Téléphone | téléphone international valide | `autocomplete="tel"` ; deux champs plutôt qu'un seul mixte (WCAG 1.3.5) |
| 3 | Créneau | facultatif : matin · après-midi · soir | — |
| 3 | Langue de réponse | requis : français · English | Préremplie par la langue de la page |
| 4 | Un mot libre | **facultatif**, 0-2 000 caractères | Aide visible : « Inutile de nous donner des détails médicaux ; nous en parlerons de vive voix. » **Aucun champ santé** ; jamais sauvegardé en brouillon |
| 4 | Consentement | case requise, non cochée par défaut | Lien vers la politique de confidentialité ; base légale à trancher par le juriste (`docs/privacy.md`) |
| — | `locale` | caché, `fr` ou `en` | Langue de l'interface |
| — | `source` | caché, code de la liste fermée `?s=` ou vide | Jamais lié à un identifiant de mesure |
| — | Honeypot | caché aux humains (hors écran, `tabindex=-1`, `autocomplete=off`, `aria-hidden`) | Rempli = rejet silencieux |
| — | Horodatage signé | caché, HMAC | Envoi en moins de 3 s = rejet |

### 6.3 Rappel à la demande
- Page `/contact/rappel` : nom, numéro, langue, créneau (matin · après-midi · soir) et jours, case « Ne pas laisser de message vocal », consentement. Mêmes protections que le formulaire.
- Alimente **le même coffre** (type `rappel`) et la même notification. Confirmation claire, sans écho du contenu.

### 6.4 Situation urgente (conditionnelle, E3-S7)
- N'existe **que si Cat valide** qu'elle peut y répondre. Variante courte du formulaire (besoin, pays, contact, un mot libre), marquée « prioritaire » dans le coffre et dans l'objet de la notification.
- **Décision du 15/10/2026 (D04, interprétation à confirmer)** : Cat répond dans tous les cas sous 24 à 48 heures, ce qui n'est pas une urgence pour le visiteur ; proposition : **pas de lien d'en-tête**, story close sans code ; le champ « Urgence » et la mention ci-dessous restent dans le formulaire.
- Mention permanente : la maison n'est pas un service d'urgence, numéros vérifiés par pays (annexe D.5, à revérifier avant l'ouverture). Aucune promesse de délai sans engagement réel.

### 6.5 Coffre (option 1, Scaleway, retenue le 15/10/2026 : D07)

| Sujet | Proposition |
|---|---|
| Base | PostgreSQL **UE**, chiffrement au repos activé, TLS obligatoire. Reco : Scaleway Managed PostgreSQL (option 1) |
| Chiffrement applicatif | **Sealed box** libsodium : la fonction serveur ne connaît que la **clé publique** et chiffre la demande dès réception ; la clé privée, protégée par phrase de passe (Argon2id), n'est déchiffrée que **dans le navigateur de l'admin** ; copie de secours hors ligne chez Cat et Sady. Perdre la clé = perdre les demandes : procédure écrite en E3-S8 |
| Colonnes en clair | Identifiant, type (`demande` · `rappel` · `urgent`), date, service, pays, langue, urgence, source, statut de traitement, date d'échéance de conservation. **Tout le reste chiffré** (nom, contact, créneau, « pour qui », message) |
| Accès | `/coffre`, **2 comptes nominatifs** créés à la main, inscriptions fermées ; mot de passe + **TOTP obligatoire** (passkey en complément) ; verrouillage après échecs ; sessions courtes ; aucun accès partagé |
| Journal d'accès | Chaque connexion, lecture, export et suppression : qui, quand, quelle demande (identifiant). Jamais le contenu. Conservé `[À DÉFINIR]` |
| Conservation | **Au cas par cas** (D05), dans un **plafond** appliqué automatiquement : proposition 12 mois après le dernier échange `[À VALIDER]` ; tâche planifiée quotidienne (`/api/cron/retention`) qui supprime les demandes échues ; Cat peut supprimer plus tôt |
| Suppression à la demande | Bouton dans le coffre, journalisé ; la ligne subsiste dans les **sauvegardes** jusqu'à la fin de leur fenêtre (7 jours pour les options proposées), ce que dit la politique de confidentialité |
| Partenaires (phase 2) | Champs internes du §5.1 dans une table distincte, mêmes règles d'accès |
| Connexion depuis Vercel | TLS + identifiants forts + utilisateur à droits minimaux (insertion seule pour le site public) ; IP fixes Vercel (100 $/mois) seulement si la base exige un filtrage par IP |
| Limite à documenter | Vercel voit la demande **en clair** dans la fonction, le temps de la chiffrer ; aucune journalisation du corps de requête |

### 6.6 E-mails et boîte d'envoi (Scaleway TEM, D07)
- **Adaptateur unique** (`lib/email`) : fournisseur interchangeable. Reco : **Scaleway TEM** (option 1) ou **Lettermint** ; Mailjet possible ; Brevo (suivi non désactivable) et Resend (données de compte aux États-Unis) écartés (annexe D.3).
- **Notification à Cat** (D06, « très minimaliste ») : objet « Nouvelle demande · Maison Triona » (+ « · Prioritaire » si urgent), **sans service ni pays** ; corps = date + **lien vers la demande dans le coffre**. Aucun nom, contact, service ni message.
- **Confirmation au visiteur** (si e-mail fourni) : texte **fixe** dans sa langue, aucun contenu saisi repris ; envoyée seulement après l'écriture dans le coffre ; limitation de débit par IP **et** par adresse.
- **Alerte technique** à Sady : échec après reprises, rebond, plainte ; identifiant technique seulement.
- **Boîte d'envoi** : table dans la base du coffre, écrite **dans la même transaction** que la demande ; premier envoi juste après la réponse au visiteur ; reprises par Vercel Cron (toutes les 5 à 10 minutes, délai croissant) ; alerte après la dernière tentative.
- Délivrabilité (sous-domaine d'envoi, SPF, DKIM, DMARC progressif, aucun pixel ni lien traqué, tests de réception) : `docs/email-deliverability.md`.

### 6.7 Sécurité des envois
- **Limitation de débit** : 3 envois par 10 minutes et par empreinte d'IP (hachée avec un sel quotidien, jamais stockée en clair), plus un plafond global quotidien et une limite par adresse de confirmation. Upstash Redis région UE (gratuit à ce volume) ; alternative : règle Vercel WAF, à placer alors sur une Route Handler.
- Une Server Action est un point d'entrée POST public : Next vérifie l'en-tête `Origin` mais **laisse passer les requêtes sans `Origin`** ; d'où la limitation de débit et la validation stricte.
- `bodySizeLimit` des Server Actions abaissé (64 ko).
- **Aucune donnée des demandes dans les journaux** (Vercel, base, fournisseur e-mail) : seuls un identifiant d'événement et un statut (`stored`, `rejected:honeypot`, `rejected:rate`, `failed:vault`, `queued`, `sent`, `failed:provider`) sont journalisés.
- La **seule copie complète** d'une demande est la ligne chiffrée du coffre (et ses sauvegardes, dans leur fenêtre). L'e-mail ne la contient pas.
- Routes `/api/cron/*` protégées par le secret Vercel Cron ; webhook e-mail vérifié par signature.

### 6.8 Partage familial et PDF
- `ShareLinks` sur « Comment ça se passe », les pages de service et la FAQ, **le plus épuré possible** (D09) : deux liens texte au plus. « Envoyer à un proche » ouvre le menu de partage natif (`navigator.share`) quand il existe, sinon un `mailto:` prérempli (objet et phrase FR/EN, URL de la page) ; **« Copier le lien »** (API Presse-papiers, message `aria-live` « Lien copié » ; sans JavaScript, le lien reste visible et sélectionnable). Aucun widget ni script tiers, aucun bouton de réseau social.
- **Feuille `print.css`** pour les pages de réassurance : sans en-tête ni navigation, `<details>` ouverts, URL des liens affichées.
- **PDF** : `scripts/build-pdf` lance Playwright sur `/[locale]/comment-ca-se-passe/imprimer` après le build et écrit `public/documents/*.pdf` (`tagged: true`, `outline: true`, `<html lang>`, titres h1 à h3). Contrôle PAC ou veraPDF consigné dans `docs/a11y-report.md` (conformité PDF/UA non garantie). Le PDF n'existe que lorsque le texte est validé (`check:content`).

---

## 7. SEO

Stratégie, étude et faits datés : `docs/seo-strategy.md` (§G pour le technique).

- Métadonnées par page et par langue (`generateMetadata`, textes issus du CMS) : `title` et `description` uniques, `canonical` vers soi-même, `alternates.languages` (`fr`, `en`, `x-default`), Open Graph, image OG statique par langue. **Jamais le nom de Cat.**
- `sitemap.xml` avec alternances, `robots.txt` ; `noindex` sur `/contact/merci`, `/comment-ca-se-passe/imprimer`, `/demo`, la 404, tout `/coffre` et toute préproduction (en-tête `X-Robots-Tag`).
- Jamais de redirection selon l'IP ou la langue du navigateur ; `/` → `/fr`.
- JSON-LD : `Organization` minimal (nom, URL, logo), **sans adresse ni personne** ; `BreadcrumbList` si utile ; `FAQPage` (page FAQ) et `Service` (pages de service) restent valides dans schema.org mais **sans résultat enrichi Google** en 2026 : légers, jamais présentés comme un levier. **Exclus** : `HowTo`, `LocalBusiness`, avis et notes.
- Pas de fiche Google Business Profile au lancement (`docs/seo-strategy.md` §H).
- « SEO discret » (NFR8) : pas de pages satellites, pas de pages « ville » vides, pas de bourrage de mots-clés.
- Lighthouse SEO ≥ 95 (E7-S3).

---

## 8. Performance

| Poste | Budget | Moyen |
|---|---|---|
| Lighthouse Perf / A11y / SEO | **≥ 95** mobile et desktop, vidéo comprise | Lighthouse 13 en CI sur chaque préproduction |
| LCP | ≤ 2,0 s (Lighthouse mobile) ; perçu < 1,5 s en 4G réelle | Poster hero préchargé, AVIF, pas d'animation d'opacité sur le LCP |
| **INP** | ≤ 200 ms (seuil « bon » de Google), visé < 100 ms | Formulaire en étapes léger, aucun calcul lourd au changement d'étape |
| CLS | 0 | `aspect-ratio` réservé, polices avec métriques de repli ajustées, hauteur des étapes stable |
| TBT | < 150 ms | Server Components, Client Components minimaux |
| JS initial | ≤ 100 ko gzip | Pas de bibliothèque d'UI, Motion en `LazyMotion` ; libsodium **uniquement** dans `/coffre`, jamais dans le site public |
| CSS | ≤ 25 ko | Tailwind v4 sans palette par défaut |
| Polices | 2 fichiers préchargés, ≤ 80 ko | `next/font`, sous-ensemble latin (sauf Satoshi, voir licence) |
| Avant LCP | ≤ 320 ko mobile, ≤ 360 ko desktop | `docs/media-pipeline.md` §7 |
| Vidéo | ≤ 2,5 Mo par scène (≤ 4 Mo en scrub), desktop uniquement ; V01 après `load`, les autres à l'approche de leur scène, une seule en lecture | `docs/media-pipeline.md` §6 et §7 |
| Envoi d'une demande | Réponse au visiteur < 1,5 s (écriture dans le coffre seulement ; l'e-mail part après) | Boîte d'envoi (§6.6) |

Mesures : Lighthouse 13 (mobile et desktop) ; analyse de bundle ; trace Performance de Chrome sur la page d'accueil et sur le formulaire. Aucun script de mesure tiers (pas de RUM externe).

---

## 9. Sécurité et confidentialité

### 9.1 En-têtes HTTP (`next.config` → `headers()`)

| En-tête | Valeur proposée |
|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` (`preload` après validation du domaine) |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=(), usb=()` ; `clipboard-write=(self)` si la copie de lien l'exige (à vérifier) |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `X-Frame-Options` | `DENY` (doublon historique de `frame-ancestors`) |

**CSP** : une CSP à **nonce** forcerait le rendu dynamique de toutes les pages (doc Next.js), ce qui est contraire au §2. On retient donc une **CSP statique**. Elle exige aujourd'hui `'unsafe-inline'` pour les scripts en ligne de Next ; risque faible ici (aucun contenu saisi par des tiers n'est affiché sur le site public). En story 5.1, tester l'option expérimentale **SRI par empreinte** de Next pour retirer `'unsafe-inline'`. Comme tout est servi depuis notre domaine (polices, images, analytics proxifié), `'self'` suffit partout.

**CSP du coffre** (`/coffre`, dynamique) : CSP **à nonce** possible et souhaitée ici (le coffre affiche du texte saisi par des inconnus) ; `'wasm-unsafe-eval'` probablement nécessaire pour libsodium en WebAssembly (**à vérifier** en E3-S8) ; `Cache-Control: no-store` ; `X-Robots-Tag: noindex, nofollow`. Le contenu des demandes est toujours rendu comme **texte**, jamais comme HTML.

### 9.2 Secrets et dépendances
- Secrets uniquement dans les variables d'environnement Vercel ; `.env.example` versionné, `.env*` ignorés. La **clé privée du coffre n'est jamais** dans les variables d'environnement (seule la clé publique y est).
- Dépôt git **privé** (confidentialité du projet ; obligatoire si Satoshi revient).
- Mises à jour de sécurité automatiques (Dependabot ou Renovate), Next maintenu au dernier correctif.
- Webhook CMS et webhook e-mail vérifiés par signature ; jeton CMS en lecture seule, côté serveur uniquement ; secret Vercel Cron.

### 9.3 RGPD

Version détaillée et à jour : **`docs/privacy.md`** (coffre, consentement, conservation, suppression, sous-traitants, données sensibles liées au choix du besoin, mesure agrégée, paramètres d'URL dans les journaux, images générées). Résumé :

| Traitement | Données | Base légale | Destinataire / sous-traitants | Conservation |
|---|---|---|---|---|
| Demande et rappel | Nom, e-mail ou téléphone, pays, besoin, pour qui, urgence, créneau, langue, message facultatif, source anonyme | Mesures précontractuelles (art. 6.1.b) ; consentement explicite (art. 9.2.a) si le message révèle malgré tout une information de santé `[À VALIDER par le juriste]` | Cat et Sady (coffre) ; base UE ; hébergeur (Vercel) ; fournisseur e-mail (notification sans contenu) | `[À DÉFINIR avec Cat]` + fenêtre de sauvegarde (7 jours) |
| Confirmation au visiteur | Adresse e-mail | Mesures précontractuelles | Fournisseur e-mail | Selon les journaux du fournisseur `[À VÉRIFIER]` |
| Journal d'accès au coffre | Compte, date, action, identifiant de demande | Intérêt légitime (sécurité) | Base UE | `[À DÉFINIR]` |
| Limitation de débit | Empreinte d'IP salée, empreinte d'adresse | Intérêt légitime (sécurité) | Upstash (UE) | 24 h |
| Mesure d'audience | Agrégats anonymes | Intérêt légitime | Plausible (UE) | Selon Plausible |
| Partenaires (phase 2) | Nom, consentements, vérifications | Contrat / intérêt légitime | Base UE (interne), CMS (public validé) | Durée du partenariat + `[À DÉFINIR]` |

- **Aucun cookie** sur le site public (cookie de langue next-intl désactivé, analytics sans cookie) : **pas de bandeau**. Le coffre utilise un **cookie de session strictement nécessaire** (exempté de consentement), limité à `/coffre`, `HttpOnly`, `Secure`, `SameSite=Strict`. Absence de bandeau à **faire valider juridiquement** : les lignes directrices EDPB 2/2023 étendent la directive ePrivacy au-delà des cookies, et l'exemption CNIL pour la mesure d'audience a des conditions strictes.
- **Mentions légales** à compléter avec des données réelles : forme juridique, siège, numéro d'entreprise (BCE ou SIREN), TVA, directeur de la publication, hébergeur (Vercel Inc.), contact. `[CONTENU À FOURNIR PAR CAT]`
- Clientèle en Suisse et à Monaco : la nLPD suisse et la loi monégasque s'appliquent aussi ; vérification juridique recommandée avant la mise en ligne. Question HDS (France) pour le juriste (`docs/trust-contact-launch.md` annexe D).
- Mention d'usage d'images générées par IA (voir `docs/media-pipeline.md` §8).

---

## 10. Environnements et qualité

| Environnement | Rôle |
|---|---|
| Local | `npm run dev` ; base locale ou base de test UE, **aucune donnée réelle** |
| Préproduction | Déploiement Vercel par branche ; **protection standard de Vercel + liens partageables** (Cat sans compte, révocables) ; `noindex` (automatique sauf domaine personnalisé sur la branche, sinon `X-Robots-Tag` ajouté par nous) ; base de préproduction distincte, **aucune donnée réelle** ; fournisseur e-mail en mode test. Alternative : mot de passe Vercel (20 $/mois) ; repli gratuit : authentification simple dans `proxy.ts` quand `VERCEL_ENV = preview` |
| Production | Branche `main`, domaine `[À CONFIRMER]`, région `cdg1` ; base du coffre UE ; Vercel Cron (boîte d'envoi, rétention) |

**Intégration continue** (GitHub Actions), à chaque PR : lint · `tsc --noEmit` · Prettier (vérification) · build · tests E2E Playwright (fournisseur e-mail simulé, base de test) : formulaire avec et sans JavaScript, rappel, brouillon non sensible, partage · axe sur toutes les pages, FR et EN (balises `wcag2a`, `wcag2aa`, `wcag21aa`, `wcag22aa`) · `check-content` · `check-i18n` (parité des clés) · `check-third-party` (aucun domaine externe ni référence au moodboard dans le code et le HTML produit) · Lighthouse 13 mobile et desktop sur l'URL de préproduction (seuils ≥ 95). Test réel de bout en bout (coffre, notification, confirmation, journaux vides de contenu) sur la préproduction avant chaque mise en production.

**Exploitation** : surveillance de disponibilité (sans script tiers dans les pages), alertes d'échec d'envoi, sauvegardes de la base vérifiées, **procédure de restauration testée** avant l'ouverture (`docs/launch-checklist.md`).

---

## 11. Emplacement du dépôt (tranché le 15/10/2026 : D17)

Le dossier actuel (`/Volumes/DISQUE SADY/06_CLIENTS/MAMAN /MAISON TRIONA `) a des **espaces en fin de nom** sur deux niveaux. Le volume est en APFS (les liens symboliques fonctionnent), mais ces espaces finaux cassent régulièrement des scripts, des outils CLI et certains chemins générés.

**Décision (D17, révisée le 15/10/2026)** : le dépôt git privé est créé **dans le dossier actuel**, sans renommage ; la story 1.1 vérifie que le build, les tests et les scripts fonctionnent malgré les espaces finaux. Les dossiers de travail gardent leurs noms (espaces finaux) et sont exclus par motif (`/LOGO*/`, `/TYPO*/`…), car Git ignore un espace final non échappé. Option écartée : créer le dépôt dans un chemin propre, puis y déplacer `docs/`, `.claude/` et `CLAUDE.md`. Les dossiers de travail (`ASSETS PHOTO MAQUETTE/`, `MOODBOARD */`, `TYPO/`, `LOGO/`, PDF du PRD) restent **hors du dépôt** ou dans `.gitignore` (droits, poids, licence Satoshi).

---

## 12. Récapitulatif `[À TRANCHER]`

| Point | Recommandation |
|---|---|
| CMS | Sanity, offre gratuite, Studio hébergé ; aucune donnée interne dans le dataset public |
| ~~Coffre, chiffrement, authentification~~ | **Tranché (D07)** : option 1, Scaleway Managed PostgreSQL + sealed box libsodium + Better Auth (TOTP obligatoire), ≈ 12 à 15 €/mois |
| ~~Fournisseur e-mail~~ | **Tranché (D07)** : Scaleway TEM, suivi désactivé |
| ~~Contenu de la notification à Cat~~ | **Tranché (D06)** : très minimaliste, objet sans service ni pays, lien vers le coffre |
| Durée de conservation des demandes | **Au cas par cas (D05)**, dans un plafond écrit (proposition : 12 mois après le dernier échange) à valider par le juriste |
| Préproduction | Protection standard Vercel + liens partageables (inclus dans Pro) |
| Domaine et adresse de réception | À fournir par Cat |
| ~~Préfixe de langue~~ | **Tranché par la spec d'entrée** : `/fr` et `/en` toujours présents |
| Chemins EN | Ceux du tableau §4 (dont `/en/where-we-work`, glossaire de la spec) |
| ~~Choix d'entrée : ancre ou page~~ | **Les deux** (ancre depuis l'accueil, page dédiée pour le partage) |
| Options « Nature de la demande » et « Pays » | 3 services + « Je ne sais pas encore » ; 5 pays + Autre `[À VALIDER]` |
| E-mail et téléphone : un champ ou deux | Deux champs, au moins un requis (autocomplétion, WCAG 1.3.5) |
| `?service=` et `?s=` dans les journaux de l'hébergeur | Les garder (fonctionnent sans JS), rétention minimale, aucun export de logs (`docs/privacy.md` §2) |
| ~~`navigator.share`~~ | **Tranché (D09)** : accepté, interface la plus épurée possible |
| Lien « Situation urgente » | D04 : Cat répond sous 24 à 48 h dans tous les cas ; proposition : pas de lien d'en-tête `[À CONFIRMER]` |
| Dépôt des sorties Higgsfield | `media-incoming/` à la racine plutôt que `public/media/_incoming/` |
| ~~Emplacement du dépôt~~ | **Tranché (D17)** : dossier actuel (espaces finaux conservés), dépôt git privé |
| Absence de bandeau cookies | À valider juridiquement |
