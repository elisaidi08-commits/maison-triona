# Base du coffre (story 3.2, partie A) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** poser la base PostgreSQL du coffre (connexion, migrations, schéma des demandes et du journal d'accès) et sa couche d'accès aux données, testées contre un vrai PostgreSQL 17, en local et en CI.

**Architecture :** un pilote `pg`, des migrations en SQL pur appliquées par un petit script maison (verrou consultatif, empreinte SHA-256 de chaque fichier), un module d'accès aux données sans ORM. Le contenu des demandes arrive **déjà chiffré** (`sealed`, octets de la sealed box, story 3.2 partie B) : cette partie ne chiffre rien et ne voit jamais de contenu en clair. Aucun écran, aucune route.

**Tech Stack :** PostgreSQL 17 (Homebrew en local, image `postgres:17` en CI ; Scaleway propose 14 à 17), `pg` 8.23.1, `@types/pg` 8.23.1, Node 24 (`node --test`), TypeScript strict.

**Références :** `docs/architecture.md` §6.5 (coffre), `docs/trust-contact-launch.md` §4.1, `docs/privacy.md` §5, PR n° 43 (dossier RGPD : limitation « gelée », journal conservé après effacement), `docs/decisions.md` D05, D07, D57.

**Règles non négociables :**
- **Aucune donnée réelle** : seulement des données de test ; jamais de contenu de demande dans un journal, un message d'erreur ou une sortie de test.
- `resetDatabase` refuse toute base dont le nom ne finit pas par `_test`.
- Les migrations ne tournent **jamais** pendant le build : `npm run db:migrate`, lancé à la main.
- Le journal d'accès n'a **pas** de clé étrangère vers les demandes : il survit à leur effacement.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `db/migrations/0001_coffre.sql` (créé) | Tables `vault_requests` et `vault_access_log` |
| `src/lib/db/config.ts` (créé) | `poolConfigFromEnv(env)` : configuration du pool depuis les variables d'environnement (pure) |
| `src/lib/db/pool.ts` (créé) | `getPool()` : pool unique par processus |
| `src/lib/db/transaction.ts` (créé) | `withTransaction(pool, fn)` |
| `src/lib/db/migrate.ts` (créé) | `migrate(pool, dir)` : applique les migrations en attente |
| `src/lib/vault/retention.ts` (créé) | `RETENTION_MONTHS`, `retentionDeadline(createdAt, months)` (pure) |
| `src/lib/vault/repository.ts` (créé) | Accès aux demandes et au journal |
| `scripts/db-migrate.mjs` (créé) | Commande `npm run db:migrate` |
| `tests/unit/db-config.test.ts`, `tests/unit/retention.test.ts` (créés) | Tests unitaires |
| `tests/integration/helpers.ts`, `tests/integration/migrate.test.ts`, `tests/integration/vault-repository.test.ts` (créés) | Tests contre PostgreSQL |
| `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `.env.example` (modifiés) | Dépendances, scripts, base de test en CI |
| `docs/architecture.md`, `docs/plan-implementation.md`, `README.md`, `CLAUDE.md` (modifiés) | Documentation |

Conventions : identifiants en anglais, commentaires en français, Prettier du projet (sans points-virgules, guillemets simples, 100 colonnes), imports relatifs **avec** l'extension `.ts` entre ces modules et depuis les tests (jamais `@/`), `import type` pour les types. Versions exactes dans `package.json` (pas de `^`).

---

### Task 1 : Dépendances, configuration, migrations, CI

- [ ] **Step 1** : `npm install --save-exact pg@8.23.1` et `npm install --save-exact --save-dev @types/pg@8.23.1`.
- [ ] **Step 2** : scripts dans `package.json`, après `test:unit` :
  ```json
  "test:integration": "node --test --test-concurrency=1 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON 'tests/integration/*.test.ts'",
  "db:migrate": "node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/db-migrate.mjs",
  ```
- [ ] **Step 3 (TDD)** : `tests/unit/db-config.test.ts` puis `src/lib/db/config.ts`.
  - `poolConfigFromEnv(env: Record<string, string | undefined>): PoolConfig` (type `PoolConfig` de `pg`).
  - `DATABASE_URL` absente ou vide → `Error('DATABASE_URL manquante')`.
  - `DATABASE_CA_CERT` présent → `ssl: { ca, rejectUnauthorized: true }`.
  - `VERCEL_ENV === 'production'` sans `DATABASE_CA_CERT` → `Error('TLS obligatoire en production : DATABASE_CA_CERT manquant')`.
  - Sinon `ssl: false`. Toujours `max: 5`, `idleTimeoutMillis: 10_000`, `application_name: 'maison-triona'`.
  - Le message d'erreur ne contient **jamais** l'URL (elle peut porter un mot de passe) ; un test le vérifie.
- [ ] **Step 4** : `src/lib/db/pool.ts` : `getPool()` crée une seule fois `new Pool(poolConfigFromEnv(process.env))` et la garde sur `globalThis` (rechargements à chaud du serveur de développement). `src/lib/db/transaction.ts` : `withTransaction<T>(pool, fn: (client: PoolClient) => Promise<T>)` → `BEGIN`, `COMMIT`, `ROLLBACK` sur erreur puis relance, `client.release()` dans tous les cas.
- [ ] **Step 5 (TDD)** : `tests/integration/helpers.ts`, `tests/integration/migrate.test.ts`, puis `src/lib/db/migrate.ts`.
  - `helpers.ts` : `TEST_DATABASE_URL` (défaut `postgres://localhost:5432/maison_triona_test`) ; `testPool()` ; `resetDatabase(pool)` qui **lève une erreur** si le nom de la base (lu dans l'URL) ne finit pas par `_test`, sinon `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`.
  - `migrate(pool, dir): Promise<string[]>` (versions appliquées par cet appel) :
    - crée `schema_migrations (version text primary key, checksum text not null, applied_at timestamptz not null default now())` si absente ;
    - prend `pg_advisory_lock(hashtext('maison-triona:migrations'))` sur un client dédié, le relâche dans un `finally` ;
    - lit les fichiers `NNNN_nom.sql` du dossier, triés ; pour chacun : déjà appliqué avec la même empreinte → ignoré ; déjà appliqué avec une **autre** empreinte → `Error('Migration modifiée après application : <version>')` ; sinon le fichier et l'insertion dans `schema_migrations` dans **une même transaction**.
  - Tests (dossiers temporaires `fs.mkdtemp` pour les migrations factices) : application sur base vide puis second appel qui n'applique rien ; empreinte modifiée → erreur ; deux appels lancés en même temps → chaque migration appliquée une seule fois, aucune erreur ; une migration SQL invalide → erreur, rien d'enregistré pour elle, les précédentes restent.
  - Chaque fichier de test : `resetDatabase` dans `before`, `pool.end()` dans `after`.
