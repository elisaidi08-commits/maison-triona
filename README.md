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
| `npm run lighthouse` | Lighthouse 13, mobile et desktop, seuils ≥ 95 ; exige `npm run start -- --port 3100` dans un autre terminal |
| `npm run check:content` | Échoue s'il reste un contenu provisoire (`[CONTENU À FOURNIR PAR CAT]`, `[À VALIDER…]`…) |
| `npm run check:i18n` | Échoue si une clé existe en FR et pas en EN (ou l'inverse) |
| `npm run check:third-party` | Échoue si une ressource externe ou une référence au moodboard apparaît |
| `bash scripts/ingest-media.sh …` | Ingestion d'un média généré (voir `/ingest-media` et `docs/media-pipeline.md`) |

Les tests E2E et axe lancent eux-mêmes un build de production (port 3100), ou réutilisent un serveur déjà ouvert sur ce port.

## Règles à connaître avant de coder

- Une story par branche, commits en français à l'impératif.
- Aucune ressource tierce dans le navigateur, aucun cookie, aucune donnée de formulaire dans les journaux.
- Le site reste en `noindex` tant que `SITE_INDEXABLE` ne vaut pas `true` (seulement en production, le jour de l'ouverture).
- Les dossiers de travail (`ASSETS PHOTO MAQUETTE `, `MOODBOARD *`, `LOGO `, `TYPO `), le PDF du PRD et `media-incoming/` ne sont **jamais** versionnés ni envoyés à Vercel.
