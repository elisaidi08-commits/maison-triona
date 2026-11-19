# Maison Triona — by K.

Site vitrine de Maison Triona (Next.js 16, React 19, TypeScript strict, Tailwind CSS 4). Dépôt **privé**.

Le cadrage complet est dans `CLAUDE.md` et `docs/` : commencer par `docs/decisions.md`, puis `docs/plan-implementation.md` pour la story en cours.

## Prérequis

- **Node.js 24** (version de Vercel, voir `.nvmrc`). Une autre version majeure fonctionne en local, avec un avertissement `EBADENGINE` à l'installation.
- npm 11.
- Le dossier du projet a des **espaces en fin de nom** : toujours mettre les chemins entre guillemets dans le terminal.

## Installation

```bash
npm install
npx playwright install chromium   # navigateur des tests et de Lighthouse (environ 100 Mo, une fois)
cp .env.example .env.local        # puis ajuster si besoin ; jamais de vraie valeur dans .env.example
```

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` · `npm run start` | Build de production et serveur |
| `npm run lint` | ESLint (règles Next, TypeScript, accessibilité jsx-a11y) |
| `npm run typecheck` | Types de routes (`next typegen`) puis `tsc --noEmit` |
| `npm run format` · `npm run format:check` | Prettier (code seulement ; la documentation n'est pas reformatée) |
| `npm run test:e2e` | Playwright : la page répond, aucune requête tierce, aucun cookie, noindex hors production |
| `npm run test:a11y` | axe, WCAG 2.2 AA |
| `npm run test:unit` | Tests unitaires (testeur intégré de Node) : calcul des créneaux de la réservation d'appel, configuration de la base, échéance de conservation |
| `npm run test:integration` | Tests contre PostgreSQL (base jetable `maison_triona_test`, vidée à chaque fichier ; `TEST_DATABASE_URL` pour une autre adresse, dont le nom doit finir par `_test`) |
| `npm run db:migrate` | Applique les migrations de `db/migrations/` à la base de `DATABASE_URL` ; à lancer à la main, jamais pendant le build |
| `npm run vault:keys -- <paquet.json>` | Génère la paire de clés du coffre, hors ligne : paquet de la clé privée écrit hors du dépôt, clé publique affichée pour `VAULT_PUBLIC_KEY`. `--ajouter <existant.json> <nouveau.json>` : paquet d'une seconde personne, même clé, autre phrase (procédure : `docs/coffre-cles.md`) |
| `npm run coffre:compte -- --nom "Prénom Nom" --email adresse` | Crée un compte du coffre (deux au plus) dans la base de `COFFRE_DATABASE_URL` ; mot de passe **généré** et affiché une fois (`--saisir` : saisi, masqué, 24 caractères au moins, jamais en argument) ; `--reenroler --email adresse` recrée le compte (`docs/coffre-cles.md` §7) ; puis enrôler le TOTP sur `/coffre/connexion` dans les 24 heures |
| `npm run lighthouse` | Lighthouse 13, mobile et desktop, seuils ≥ 95 ; exige `npm run start -- --port 3100` dans un autre terminal |
| `npm run check:content` | Échoue s'il reste un contenu provisoire (`[CONTENU À FOURNIR PAR CAT]`, `[À VALIDER…]`…) |
| `npm run check:i18n` | Échoue si une clé existe en FR et pas en EN (ou l'inverse) |
| `npm run check:third-party` | Échoue si une ressource externe ou une référence au moodboard apparaît |
| `bash scripts/ingest-media.sh …` | Ingestion d'un média généré (voir `/ingest-media` et `docs/media-pipeline.md`) |

Les tests E2E et axe lancent eux-mêmes un build de production (port 3100), ou réutilisent un serveur déjà ouvert sur ce port.

Base locale (coffre) : `brew install postgresql@17`, `brew link --force postgresql@17` (formule keg-only : sans lien, `createdb` n'est pas dans le `PATH`), `brew services start postgresql@17`, `createdb maison_triona_dev`, `createdb maison_triona_test`.

## Envoi des e-mails (story 3.3)

- **Coupé** tant que `TEM_SECRET_KEY`, `TEM_PROJECT_ID`, `EMAIL_FROM`, `EMAIL_NOTIFY_TO` et `EMAIL_ALERT_TO` sont vides (poste local, CI) : les demandes s'enregistrent dans le coffre, sans notification. Variables décrites dans `.env.example` ; il faut aussi `ENVOI_DATABASE_URL` (compte de l'envoi) et `CRON_SECRET`.
- Le premier essai part juste après la demande. La tâche planifiée Vercel Cron `/api/cron/envoi` (`vercel.json`, toutes les 5 minutes, **production seulement**) reprend les échecs, suit la livraison et purge la boîte d'envoi ; Vercel l'appelle avec `Authorization: Bearer <CRON_SECRET>` (32 caractères au moins : `openssl rand -hex 32` ; même secret et même vérification que la conservation du coffre). En local, elle ne tourne pas d'elle-même : `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/envoi`.
- **Rôles de la base**, après `npm run db:migrate`, avec l'URL administrateur : `psql "<URL administrateur>" -f db/roles/site_public.sql -f db/roles/coffre.sql -f db/roles/envoi.sql`. `site_public.sql` est à **rejouer** après la migration `0006` : sans lui, chaque demande est gardée sans notification (`[demande] failed:outbox`). Procédure complète : `docs/coffre-cles.md` §3.

## Règles à connaître avant de coder

- Une story par branche, commits en français à l'impératif.
- Aucune ressource tierce dans le navigateur, aucun cookie, aucune donnée de formulaire dans les journaux.
- Le site reste en `noindex` tant que `SITE_INDEXABLE` ne vaut pas `true` (seulement en production, le jour de l'ouverture).
- Les dossiers de travail (`ASSETS PHOTO MAQUETTE `, `MOODBOARD *`, `LOGO `, `TYPO `), le PDF du PRD et `media-incoming/` ne sont **jamais** versionnés ni envoyés à Vercel.