- [ ] **Step 6** : `scripts/db-migrate.mjs` : `migrate(getPool(), 'db/migrations')`, affiche les versions appliquées (ou « Aucune migration en attente »), ferme le pool, code de sortie 1 en cas d'erreur avec le **seul** message d'erreur (jamais l'URL).
- [ ] **Step 7** : CI (`.github/workflows/ci.yml`) : dans le job `qualite`, un service `postgres` (image `postgres:17`, `POSTGRES_USER: postgres`, `POSTGRES_PASSWORD: postgres`, `POSTGRES_DB: maison_triona_test`, port `5432:5432`, contrôle de santé `pg_isready`), une variable de job `TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5432/maison_triona_test`, et l'étape `- run: npm run test:integration` juste après `npm run test:unit`.
- [ ] **Step 8** : `.env.example` : `DATABASE_URL=postgres://localhost:5432/maison_triona_dev`, `DATABASE_CA_CERT=` (commentaire : certificat de l'instance Scaleway, obligatoire en production), `TEST_DATABASE_URL=postgres://localhost:5432/maison_triona_test` ; aucune valeur réelle.
- [ ] **Step 9** : vérifications `npm run test:unit`, `npm run test:integration` (avec la base locale), `npx prettier --check` et `npx eslint` sur les fichiers touchés ; commit « Poser la connexion et les migrations du coffre (3.2) ».

### Task 2 : Schéma et accès aux données du coffre

- [ ] **Step 1 (TDD)** : `tests/unit/retention.test.ts` puis `src/lib/vault/retention.ts`.
  - `RETENTION_MONTHS = 12` (commentaire : proposition D05, `[À VALIDER]` par Cat et le juriste).
  - `retentionDeadline(createdAt: Date, months: number): Date` : même jour et même heure UTC, `months` mois plus tard, **ramené au dernier jour du mois** si ce jour n'existe pas. Tests : 2027-01-31 + 1 → 2027-02-28 ; 2028-02-29 + 12 → 2029-02-28 ; 2027-03-15T10:00Z + 12 → 2028-03-15T10:00Z ; `months` non entier ou négatif → `RangeError`.
- [ ] **Step 2** : `db/migrations/0001_coffre.sql`, exactement :

```sql
-- Coffre des demandes (story 3.2). Le contenu arrive chiffré (sealed box) : la base ne voit
-- jamais de nom, de coordonnée ni de message en clair. Colonnes en clair = colonnes de tri.

create table vault_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('request', 'urgent')),
  created_at timestamptz not null default now(),
  -- Listes fermées validées par l'application (Zod) ; pas de contrainte ici pour pouvoir les faire
  -- évoluer sans migration.
  service text,
  country text,
  locale text not null check (locale in ('fr', 'en')),
  urgency text,
  source text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  -- Limitation (RGPD art. 18) : une demande gelée n'est jamais effacée automatiquement.
  frozen boolean not null default false,
  retention_until timestamptz not null,
  -- Sealed box libsodium : 48 octets de surcoût, donc au moins 49 octets.
  sealed bytea not null check (octet_length(sealed) between 49 and 65536)
);

create index vault_requests_created_at_idx on vault_requests (created_at desc);
create index vault_requests_retention_idx on vault_requests (retention_until) where not frozen;

-- Journal d'accès : jamais de contenu. Pas de clé étrangère : il survit à l'effacement.
create table vault_access_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null check (length(actor) between 1 and 120),
  action text not null check (
    action in ('login', 'read', 'export', 'delete', 'purge', 'freeze', 'unfreeze')
  ),
  request_id uuid
);

create index vault_access_log_request_idx on vault_access_log (request_id, at desc);
```

- [ ] **Step 3 (TDD)** : `tests/integration/vault-repository.test.ts` puis `src/lib/vault/repository.ts`. Toutes les fonctions prennent le `Pool` en premier argument ; requêtes **paramétrées** uniquement.

```ts
export type RequestKind = 'request' | 'urgent'
export type RequestStatus = 'new' | 'in_progress' | 'closed'
export type AccessAction = 'login' | 'read' | 'export' | 'delete' | 'purge' | 'freeze' | 'unfreeze'

export interface NewVaultRequest {
  kind: RequestKind
  service: string | null
  country: string | null
  locale: 'fr' | 'en'
  urgency: string | null
  source: string | null
  sealed: Uint8Array
  retentionUntil: Date
}

export interface VaultRequestSummary {
  id: string
  kind: RequestKind
  createdAt: Date
  service: string | null
  country: string | null
  locale: 'fr' | 'en'
  urgency: string | null
  source: string | null
  status: RequestStatus
  frozen: boolean
  retentionUntil: Date
}

export interface AccessLogEntry {
  at: Date
  actor: string
  action: AccessAction
  requestId: string | null
}

insertRequest(pool, input: NewVaultRequest): Promise<string>                 // id
listRequests(pool, options?: { limit?: number; offset?: number }): Promise<VaultRequestSummary[]>
readSealed(pool, id: string, actor: string): Promise<Uint8Array | null>
deleteRequest(pool, id: string, actor: string): Promise<boolean>
setFrozen(pool, id: string, frozen: boolean, actor: string): Promise<boolean>
purgeExpired(pool, now: Date): Promise<string[]>                               // ids effacés
logAccess(pool, entry: { actor: string; action: AccessAction; requestId?: string }): Promise<void>
listAccessLog(pool, options?: { requestId?: string; limit?: number }): Promise<AccessLogEntry[]>
```

  Comportements à tester (un test chacun) :
  - `insertRequest` puis `listRequests` : colonnes en clair, du plus récent au plus ancien, **aucune propriété `sealed`** dans le résultat ; `limit` par défaut 50, plafonné à 200.
  - `readSealed` : renvoie exactement les octets enregistrés et écrit **dans la même transaction** une ligne `read` avec l'acteur ; id inconnu → `null` et **aucune** ligne de journal.
  - `deleteRequest` : la demande disparaît, une ligne `delete` est écrite, elle **reste** après l'effacement (avec son `request_id`) ; id inconnu → `false`, aucune ligne.
  - `setFrozen` : écrit `freeze` ou `unfreeze` ; id inconnu → `false`.
  - `purgeExpired(now)` : efface les demandes dont `retention_until <= now` et **non gelées**, écrit une ligne `purge` par demande avec l'acteur `system`, renvoie leurs ids ; une demande gelée échue reste ; une demande non échue reste.
  - La base refuse : `sealed` de 48 octets, `kind` inconnu, `locale` inconnue, `action` inconnue (erreurs PostgreSQL `23514`).
  - Aucune fonction ne met d'octets `sealed` ni d'argument dans un message d'erreur qu'elle lève.
- [ ] **Step 4** : vérifications (`test:unit`, `test:integration`, Prettier, ESLint) ; commit « Créer le schéma et l'accès aux données du coffre (3.2) ».

### Task 3 : Contrôles du projet et documentation

- [ ] **Step 1** : `npm run lint && npm run typecheck && npm run format:check && npm run test:unit && npm run test:integration && npm run build`.
- [ ] **Step 2** : `docs/architecture.md` §6.5 : ajouter une ligne « Accès aux données (3.2 A, livré) » : pilote `pg` 8.23.1 (justification : pilote PostgreSQL de référence, sans ORM, requis par Better Auth en 3.2 C) ; migrations SQL dans `db/migrations/`, appliquées à la main par `npm run db:migrate` (jamais au build), verrou consultatif et empreinte SHA-256 ; PostgreSQL 17 en local (Homebrew) et en CI ; TLS par `DATABASE_CA_CERT`, obligatoire en production ; les rôles à droits minimaux (insertion seule pour le site public) restent à créer sur l'instance Scaleway.
- [ ] **Step 3** : `README.md` et `CLAUDE.md` (bloc « Commandes ») : `npm run test:integration` (tests contre PostgreSQL, base `maison_triona_test`) et `npm run db:migrate` ; dans le README, une ligne « Base locale : `brew install postgresql@17`, `brew services start postgresql@17`, `createdb maison_triona_dev`, `createdb maison_triona_test` ».
- [ ] **Step 4** : `docs/plan-implementation.md`, story 3.2 : ligne « *Partie A livrée (base)* : schéma `vault_requests` et `vault_access_log`, migrations, accès aux données, N tests d'intégration en CI. *À suivre* : B chiffrement (sealed box), C connexion (Better Auth, TOTP), D lecture, export, suppression, rétention planifiée. »
- [ ] **Step 5** : commit « Documenter la base du coffre (3.2, partie A) », push.
