# Envoi des e-mails (story 3.3) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** à chaque demande enregistrée, prévenir Cat par un e-mail minimal (D06) et alerter Sady quand un envoi échoue, sans jamais perdre une notification ni faire sortir une donnée de la demande.

**Architecture :** une **boîte d'envoi** (table `outbox`) écrite dans **la même transaction** que la demande ; premier essai juste après la réponse au visiteur (`after()` de Next) ; reprises et suivi de livraison par une tâche Vercel Cron toutes les 5 minutes ; envoi par l'**API REST de Scaleway TEM** en `fetch`, sans dépendance. La boîte d'envoi ne contient ni adresse ni contenu : un gabarit et des identifiants. Les destinataires (Cat, Sady) sont lus dans la configuration au moment de l'envoi. Le suivi des rebonds se fait par **interrogation** (`GET /emails/{id}`), pas par webhook.

**Tech Stack :** Next.js 16 (`after`, route handler, `force-dynamic`), PostgreSQL 17 (`FOR UPDATE SKIP LOCKED`), `pg` 8.23.1, Scaleway TEM `v1alpha1` (`fr-par`), Vercel Cron (offre Pro), Node 24 (`node --test`), TypeScript strict. **Aucune nouvelle dépendance** (`@scaleway/sdk-tem` 2.18.1 existe, mais trois appels REST ne le justifient pas).

**Références :** `docs/architecture.md` §6.6 et §6.7, `docs/email-deliverability.md`, `docs/trust-contact-launch.md` §4.2 et annexe B.4, `docs/reservation-appel.md` §4.5, `docs/decisions.md` D06, D07, D57, D67. Doc Scaleway et Vercel vérifiée le 18/11/2026 (sources au §« Faits vérifiés »).

**Règles non négociables :**
- **Rien de la demande dans un e-mail** : ni nom, ni contact, ni service, ni pays, ni message. La notification porte la date et le lien vers le coffre, plus « Prioritaire » si l'urgence est « urgent » (D06).
- **Le sujet ne dit rien de sensible** : TEM garde l'expéditeur, le destinataire et le **sujet** aussi longtemps que le domaine est actif.
- Une demande s'enregistre **même si l'e-mail échoue** : le coffre est la source de vérité.
- Journaux : un statut et un identifiant technique (`outbox.id`), jamais une adresse, une réponse brute de TEM ni une erreur PostgreSQL complète.
- Aucune donnée réelle dans les tests.

---

## Avant de commencer

1. **La 3.2 C est fusionnée dans `main`** (migrations `0003_auth.sql`, `0004_journal_coffre.sql`, rôle `coffre`, `getCoffrePool`). Rebaser cette branche sur `main` ; la migration de cette story est **`0006_boite_envoi.sql`** (la 3.2 D a pris `0005`) (vérifier qu'aucune autre story n'a pris le numéro).
2. **Décisions de Sady** (§« Décisions à confirmer ») : n° 1 et n° 2 **tranchées le 18/11/2026** (« ok pour les deux recos ») ; n° 3 à 5 **tranchées le 18/11/2026** (« ok pour les deux », et chemin confirmé par la session de la 3.2 D). Les consigner dans `docs/decisions.md` avec le **prochain numéro libre au moment de la fusion** (une autre session écrit aussi dans ce fichier).
3. **Côté Scaleway, pour la production seulement** (le développement et la CI n'en ont pas besoin) : voir §« À faire par Sady ».

## Décisions à confirmer

| N° | Question | Recommandation |
|---|---|---|
| 1 | **E-mail de confirmation au visiteur** (prévu par l'annexe B.4). TEM garderait son adresse et le sujet « Votre demande est bien arrivée » tant que le domaine est actif. Il faut aussi une clé serveur (Key Manager) pour les reprises. Enfin, dans une boîte partagée en famille, le message révèle le contact avec la maison. | **Tranché par Sady le 18/11/2026 : reportée.** Cette story livre la notification à Cat et les alertes (partie A). La page `/contact/merci` confirme déjà l'arrivée à l'écran, et la réponse de Cat sous 48 heures ouvrées sert de confirmation écrite. La confirmation par e-mail devient une partie B, faite seulement si Cat la veut après avoir lu ces limites. |
| 2 | **Suivi des rebonds** : TEM ne propose des webhooks que via **Topics and Events**. C'est un service compatible SNS, payant à part, avec un abonnement à confirmer, des signatures v1 à vérifier contre la chaîne de Scaleway, et des messages qui contiennent `email_to`. | **Tranché par Sady le 18/11/2026 : interroger le statut** (`GET /emails/{id}`) depuis la tâche planifiée, jusqu'à un état final ou 72 heures. Pas de point d'entrée public, pas de service en plus. Il faut donc corriger §6.7 et `email-deliverability.md` §4. |
| 3 | **Doublons** : TEM n'a pas de clé d'idempotence. Si un appel expire sans réponse puis est rejoué, l'e-mail peut partir deux fois. | **Tranché le 18/11/2026 : accepter** : une notification en double est sans conséquence. À documenter. |
| 4 | **Conservation de la boîte d'envoi** : ses lignes ne portent que des identifiants, des dates et des statuts. | **Tranché le 18/11/2026 : 30 jours**, puis effacement par la tâche planifiée. |
| 5 | **Lien de la notification** : `/coffre/demandes/<id>`. Cette page n'existe pas encore : la 3.2 C ne livre que la liste. | **Confirmé par la 3.2 D** (page introuvable pour une demande inconnue). Garder ce chemin et le **réserver** pour la page de lecture du coffre (partie suivante de la 3.2). En attendant, le lien mène à la connexion puis à la liste. |

## Faits vérifiés (18/11/2026)

- **Envoi** : `POST https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails`.
  - En-têtes `X-Auth-Token` et `Content-Type: application/json`.
  - Corps : `{ from: { email, name }, to: [{ email }], subject, text, project_id }`.
  - Réponse 200 : `{ emails: [{ id, status, flags, … }] }`, un objet par destinataire.
  - `fr-par` est la seule région.
  - Pas d'envoi programmé. `send_before` est une date limite, pas une date d'envoi.
  - Un sujet de 10 caractères au moins (exemple de la doc ; nos sujets sont plus longs).
  - Doc : `scaleway.com/en/docs/transactional-email/api-cli/send-emails-with-api/` (validée le 18/11/2025) ; SDK Go `api/tem/v1alpha1/tem_sdk.go`.
- **Statut** : `GET …/emails/{id}`.
  - Statuts : `new`, `sending`, `sent`, `failed`, `canceled`, `unknown`.
  - Flags : `soft_bounce`, `hard_bounce`, `spam`, `mailbox_full`, `mailbox_not_found`, `greylisted`, `send_before_expiration`, `blocklisted`.
  - Aucun événement « plainte ».
- **Domaine** : l'envoi n'est possible que depuis un domaine `checked`.
  - SPF : `v=spf1 include:_spf.tem.scaleway.com -all`.
  - DKIM : nom et valeur donnés par l'API ou la console.
  - DMARC : `_dmarc`, en commençant par `p=none`.
  - MX : le nôtre, ou `blackhole.tem.scaleway.com.`
  - Vérification : jusqu'à 48 heures.
- **Confidentialité TEM** (page publiée le 19/10/2026) :
  - traitement à Paris uniquement ;
  - contenu supprimé dès l'acceptation par le serveur destinataire, ou après 36 heures d'échecs temporaires ;
  - **métadonnées (expéditeur, destinataire, sujet, IP, statut) gardées tant que le domaine est actif**, sans réglage possible (réglage annoncé pour 2027) ;
  - aucun pixel, aucune réécriture de liens.
- **Tarifs** : offre Essential, 300 e-mails gratuits par mois, puis 0,25 € les 1 000.
- **Droits de la clé d'API** : jeux de permissions `TransactionalEmailEmailApiCreate` (envoyer) et `TransactionalEmailEmailReadOnly` (lire les statuts).
- **Vercel Cron, offre Pro** :
  - une fois par minute au plus ;
  - requête `GET` sur le déploiement de **production** seulement ;
  - en-tête `Authorization: Bearer <CRON_SECRET>`, figé au build ; la maison exige un secret de 32 caractères au moins, sans espace (`openssl rand -hex 32`, règle de la 3.2 D) ;
  - **aucune nouvelle tentative**, et une exécution peut manquer ou partir deux fois ;
  - **aucune redirection suivie** (le `matcher` de `src/proxy.ts` exclut déjà `api`) ;
  - `vercel.json` → `crons`.
  - Les Cron Jobs deviennent une fonction « legacy », appelée à migrer vers « Schedules » (en beta) : à surveiller.
  - Doc : `vercel.com/docs/schedules/cron-jobs` (mise à jour le 16/09/2026).
- **`after()`** (doc de Next 16 fournie avec le paquet, `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`) : il s'utilise dans une Server Action et s'exécute même après `redirect`. Sa durée est celle de la route.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `db/migrations/0006_boite_envoi.sql` (créé) | Table `outbox` |
| `db/roles/site_public.sql` (modifié) | + `INSERT` sur `outbox` |
| `db/roles/envoi.sql` (créé) | Rôle `envoi` : boîte d'envoi seulement |
| `src/lib/db/config.ts`, `src/lib/db/pool.ts` (modifiés) | `envoiPoolConfigFromEnv`, `getEnvoiPool()` (`ENVOI_DATABASE_URL`) |
| `src/lib/vault/repository.ts` (modifié) | `guard` exporté (réutilisé par la boîte d'envoi) |
| `src/lib/outbox/schedule.ts` (créé) | Délais des reprises et du suivi (pur) |
| `src/lib/outbox/repository.ts` (créé) | Écriture, réservation, statuts, purge |
| `src/lib/outbox/process.ts` (créé) | Envoi d'un message, passe de la tâche planifiée |
| `src/lib/email/config.ts` (créé) | `emailConfigFromEnv(env)` (pur) |
| `src/lib/email/tem.ts` (créé) | Transport Scaleway TEM : `send`, `status` (fetch) |
| `src/lib/email/templates.ts` (créé) | Notification et alerte, texte seul, en français (interface interne) |
| `src/lib/vault/store.ts` (modifié) | La notification entre dans la transaction de la demande |
| `src/actions/request.ts` (modifié) | `after()` : premier essai |
| `src/lib/security/cron.ts` (créé par la 3.2 D sur `main`) | `autorisationCron(header, env)`, commun aux deux tâches planifiées (comparaison à temps constant) ; `cronAutorise` de la branche retiré à l'intégration de `main` |
| `src/app/api/cron/envoi/route.ts` (créé) | Tâche planifiée |
| `vercel.json` (créé) | `crons` : `/api/cron/envoi` toutes les 5 minutes |
| `tests/unit/email-config.test.ts`, `email-tem.test.ts`, `email-templates.test.ts`, `outbox-schedule.test.ts`, `outbox-cron.test.ts` (créés) ; `db-config.test.ts`, `cron-secret.test.ts` de la 3.2 D (modifiés) | Tests unitaires |
| `tests/integration/outbox-repository.test.ts`, `outbox-process.test.ts`, `outbox-roles.test.ts` (créés) ; `vault-store.test.ts` (modifié) | Tests contre PostgreSQL |
| `.env.example`, `docs/architecture.md`, `docs/email-deliverability.md`, `docs/privacy.md`, `docs/rgpd/registre-des-traitements.md`, `docs/rgpd/sous-traitants.md`, `docs/coffre-cles.md`, `docs/plan-implementation.md`, `docs/decisions.md`, `README.md`, `CLAUDE.md` (modifiés) | Documentation |

Conventions (celles de la 3.2) : identifiants en anglais, commentaires en français, Prettier du projet, imports relatifs **avec** l'extension `.ts` entre modules de `src/lib` et depuis les tests (jamais `@/`), `import type` pour les types, versions exactes.

---

### Task 1 : Migration et rôles

- [ ] **Step 1 (TDD)** : `tests/integration/outbox-repository.test.ts`, premier bloc « schéma » : après `migrate`, une ligne `request_notification` sans `request_id` est refusée (`outbox_notification_shape`) ; une alerte sans `alert_event` est refusée (`outbox_alert_shape`) ; `status = 'accepted'` sans `provider_id` est refusé (`outbox_accepted_shape`). Lancer `npm run test:integration` : échec (table absente).
- [ ] **Step 2** : `db/migrations/0006_boite_envoi.sql` :
  ```sql
  -- Boîte d'envoi des e-mails (story 3.3, docs/architecture.md §6.6). Écrite dans la même
  -- transaction que la demande. Aucune adresse ni aucun contenu de demande : un gabarit et des
  -- identifiants ; les destinataires (Cat, Sady) sont lus dans la configuration à l'envoi.
  -- Pas de clé étrangère vers vault_requests : la demande peut être effacée avant l'envoi.
  create table outbox (
    id uuid primary key,
    created_at timestamptz not null default now(),
    template text not null check (template in ('request_notification', 'technical_alert')),
    request_id uuid,
    priority boolean not null default false,
    alert_event text check (alert_event in ('send_failed', 'undelivered', 'tracking_expired')),
    alert_subject uuid,
    status text not null default 'pending'
      check (status in ('pending', 'accepted', 'delivered', 'undelivered', 'failed')),
    attempts smallint not null default 0 check (attempts between 0 and 10),
    next_attempt_at timestamptz not null default now(),
    lease_until timestamptz,
    provider_id text check (length(provider_id) between 1 and 100),
    provider_flags text[] not null default '{}',
    last_error text check (length(last_error) between 1 and 60),
    accepted_at timestamptz,
    constraint outbox_alert_shape check (
      (template = 'technical_alert') = (alert_event is not null and alert_subject is not null)
    ),
    constraint outbox_notification_shape check (
      template <> 'request_notification' or request_id is not null
    ),
    constraint outbox_accepted_shape check (
      status in ('pending', 'failed') or (provider_id is not null and accepted_at is not null)
    )
  );
  create index outbox_due_idx on outbox (next_attempt_at) where status = 'pending';
  create index outbox_tracking_idx on outbox (accepted_at) where status = 'accepted';
  create index outbox_created_idx on outbox (created_at);
  ```
- [ ] **Step 3** : `db/roles/site_public.sql` : ajouter `grant insert on outbox to site_public;` après la ligne de `vault_requests`, et compléter son commentaire de tête. `db/roles/envoi.sql` : même forme que `coffre.sql`. Créer le rôle `envoi nologin` s'il n'existe pas, tout révoquer (tables, séquences, schéma), puis `grant usage on schema public to envoi;` et `grant select, insert, update, delete on outbox to envoi;`. **Rien** sur `vault_requests`, `vault_access_log` ni les tables de Better Auth.
- [ ] **Step 4 (TDD)** : `tests/integration/outbox-roles.test.ts`, sur le modèle de `vault-role.test.ts` (`SET ROLE`, puis `RESET ROLE`) :
  - `site_public` insère dans `outbox` ; `SELECT`, `UPDATE` et `DELETE` sur `outbox` sont refusés (`42501`) ;
  - `envoi` lit, modifie et efface `outbox` ; `SELECT` sur `vault_requests` et `vault_access_log` est refusé (`42501`).
- [ ] **Step 5** : `npm run test:integration` : tout passe. Commit « Créer la boîte d'envoi et le rôle de l'envoi (3.3) ».

### Task 2 : Connexion du compte d'envoi

- [ ] **Step 1 (TDD)** : `tests/unit/db-config.test.ts`. `envoiPoolConfigFromEnv(env)` :
  - lève `ENVOI_DATABASE_URL manquante` ;
  - sur Vercel (`VERCEL_ENV` présent), refuse une URL identique à `DATABASE_URL` ou à `COFFRE_DATABASE_URL`, avec le message « ENVOI_DATABASE_URL doit différer des autres comptes », sans jamais citer l'URL ;
  - `application_name: 'maison-triona-envoi'` ;
  - TLS et délais comme `configPour`.
- [ ] **Step 2** : implémenter dans `src/lib/db/config.ts` (réutiliser `configPour`). Dans `pool.ts`, ajouter `getEnvoiPool()` sur `globalThis` (`__maisonTrionaEnvoiPool`), comme `getCoffrePool`.
- [ ] **Step 3** : `npm run test:unit` passe. Commit.

### Task 3 : Délais des reprises et du suivi (pur)

- [ ] **Step 1 (TDD)** : `tests/unit/outbox-schedule.test.ts` :
  - `RETRY_DELAYS_MS` vaut `[5 min, 30 min, 2 h]` ;
  - `nextAttemptAt(attempts, now)` renvoie `now + 5 min` après le 1er essai, `+ 30 min` après le 2e, `+ 2 h` après le 3e, et `null` après le 4e (abandon) ;
  - `attempts` hors de 1 à 10, ou date invalide, lève `RangeError` ;
  - `TRACKING_WINDOW_MS` vaut 72 h ; `trackingExpired(acceptedAt, now)` ;
  - `PURGE_AFTER_DAYS` vaut 30 ; `purgeBefore(now)`.
- [ ] **Step 2** : implémenter `src/lib/outbox/schedule.ts`.
- [ ] **Step 3** : tests verts. Commit.

### Task 4 : Accès aux données de la boîte d'envoi

Signatures (`src/lib/outbox/repository.ts`). Toutes les requêtes sont paramétrées, et les erreurs passent par `guard` (à exporter depuis `src/lib/vault/repository.ts`) :

```ts
export type OutboxTemplate = 'request_notification' | 'technical_alert'
export type AlertEvent = 'send_failed' | 'undelivered' | 'tracking_expired'
export interface OutboxItem {
  id: string
  template: OutboxTemplate
  requestId: string | null
  priority: boolean
  alertEvent: AlertEvent | null
  alertSubject: string | null
  attempts: number
  createdAt: Date
}
export interface AcceptedItem { id: string; template: OutboxTemplate; providerId: string; acceptedAt: Date }

/** Dans la transaction de la demande (rôle site_public : INSERT sans RETURNING). */
export function enqueueNotification(client: PoolClient, item: { id: string; requestId: string; priority: boolean }): Promise<void>
/** Réserve les messages dus (bail de 2 minutes) et incrémente `attempts`. */
export function claimDue(pool: Pool, now: Date, limit: number): Promise<OutboxItem[]>
export function claimOne(pool: Pool, id: string, now: Date): Promise<OutboxItem | null>
export function markAccepted(pool: Pool, id: string, providerId: string, now: Date): Promise<void>
export function markRetry(pool: Pool, id: string, code: string, nextAt: Date): Promise<void>
/** Échec définitif ; `alertId` non nul : l'alerte est créée dans la même transaction. */
export function markFailed(pool: Pool, id: string, code: string, alertId: string | null): Promise<void>
export function listAccepted(pool: Pool, limit: number): Promise<AcceptedItem[]>
export function recordDelivery(pool: Pool, id: string, outcome: 'delivered' | 'undelivered', flags: string[], alertId: string | null, alertEvent: AlertEvent | null): Promise<void>
export function purgeOutbox(pool: Pool, before: Date): Promise<number>
```

Réservation sans course (une passe de la tâche et le premier essai peuvent tomber ensemble ; Vercel peut lancer la tâche deux fois) :

```sql
UPDATE outbox
   SET lease_until = $1::timestamptz + interval '2 minutes', attempts = attempts + 1
 WHERE id IN (
   SELECT id FROM outbox
    WHERE status = 'pending' AND next_attempt_at <= $1
      AND (lease_until IS NULL OR lease_until <= $1)
    ORDER BY next_attempt_at
    LIMIT $2
    FOR UPDATE SKIP LOCKED)
RETURNING id, template, request_id, priority, alert_event, alert_subject, attempts, created_at
```

`claimOne` : même requête, avec `id = $2` dans la sous-requête. `markAccepted`, `markRetry` et `markFailed` remettent `lease_until` à null. `last_error` ne reçoit qu'un code court (`http_503`, `timeout`, `network`, `http_400`).

- [ ] **Step 1 (TDD)** : `tests/integration/outbox-repository.test.ts`, à la suite du bloc schéma :
  - `enqueueNotification` dans une transaction annulée : aucune ligne ;
  - `claimDue` ne rend pas un message déjà réservé dont le bail court encore, et le rend une fois le bail échu ;
  - **deux `claimDue` lancés en même temps** (`Promise.all`, deux connexions) rendent des ensembles disjoints ;
  - `markRetry`, `markAccepted` : statut, `next_attempt_at`, `provider_id`, `accepted_at` ;
  - `markFailed(…, alertId)` crée l'alerte (`technical_alert`, `send_failed`, `alert_subject` = l'identifiant) dans la même transaction ; `markFailed(…, null)` n'en crée pas ;
  - `recordDelivery` ;
  - `purgeOutbox` n'efface que les lignes antérieures à la date ;
  - un identifiant non UUID lève `RangeError` avant toute requête ;
  - `VaultError` ne cite jamais de valeur.
- [ ] **Step 2** : implémenter. Exporter `guard` de `src/lib/vault/repository.ts` (seul changement de ce fichier).
- [ ] **Step 3** : tests verts. Commit « Écrire et réserver les messages de la boîte d'envoi (3.3) ».

### Task 5 : Configuration et transport Scaleway TEM

- [ ] **Step 1 (TDD)** : `tests/unit/email-config.test.ts`. `emailConfigFromEnv(env): EmailConfig | null` :
  - **null** si aucune des variables `TEM_SECRET_KEY`, `TEM_PROJECT_ID`, `EMAIL_FROM`, `EMAIL_NOTIFY_TO`, `EMAIL_ALERT_TO` n'est définie (envoi coupé) ;
  - lève `Configuration e-mail incomplète : <NOMS>` si une partie seulement l'est. Le message donne les noms, jamais les valeurs ;
  - `EMAIL_FROM` au format `Nom <adresse>` ou `adresse`, analysé en `{ email, name? }` ; adresses vérifiées avec le même schéma Zod que le formulaire ;
  - `TEM_PROJECT_ID` doit être un UUID ;
  - `SITE_URL` est obligatoire (lien du coffre).
- [ ] **Step 2 (TDD)** : `tests/unit/email-tem.test.ts`, avec un `fetch` factice injecté. `createTemTransport({ secretKey, projectId, fetch })` :
  - `send({ from, to, subject, text })` envoie `POST https://api.scaleway.com/transactional-email/v1alpha1/regions/fr-par/emails` avec `X-Auth-Token`, `Content-Type: application/json` et le corps `{ from, to: [{ email }], subject, text, project_id }` ;
  - 200 → `{ ok: true, providerId: emails[0].id }` ;
  - 429 et 5xx → `{ ok: false, retryable: true, code: 'http_<n>' }` ;
  - autre 4xx → `{ ok: false, retryable: false, code: 'http_<n>' }` ;
  - délai de 10 s (`AbortSignal.timeout`) → `{ retryable: true, code: 'timeout' }` ; erreur réseau → `'network'` ;
  - 200 sans `emails[0].id` → `{ retryable: false, code: 'bad_response' }` ;
  - **le corps de la réponse n'est jamais renvoyé ni journalisé** (test : une réponse qui contient une adresse ne la fait apparaître dans aucun résultat).
  - `status(providerId)` envoie `GET …/emails/{id}` et renvoie `{ state: 'pending' | 'delivered' | 'undelivered', flags: string[] }` :
    - `new` et `sending` → `pending` ;
    - `sent` → `delivered` ;
    - `failed` et `canceled` → `undelivered` ;
    - `unknown` → `pending` ;
    - seuls les flags de la liste fermée sont gardés.
- [ ] **Step 3** : implémenter `src/lib/email/config.ts` et `src/lib/email/tem.ts`. Le transport est une interface (`EmailTransport`) : un autre fournisseur reste possible (§6.6).
- [ ] **Step 4** : tests verts. Commit « Envoyer par l'API de Scaleway TEM, sans dépendance (3.3) ».

### Task 6 : Gabarits (interface interne, en français)

- [ ] **Step 1 (TDD)** : `tests/unit/email-templates.test.ts`.
  - `renderNotification({ requestId, priority, createdAt, siteUrl })` :
    - sujet `Nouvelle demande · Maison Triona`, ou `Nouvelle demande · Maison Triona · Prioritaire` ;
    - texte : « Une demande est arrivée le mercredi 18 novembre 2026 à 22 h 14. », une ligne vide, « Pour la lire, ouvrez le coffre : », puis `${siteUrl}/coffre/demandes/${requestId}`, une ligne vide, puis « Ce message ne contient rien de la demande. » ;
    - date en `Europe/Brussels`, avec `Intl.DateTimeFormat('fr-BE')`.
  - `renderAlert({ event, subjectId, createdAt })` : sujet `Alerte technique · Maison Triona` ; texte : l'événement en clair (« Échec de l'envoi après quatre essais », « Message non délivré », « Livraison non confirmée après 72 heures »), l'identifiant, la date, puis « Aucune donnée de demande dans ce message. ».
  - **Test de fuite** : une `Demande` factice remplie de témoins (« Hortense Fuite-Simulée », son e-mail, son téléphone, « grand-age », « BE ») passe par `splitRequest`, puis la notification est rendue. Aucun témoin n'apparaît dans le sujet ni dans le texte.
  - Un `siteUrl` qui n'est pas en `https` est refusé quand `VERCEL_ENV` vaut `production`.
- [ ] **Step 2** : implémenter `src/lib/email/templates.ts`. Ces textes sont **internes** (Cat, Sady) : constantes en français dans le module, hors de `messages/*.json` (comme le prévoit l'annexe B.4, « interface interne en français »), donc sans entrée dans `check:i18n`. Texte seul, sans HTML.
- [ ] **Step 3** : tests verts. Commit.

### Task 7 : Envoi d'un message et passe de la tâche planifiée

```ts
export interface OutboxDeps {
  pool: Pool
  transport: EmailTransport
  config: EmailConfig
  now: () => Date
  newId: () => string // crypto.randomUUID
  log: (status: string, id: string) => void
}
export function sendItem(deps: OutboxDeps, item: OutboxItem): Promise<'accepted' | 'retry' | 'failed'>
export function sendNow(deps: OutboxDeps, id: string): Promise<void> // claimOne puis sendItem
export function runOutbox(deps: OutboxDeps): Promise<{ sent: number; retried: number; failed: number; delivered: number; undelivered: number; purged: number }>
```

- `sendItem` :
  - choisit le destinataire selon le gabarit : `request_notification` → `EMAIL_NOTIFY_TO`, `technical_alert` → `EMAIL_ALERT_TO` ;
  - rend le gabarit, puis appelle `transport.send` ;
  - accepté → `markAccepted` ;
  - reprise possible et `nextAttemptAt` non nul → `markRetry` ;
  - sinon → `markFailed`, avec une alerte `send_failed`, **sauf si le message est lui-même une alerte** : jamais d'alerte sur une alerte ; on journalise alors `failed:alert`.
- `runOutbox` : `claimDue(now, 1)` puis `sendItem`, un message à la fois, 20 au plus, dans un **budget de 30 s** (la route a `maxDuration = 60` : le dernier envoi ou suivi commence avant 30 s). Ensuite le suivi : `listAccepted(20)` puis `transport.status` :
  - `delivered` → `recordDelivery` ;
  - `undelivered`, ou flag `hard_bounce`, `spam` ou `blocklisted` → `recordDelivery` avec une alerte `undelivered` (pas d'alerte pour une alerte) ;
  - toujours `pending` au-delà de 72 heures → `undelivered`, avec une alerte `tracking_expired`.
  - Enfin `purgeOutbox(purgeBefore(now))`.
- Journal : `[envoi] <statut> <outbox.id>`. Statuts possibles : `sent`, `retry`, `failed:provider`, `failed:alert`, `delivered`, `undelivered`, `purged`.

- [ ] **Step 1 (TDD)** : `tests/integration/outbox-process.test.ts`, avec un transport factice qui enregistre les appels :
  - succès au premier essai ;
  - 503 puis succès (`next_attempt_at` à +5 min, puis `accepted`) ;
  - quatre 503 → `failed`, puis une alerte créée, puis envoyée à la passe suivante, à `EMAIL_ALERT_TO` ;
  - 400 → `failed` dès le premier essai, avec une alerte ;
  - une alerte qui échoue définitivement ne crée pas d'alerte ;
  - suivi : `sent` → `delivered` ; `failed` avec `hard_bounce` → `undelivered` et une alerte ; `pending` à 72 h passées → `tracking_expired` ;
  - deux `runOutbox` en parallèle n'envoient chaque message qu'une fois ;
  - le journal ne contient ni adresse ni sujet.
- [ ] **Step 2** : implémenter `src/lib/outbox/process.ts`.
- [ ] **Step 3** : tests verts. Commit « Reprendre et suivre les envois de la boîte d'envoi (3.3) ».

### Task 8 : Brancher l'envoi sur la demande

- [ ] **Step 1 (TDD)** : `tests/integration/vault-store.test.ts`. `storeRequest(pool, demande, { …, notify: boolean })` renvoie `{ id, outbox: string[] }`.
  - Avec `notify: true`, la demande et sa notification sont écrites dans la même transaction (même `created_at`).
  - `priority` est vrai seulement si `urgence === 'urgent'`.
  - Si l'insertion dans `outbox` échoue (contrainte forcée par le test), **la demande est gardée seule** : retour au point de sauvegarde, `notifyFailed: true`, et la Server Action journalise `[demande] failed:outbox` (corrigé le 18/11/2026 : une notification impossible ne doit jamais faire perdre une demande).
  - Avec `notify: false`, aucune ligne dans `outbox`.
  - Le test de fuite existant couvre aussi `outbox` (toutes les colonnes de toutes les tables, relues en texte et en hexadécimal).
  - Adapter `tests/unit/vault-store.test.ts` au nouveau retour.
- [ ] **Step 2** : `src/lib/vault/store.ts` : les identifiants sont tirés par `crypto.randomUUID()`, comme pour la demande (le rôle `site_public` n'a pas `RETURNING`).
- [ ] **Step 3** : `src/actions/request.ts` :
  - lire `emailConfigFromEnv(process.env)` dans un `try` ;
  - configuration incomplète → `failed:config` une fois par instance, et `notify: false` : **la demande s'enregistre quand même** ;
  - `null` → `notify: false`, avec `mail:disabled` une fois par instance ;
  - une fois la demande écrite, `after(() => sendNow(deps, id))` pour chaque identifiant de `outbox`, **avant** `redirect(merci)`. Tout est déjà en base : si `after` n'aboutit pas, la tâche planifiée reprend le message ;
  - compléter le commentaire de tête (étape 7) et la liste des statuts (`queued`).
- [ ] **Step 4** : la story prévoit une page de confirmation avec le « K. » de 64 px. `/contact/merci` (livrée en 3.2 B) ne l'a pas encore : ajouter `<Stamp size="lg" />` (`src/components/ui/Stamp.tsx`, taille prévue « confirmation ») sous le texte, à la place du filet de tête ou après lui, selon l'avis de l'agent `art-director`. Capture à 1440, 834 et 390 px.
- [ ] **Step 5** : `npm run test:unit && npm run test:integration && npm run test:e2e` : le formulaire marche toujours sans configuration e-mail (cas de la CI). Commit « Prévenir Cat à chaque demande, dans la transaction du coffre (3.3) ».

### Task 9 : Tâche planifiée

- [ ] **Step 1 (TDD)** : `tests/unit/cron-auth.test.ts`. `cronAutorise(header, secret)` (à l'intégration de `main`, remplacés par `autorisationCron(header, env)` et `tests/unit/cron-secret.test.ts` de la 3.2 D, communs aux deux tâches planifiées) :
  - vrai seulement pour `Bearer <secret>` exact (empreintes SHA-256 comparées par `timingSafeEqual`) ;
  - faux si le secret manque, fait moins de 32 caractères ou contient une espace ;
  - faux pour un en-tête absent, sans `Bearer`, ou avec un autre secret.
- [ ] **Step 2** : `src/lib/security/cron.ts`, puis `src/app/api/cron/envoi/route.ts` :
  ```ts
  export const dynamic = 'force-dynamic'
  export const maxDuration = 60
  export async function GET(request: Request): Promise<Response>
  ```
  - en-tête refusé → 401 sans corps ;
  - configuration e-mail nulle → 204 ;
  - configuration incomplète → `failed:config` et 503 ;
  - sinon `runOutbox`, avec le pool `getEnvoiPool()`, et réponse `Response.json(bilan)` : des nombres seulement.
- [ ] **Step 3** : `vercel.json` :
  ```json
  { "crons": [{ "path": "/api/cron/envoi", "schedule": "*/5 * * * *" }] }
  ```
- [ ] **Step 4** : `scripts/check-third-party.mjs` lit tout `src/`, donc l'URL de TEM le ferait échouer. Ajouter une exception **limitée au fichier** :
  ```js
  // Appels de serveur à serveur (jamais depuis le navigateur) : autorisés dans ce fichier seulement.
  const SERVER_ONLY = { 'src/lib/email/tem.ts': ['https://api.scaleway.com/'] }
  ```
  Dans `scan`, une URL qui commence par un de ces préfixes est acceptée si `rel(file)` est la clé. Ajouter un test au script, ou un cas dans `tests/unit/`, pour vérifier que la même URL ailleurs dans `src/` échoue toujours.
- [ ] **Step 5** : `npm run build`, puis vérifier :
  - `/api/cron/envoi` est dynamique (`ƒ`) ;
  - `/fr/contact` et `/en/contact` restent prérendues (`○`) ;
  - `npm run check:third-party` passe.

  Commit « Reprendre les envois par une tâche planifiée Vercel (3.3) ».

### Task 10 : Documentation et RGPD

- [ ] `.env.example` : ajouter
  - `ENVOI_DATABASE_URL` (rôle `envoi`, différente des deux autres) ;
  - `TEM_SECRET_KEY`, avec les jeux de permissions `TransactionalEmailEmailApiCreate` et `TransactionalEmailEmailReadOnly`, sur ce projet seulement ;
  - `TEM_PROJECT_ID`, `EMAIL_FROM`, `EMAIL_NOTIFY_TO`, `EMAIL_ALERT_TO`, `CRON_SECRET` ;
  - pour chacune, ce qu'elle fait, et le fait que l'envoi est coupé tant qu'elles sont vides.
- [ ] `docs/architecture.md` :
  - §6.6 : livré en 3.3 A, sans la confirmation au visiteur (si la décision 1 est suivie) ;
  - §6.7 : « webhook e-mail vérifié par signature » est remplacé par l'interrogation du statut (décision 2) ;
  - §1 : TEM `v1alpha1`, aucune dépendance ;
  - §10 : `vercel.json`.
- [ ] `docs/email-deliverability.md` :
  - §1 : la notification ne porte **ni service, ni pays, ni langue** (D06 ; le tableau actuel contredit la décision) ;
  - §2 : valeurs SPF, DMARC et MX vérifiées ;
  - §3 : délais 5 min, 30 min, 2 h ;
  - §4 : suivi par interrogation, listes de blocage de TEM (une semaine, un mois, puis sans fin), aucun événement « plainte » ;
  - ajouter la conservation des métadonnées par TEM.
- [ ] `docs/privacy.md`, `docs/rgpd/registre-des-traitements.md` (T1 : destinataires, conservation) et `docs/rgpd/sous-traitants.md` (TEM) :
  - **TEM garde l'adresse de Cat, celle de Sady et le sujet tant que le domaine est actif** ;
  - aucune adresse de visiteur ne sort du coffre en 3.3 A ;
  - boîte d'envoi effacée après 30 jours.
- [ ] `docs/coffre-cles.md` §3 : créer le compte de l'envoi et lui donner le rôle `envoi`, comme pour les deux autres comptes.
- [ ] `docs/plan-implementation.md` (lot E), `README.md` (variables, tâche planifiée), `CLAUDE.md` (phase en cours) ; décisions 1 à 5 dans `docs/decisions.md`.
- [ ] Commit « Documenter l'envoi des e-mails (3.3) ».

### Task 11 : Relectures et fusion

- [ ] Agent `security-privacy-reviewer` sur le diff : rôles, journaux, secrets, route de la tâche planifiée, absence de données dans les e-mails. Appliquer, puis commit « Appliquer la relecture sécurité de l'envoi (3.3) ».
- [ ] `npm run lint && npm run typecheck && npm run format:check && npm run test:unit && npm run test:integration && npm run build && npm run check:i18n && npm run check:third-party`.
- [ ] PR vers `main` ; fusion quand la CI est verte (D22). Le point d'arrêt reste « ④ complet », après la réservation d'appel.

---

## À faire par Sady (console Scaleway, DNS, Vercel), avant la production

1. **TEM** : ajouter le domaine d'envoi `mail.maisontriona.com` (sous-domaine dédié, `email-deliverability.md` §2). Publier ensuite :
   - le SPF `v=spf1 include:_spf.tem.scaleway.com -all` ;
   - le DKIM donné par la console ;
   - le DMARC `p=none` avec une adresse de rapports ;
   - le MX : le nôtre, ou `blackhole.tem.scaleway.com.`

   Attendre l'état `checked`, jusqu'à 48 heures. Vérifier que le suivi des ouvertures et des clics est coupé.
2. **IAM** : une application « site » avec une clé d'API limitée à `TransactionalEmailEmailApiCreate` et `TransactionalEmailEmailReadOnly`, sur le projet de la maison seulement. Pas de restriction par IP : les IP de sortie de Vercel ne sont pas fixes.
3. **Base** : créer le compte de l'envoi, appliquer `db/roles/envoi.sql`, puis relancer `db/roles/site_public.sql` après `npm run db:migrate`.
4. **Vercel (production)** : renseigner les variables du §Task 10 et `CRON_SECRET` (32 caractères au moins, sans espace : `openssl rand -hex 32` ; sans lui, le build de production échoue dès que `TEM_SECRET_KEY` est posée), puis redéployer. Le secret est figé au build. Les tâches planifiées ne tournent que sur la production.
5. **Adresses** : celle qui reçoit les notifications de Cat tant que les boîtes du domaine ne sont pas choisies (`reservation-appel.md` §9, question 6), et l'adresse d'alerte de Sady.
6. **Tests de réception** (`email-deliverability.md` §5) avec des demandes factices, une fois le domaine `checked`.

## Partie B (si la décision 1 est « oui ») : confirmation au visiteur

Seulement après l'accord de Cat, en connaissant les limites (métadonnées gardées par TEM, boîte partagée). Plan à écrire à ce moment-là. Points déjà tranchés par la recherche :
- **Chiffrement par enveloppe avec Key Manager**, comme le recommande Scaleway (le chiffrement direct est déconseillé) :
  - `POST /key-manager/v1alpha1/regions/fr-par/keys/{id}/generate-data-key` (`aes_256_gcm`) donne une clé de données par adresse ;
  - AES-256-GCM en Node, avec `outbox.id` comme données associées ;
  - la clé de données chiffrée est stockée avec le chiffré ;
  - `decrypt` au moment de l'envoi, puis tout est effacé dès l'acceptation ou l'abandon (contrainte SQL) ;
  - droits `KeyManagerKeyEncrypt` et `KeyManagerKeyDecrypt`, limités à la clé (`resource.id == "<key_id>"`) ;
  - environ 0,06 € par version de clé et par mois, plus 0,03 € les 10 000 opérations.
- La même brique sert à la réservation d'appel (3.9 à 3.12, D57). Si la partie B n'est pas faite, Key Manager arrive avec la 3.9.
- Textes FR/EN (annexe B.4) dans `messages/*.json`, listés dans `content/brouillons.json` jusqu'à la validation de Cat. HTML sobre, toujours accompagné du texte. `Reply-To` de Cat.
