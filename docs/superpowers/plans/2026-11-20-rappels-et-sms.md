# Rappels et SMS (story 3.12, suite) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** une personne qui a réservé un appel reçoit un e-mail de rappel la veille et, si elle a coché la case, un SMS de confirmation puis un SMS deux heures avant. Ses coordonnées sont effacées après le dernier message.

**Architecture :** une **clé serveur** (Scaleway Key Manager, chiffrement direct `encrypt` / `decrypt` lié à l'identifiant par `associated_data`) garde l'e-mail entre la demande de lien (3.9) et la réservation (3.10), puis l'e-mail, le numéro et la langue de la réservation (`contact_kms`) jusqu'à 24 heures après l'appel. La **boîte d'envoi** de la 3.3 reçoit trois gabarits programmés (`next_attempt_at` dans le futur) qui ne portent qu'un `booking_id`. Le rôle `envoi` déchiffre `contact_kms` au moment de l'envoi ; si elle est effacée, ou si l'appel n'est plus confirmé, le message est abandonné sans alerte.

**Tech Stack :** Next.js 16, PostgreSQL 17, `pg`, Scaleway Key Manager `v1alpha1` (`fr-par`) en `fetch`, Scaleway TEM (déjà là), seven (transport livré, PR n° 88), Node 24 (`node --test`), TypeScript strict. **Aucune nouvelle dépendance.**

**Références :** `docs/reservation-appel.md` §2, §4.1, §4.5, §7 ; `docs/architecture.md` §6.3, §6.5, §6.6 ; `docs/sms-fournisseur.md` ; `docs/privacy.md` ; `docs/rgpd/` ; plan de la 3.3 (`2026-11-18-envoi-des-emails.md`) ; décisions D06, D57, D69, D71.

**Règles non négociables :**
- La boîte d'envoi ne contient **aucune coordonnée** : un gabarit, un `booking_id`, une date d'envoi.
- `contact_kms` et `email_kms` ne sont lisibles que par le serveur (Key Manager), jamais écrits en clair en base ni dans un journal. Ils sont **effacés** après le dernier message (fin de l'appel + 24 h), à l'annulation et au déplacement, et `email_kms` dès que le lien est consommé ou expiré.
- **SMS** : 145 unités GSM-7 au plus, sans lien, sans service nommé (`templates.ts` le garantit déjà). Un SMS en échec n'empêche jamais l'e-mail.
- Aucune donnée réelle dans les tests ; le Key Manager est remplacé par un double local dans les tests unitaires et d'intégration.

---

## Avant de commencer

1. **La 3.11 (déplacer et annuler) est fusionnée** dans `main` (session `maison-triona-bd`, migration `0014`). Elle touche `src/lib/booking/*`, `src/actions/booking*.ts` et les pages d'appel, que ce plan modifie aussi. Partir d'un `main` à jour.
2. **Migration réservée : `0015_rappels.sql`** (0012 : PR n° 84 ; 0013 : agenda ; 0014 : 3.11). Revérifier avec `git ls-tree origin/main db/migrations/` et les autres sessions.
3. **Décisions de Sady** (§ suivant) tranchées et consignées dans `docs/decisions.md` au prochain numéro libre.
4. Pour la production seulement : §« À faire par Sady ».

## Décisions à confirmer (Sady)

| N° | Question | Recommandation |
|---|---|---|
| 1 | **Clé serveur** : Scaleway Key Manager (déjà prévu par la spec §4.1), en **chiffrement direct** (`encrypt` / `decrypt`, une requête par message) plutôt qu'en enveloppe locale (`generate-data-key` + AES-GCM dans Node) | **Chiffrement direct** : moins de code cryptographique à nous, la clé ne sort jamais de Scaleway, `associated_data` lie chaque texte chiffré à sa ligne. Volume minuscule (quelques appels par jour). Écart avec le mot « enveloppe » de la spec §4.1, à noter. |
| 2 | **Heure de l'e-mail de la veille** | **La veille à 17 h, heure de Bruxelles.** Si la réservation est faite après cette heure-là (appel le lendemain ou le jour même), pas d'e-mail de veille : la page de confirmation et le fichier .ics suffisent. |
| 3 | **SMS de confirmation** juste après la réservation (gabarit `confirmation` déjà écrit) | **Oui**, si la case est cochée : il prouve que le numéro est le bon avant le rappel. |
| 4 | **Suivi de livraison des SMS** (webhook signé de seven ou rien) | **Rien pour l'instant** : l'accusé d'acceptation de seven suffit ; un SMS non remis ne bloque rien (l'e-mail part de toute façon). À revoir après les questions à seven (`docs/sms-fournisseur.md` §9). |
| 5 | **E-mail de confirmation de la réservation** avec l'invitation (`METHOD:REQUEST`) | **Hors de ce plan** (story à part, 3.12 C) : il demande les invitations par e-mail et leur `SEQUENCE` (3.11). Ce plan ne fait que les rappels. |
| 6 | **STOP en Belgique** (réponse au numéro court) | Rien d'automatique tant que seven n'a pas répondu (question 5). La personne ne peut pas retirer son choix après coup sur le site : noter ce risque dans `docs/privacy.md`, et le traiter avec la réponse de seven (abandon du rappel si seven signale le STOP). |

## Faits vérifiés (20/11/2026)

**Scaleway Key Manager**, lu dans le SDK officiel généré (`github.com/scaleway/scaleway-sdk-js`, `packages_generated/key_manager/src/v1alpha1/{api,types,marshalling}.gen.ts`, dernier commit du 20/10/2026). La documentation web (`scaleway.com/en/developers/api/key-manager/`) refuse les lectures automatiques (HTTP 403) : **la relire dans un navigateur avant de figer le code** (règle d'or n° 4).
- Base : `https://api.scaleway.com`, en-tête `X-Auth-Token: <clé secrète IAM>` (même schéma que TEM, `src/lib/email/tem.ts`).
- `POST /key-manager/v1alpha1/regions/fr-par/keys/{key_id}/encrypt`, corps `{ "plaintext": …, "associated_data": … }`, réponse `{ "key_id", "ciphertext" }`. Texte clair de 1 à 65 535 octets ; `associated_data` seulement pour une clé `symmetric_encryption`.
- `POST …/keys/{key_id}/decrypt`, corps `{ "ciphertext": …, "associated_data": … }`, réponse `{ "key_id", "plaintext", "ciphertext"? }` (le `ciphertext` de la réponse n'est rempli que si la clé a tourné depuis : re-chiffrement offert).
- `POST …/keys/{key_id}/generate-data-key` (`algorithm: aes_256_gcm`, `without_plaintext`) existe ; non utilisé (décision 1).
- Clé : usage `symmetric_encryption`, algorithme `aes_256_gcm` ; rotation (`rotate`), protection contre la suppression (`protect`), désactivation (`disable`).
- `[À VÉRIFIER au premier appel réel]` : `plaintext`, `ciphertext` et `associated_data` sont des champs `bytes` du protobuf de Scaleway, donc **encodés en base64** en JSON (convention protobuf) ; le SDK les type `string`. Le test d'intégration réel (Task 9) le confirme avant la production.
- `[À VÉRIFIER]` : tarif par clé et par requête, limites de débit (page de tarifs inaccessible au robot).

**Code existant (main du 20/11/2026)**
- Boîte d'envoi : `outbox` (0006, 0011), rôles `site_public` (insertion de colonnes listées), `envoi` (tout), `coffre` (lecture de colonnes listées) ; `claimDue`, `sendItem`, `markFailed(pool, id, code, alertId)`, `nextAttemptAt` ; gabarit `booking_access` déjà abandonné en `no_contact`.
- SMS : `renderBookingSms({ kind: 'confirmation' | 'reminder', locale, startsAt })`, `createSevenTransport({ apiKey })`, `readSmsConfig(env)` (`SEVEN_API_KEY`, `SMS_SENDER`).
- Case SMS : `src/lib/booking/options.ts` (`BOOKING_SMS_OPT_IN`) ; choix scellé dans `bookings.sealed` (`src/lib/vault/seal.ts`), donc illisible pour le serveur : la 3.12 le recopie dans `contact_kms`.
- E-mail de la 3.9 : l'adresse n'est gardée nulle part (`booking_tokens.email_hmac` seulement).

## Fichiers

| Fichier | Rôle |
|---|---|
| `db/migrations/0015_rappels.sql` | `booking_tokens.email_kms`, `bookings.contact_kms`, `outbox.booking_id`, trois gabarits, contraintes, journal |
| `db/roles/site_public.sql`, `db/roles/envoi.sql`, `db/roles/coffre.sql` | Droits par colonne (aucune lecture de `*_kms` par `site_public` ni par `coffre`) |
| `src/lib/kms/config.ts` | `KMS_KEY_ID`, `KMS_SECRET_KEY` |
| `src/lib/kms/scaleway.ts` | Client `encrypt` / `decrypt`, interface `ServerKey` |
| `src/lib/kms/memory.ts` | Double local pour les tests (AES-256-GCM de Node, clé aléatoire) |
| `src/lib/booking/contact.ts` | Sérialisation bornée de `{ email, phone, locale }`, chiffrement lié à l'identifiant |
| `src/lib/booking/reminders.ts` | Fonction pure : quels messages, à quelle heure |
| `src/lib/email/booking-reminder.ts` | Gabarit de l'e-mail de la veille FR/EN |
| `src/lib/outbox/repository.ts` | `enqueueBookingMessages`, lecture de `contact_kms` |
| `src/lib/outbox/process.ts`, `src/lib/outbox/deps.ts` | Envoi des trois gabarits, transport SMS |
| `src/actions/booking-link.ts` | 3.9 : garder `email_kms` sur le jeton |
| `src/actions/booking.ts` | 3.10 : écrire `contact_kms` et les messages dans la transaction |
| `src/lib/retention/*` (tâche `/api/cron/retention`) | Effacement de `contact_kms` et `email_kms` |
| `tests/unit/kms-*.test.ts`, `tests/unit/booking-contact.test.ts`, `tests/unit/booking-reminders.test.ts`, `tests/unit/email-booking-reminder.test.ts`, `tests/unit/outbox-booking.test.ts` | Tests unitaires |
| `tests/integration/rappels.test.ts` | Migration, droits, effacement |

---

### Task 1 : Configuration et client Key Manager

**Files :** Create `src/lib/kms/config.ts`, `src/lib/kms/scaleway.ts`, `src/lib/kms/memory.ts` ; Test `tests/unit/kms-scaleway.test.ts`

- [ ] **Step 1 : écrire les tests qui échouent** (`fetch` simulé, comme `tests/unit/sms-seven.test.ts`)

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { createScalewayKey } from '../../src/lib/kms/scaleway.ts'
import { readKmsConfig } from '../../src/lib/kms/config.ts'

const KEY_ID = '11111111-2222-4333-8444-555555555555'

function fakeFetch(handler: (url: string, body: Record<string, string>) => Response) {
  const calls: { url: string; headers: Headers; body: Record<string, string> }[] = []
  const impl = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, string>
    calls.push({ url, headers: new Headers(init.headers), body })
    return handler(url, body)
  }) as unknown as typeof fetch
  return { impl, calls }
}

test('encrypt envoie le texte et la donnée associée en base64, avec la clé secrète', async () => {
  const { impl, calls } = fakeFetch(() => Response.json({ key_id: KEY_ID, ciphertext: 'Y2lwaGVy' }))
  const key = createScalewayKey({ keyId: KEY_ID, secretKey: 'secret', fetch: impl })
  const out = await key.encrypt('bonjour', 'contact:abc')
  assert.equal(out, 'Y2lwaGVy')
  assert.equal(
    calls[0]!.url,
    `https://api.scaleway.com/key-manager/v1alpha1/regions/fr-par/keys/${KEY_ID}/encrypt`,
  )
  assert.equal(calls[0]!.headers.get('X-Auth-Token'), 'secret')
  assert.equal(Buffer.from(calls[0]!.body.plaintext!, 'base64').toString('utf8'), 'bonjour')
  assert.equal(Buffer.from(calls[0]!.body.associated_data!, 'base64').toString('utf8'), 'contact:abc')
})

test('decrypt rend le texte clair décodé', async () => {
  const { impl } = fakeFetch(() =>
    Response.json({ key_id: KEY_ID, plaintext: Buffer.from('bonjour').toString('base64') }),
  )
  const key = createScalewayKey({ keyId: KEY_ID, secretKey: 'secret', fetch: impl })
  assert.equal(await key.decrypt('Y2lwaGVy', 'contact:abc'), 'bonjour')
})

test('une réponse en erreur lève une erreur sans contenu de la réponse', async () => {
  const { impl } = fakeFetch(() => new Response('{"message":"secret leak"}', { status: 403 }))
  const key = createScalewayKey({ keyId: KEY_ID, secretKey: 'secret', fetch: impl })
  await assert.rejects(key.decrypt('Y2lwaGVy', 'contact:abc'), (error: Error) => {
    assert.equal(error.message, 'kms_http_403')
    return true
  })
})

test('la configuration est absente, complète ou refusée', () => {
  assert.equal(readKmsConfig({}), null)
  assert.deepEqual(readKmsConfig({ KMS_KEY_ID: KEY_ID, KMS_SECRET_KEY: 'secret' }), {
    keyId: KEY_ID,
    secretKey: 'secret',
  })
  assert.throws(() => readKmsConfig({ KMS_KEY_ID: KEY_ID }), /KMS_SECRET_KEY/)
  assert.throws(() => readKmsConfig({ KMS_KEY_ID: 'pas-un-uuid', KMS_SECRET_KEY: 'x' }), /KMS_KEY_ID/)
})
```

- [ ] **Step 2 : lancer** `npm run test:unit` — attendu : échec (`Cannot find module …/kms/scaleway.ts`).

- [ ] **Step 3 : écrire `src/lib/kms/config.ts`**

```ts
// Configuration de la clé serveur (story 3.12, docs/reservation-appel.md §4.1) : Scaleway Key
// Manager. Absente : aucun rappel ne se programme (les réservations restent possibles).
// Clé IAM dédiée, limitée au Key Manager (jamais celle de TEM).
export interface KmsConfig {
  keyId: string
  secretKey: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SECRET = /^[\x21-\x7E]+$/

export function readKmsConfig(env: Record<string, string | undefined>): KmsConfig | null {
  const keyId = env.KMS_KEY_ID?.trim() || undefined
  const secretKey = env.KMS_SECRET_KEY?.trim() || undefined
  if (keyId === undefined && secretKey === undefined) return null
  if (keyId === undefined) throw new Error('Configuration de la clé serveur incomplète : KMS_KEY_ID manquante.')
  if (secretKey === undefined) {
    throw new Error('Configuration de la clé serveur incomplète : KMS_SECRET_KEY manquante.')
  }
  if (!UUID.test(keyId)) throw new Error('Valeur invalide : KMS_KEY_ID')
  if (!SECRET.test(secretKey)) throw new Error('Valeur invalide : KMS_SECRET_KEY')
  return { keyId, secretKey }
}
```

- [ ] **Step 4 : écrire `src/lib/kms/scaleway.ts`**

```ts
// Clé serveur par Scaleway Key Manager v1alpha1, chiffrement direct (story 3.12, décision 1).
// Faits vérifiés le 20/11/2026 dans le SDK généré (plan 2026-11-20-rappels-et-sms.md).
// `associated_data` lie chaque texte chiffré à sa ligne : un `contact_kms` recopié sur une autre
// réservation ne se déchiffre pas. Aucune journalisation ; une erreur ne porte qu'un code court.
// Imports relatifs seulement : testé par node --test.
export interface ServerKey {
  encrypt(plaintext: string, associatedData: string): Promise<string>
  decrypt(ciphertext: string, associatedData: string): Promise<string>
}

const BASE = 'https://api.scaleway.com/key-manager/v1alpha1/regions/fr-par/keys'
const TIMEOUT_MS = 10_000
const B64 = /^[A-Za-z0-9+/]+={0,2}$/

const toB64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')

export function createScalewayKey(options: {
  keyId: string
  secretKey: string
  fetch?: typeof fetch
}): ServerKey {
  const fetchImpl = options.fetch ?? fetch

  async function call(action: 'encrypt' | 'decrypt', body: Record<string, string>) {
    let response: Response
    try {
      response = await fetchImpl(`${BASE}/${options.keyId}/${action}`, {
        method: 'POST',
        headers: { 'X-Auth-Token': options.secretKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new Error('kms_network')
    }
    if (!response.ok) throw new Error(`kms_http_${response.status}`)
    const data = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (data === null) throw new Error('kms_body')
    return data
  }

  return {
    async encrypt(plaintext, associatedData) {
      const data = await call('encrypt', {
        plaintext: toB64(plaintext),
        associated_data: toB64(associatedData),
      })
      const ciphertext = data.ciphertext
      if (typeof ciphertext !== 'string' || !B64.test(ciphertext)) throw new Error('kms_body')
      return ciphertext
    },
    async decrypt(ciphertext, associatedData) {
      const data = await call('decrypt', { ciphertext, associated_data: toB64(associatedData) })
      const plaintext = data.plaintext
      if (typeof plaintext !== 'string' || !B64.test(plaintext)) throw new Error('kms_body')
      return Buffer.from(plaintext, 'base64').toString('utf8')
    },
  }
}
```

- [ ] **Step 5 : écrire `src/lib/kms/memory.ts`** (double pour les tests unitaires et d'intégration, jamais chargé en production)

```ts
// Double local de la clé serveur (tests seulement) : AES-256-GCM de Node, clé aléatoire par
// instance, donnée associée vérifiée comme chez Scaleway.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { ServerKey } from './scaleway.ts'

export function createMemoryKey(): ServerKey {
  const key = randomBytes(32)
  return {
    async encrypt(plaintext, associatedData) {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', key, iv)
      cipher.setAAD(Buffer.from(associatedData, 'utf8'))
      const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
      return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
    },
    async decrypt(ciphertext, associatedData) {
      const raw = Buffer.from(ciphertext, 'base64')
      const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12))
      decipher.setAAD(Buffer.from(associatedData, 'utf8'))
      decipher.setAuthTag(raw.subarray(12, 28))
      return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
    },
  }
}
```

- [ ] **Step 6 : lancer** `npm run test:unit` — attendu : PASS. Puis `npm run lint && npm run typecheck`.
- [ ] **Step 7 : ajouter `https://api.scaleway.com/` pour `src/lib/kms/scaleway.ts`** dans `SERVER_ONLY` de `scripts/check-third-party.mjs` ; `npm run check:third-party` vert.
- [ ] **Step 8 : commit** — `git add src/lib/kms tests/unit/kms-scaleway.test.ts scripts/check-third-party.mjs && git commit -m "Ajouter la clé serveur Scaleway Key Manager (3.12)"`

### Task 2 : Coordonnées d'un appel, chiffrées et liées à leur ligne

**Files :** Create `src/lib/booking/contact.ts` ; Test `tests/unit/booking-contact.test.ts`

- [ ] **Step 1 : tests qui échouent**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { createMemoryKey } from '../../src/lib/kms/memory.ts'
import {
  openBookingContact,
  openLinkEmail,
  sealBookingContact,
  sealLinkEmail,
} from '../../src/lib/booking/contact.ts'

const BOOKING = '0b3f6f1e-9a1c-4c7e-8d2a-1f2e3d4c5b6a'
const OTHER = '9b3f6f1e-9a1c-4c7e-8d2a-1f2e3d4c5b6a'

test('aller-retour des coordonnées d’un appel', async () => {
  const key = createMemoryKey()
  const sealed = await sealBookingContact(key, BOOKING, {
    email: 'personne@example.org',
    phone: '+32470000000',
    locale: 'fr',
  })
  assert.deepEqual(await openBookingContact(key, BOOKING, sealed), {
    email: 'personne@example.org',
    phone: '+32470000000',
    locale: 'fr',
  })
})

test('un texte chiffré recopié sur une autre réservation ne s’ouvre pas', async () => {
  const key = createMemoryKey()
  const sealed = await sealBookingContact(key, BOOKING, {
    email: 'personne@example.org',
    phone: null,
    locale: 'en',
  })
  await assert.rejects(openBookingContact(key, OTHER, sealed))
})

test('les valeurs hors bornes sont refusées avant tout chiffrement', async () => {
  const key = createMemoryKey()
  await assert.rejects(
    sealBookingContact(key, BOOKING, { email: 'x'.repeat(255), phone: null, locale: 'fr' }),
    RangeError,
  )
  await assert.rejects(
    sealBookingContact(key, BOOKING, { email: 'a@b.c', phone: '0470', locale: 'fr' }),
    RangeError,
  )
})

test('e-mail d’un lien : lié à l’identifiant du jeton', async () => {
  const key = createMemoryKey()
  const sealed = await sealLinkEmail(key, BOOKING, 'personne@example.org')
  assert.equal(await openLinkEmail(key, BOOKING, sealed), 'personne@example.org')
  await assert.rejects(openLinkEmail(key, OTHER, sealed))
})
```

- [ ] **Step 2 : lancer** — attendu : échec (module absent).

- [ ] **Step 3 : implémenter `src/lib/booking/contact.ts`**

```ts
// Coordonnées d'un appel chiffrées par la clé serveur (story 3.12, spec §4.1) : l'e-mail, le
// numéro si la personne a choisi le SMS, la langue. Liées à leur ligne par la donnée associée
// (`booking-contact:<id>`, `link-email:<id>`). Bornes vérifiées avant tout appel au Key Manager.
// Imports relatifs seulement : testé par node --test.
import type { ServerKey } from '../kms/scaleway.ts'

export interface BookingContact {
  email: string
  phone: string | null
  locale: 'fr' | 'en'
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const E164 = /^\+[1-9]\d{6,14}$/
const EMAIL_MAX = 254

function assertId(id: string): void {
  if (!UUID.test(id)) throw new RangeError('Identifiant invalide')
}

function assertEmail(email: string): void {
  if (typeof email !== 'string' || email.length < 3 || email.length > EMAIL_MAX || !email.includes('@')) {
    throw new RangeError('Adresse invalide')
  }
}

function assertContact(contact: BookingContact): void {
  assertEmail(contact.email)
  if (contact.phone !== null && !E164.test(contact.phone)) throw new RangeError('Numéro invalide')
  if (contact.locale !== 'fr' && contact.locale !== 'en') throw new RangeError('Langue invalide')
}

export async function sealBookingContact(
  key: ServerKey,
  bookingId: string,
  contact: BookingContact,
): Promise<string> {
  assertId(bookingId)
  assertContact(contact)
  const payload = JSON.stringify({ e: contact.email, p: contact.phone, l: contact.locale })
  return key.encrypt(payload, `booking-contact:${bookingId}`)
}

export async function openBookingContact(
  key: ServerKey,
  bookingId: string,
  sealed: string,
): Promise<BookingContact> {
  assertId(bookingId)
  const raw = JSON.parse(await key.decrypt(sealed, `booking-contact:${bookingId}`)) as {
    e: unknown
    p: unknown
    l: unknown
  }
  const contact = {
    email: raw.e,
    phone: raw.p,
    locale: raw.l,
  } as BookingContact
  assertContact(contact)
  return contact
}

export async function sealLinkEmail(key: ServerKey, tokenId: string, email: string): Promise<string> {
  assertId(tokenId)
  assertEmail(email)
  return key.encrypt(email, `link-email:${tokenId}`)
}

export async function openLinkEmail(key: ServerKey, tokenId: string, sealed: string): Promise<string> {
  assertId(tokenId)
  const email = await key.decrypt(sealed, `link-email:${tokenId}`)
  assertEmail(email)
  return email
}
```

- [ ] **Step 4 : lancer** `npm run test:unit` — PASS.
- [ ] **Step 5 : commit** — `git commit -m "Chiffrer les coordonnées d'un appel avec la clé serveur (3.12)"`

### Task 3 : Quels rappels, à quelle heure (pur)

**Files :** Create `src/lib/booking/reminders.ts` ; Test `tests/unit/booking-reminders.test.ts`

Règles (décisions 2 et 3) : e-mail la veille à 17 h (Bruxelles) s'il est encore à venir ; SMS de confirmation tout de suite si la case est cochée ; SMS de rappel deux heures avant si la case est cochée et s'il est encore à venir. Une réservation faite moins de deux heures avant l'appel ne reçoit que la confirmation.

- [ ] **Step 1 : tests qui échouent** (heures d'été et d'hiver)

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { planReminders } from '../../src/lib/booking/reminders.ts'

test('appel mardi 24/11 à 10 h 30 (hiver), réservé le samedi : trois messages', () => {
  const startsAt = new Date('2026-11-24T09:30:00Z')
  const now = new Date('2026-11-21T12:00:00Z')
  assert.deepEqual(planReminders({ startsAt, now, sms: true }), [
    { template: 'booking_sms_confirmation', sendAt: now },
    { template: 'booking_reminder_email', sendAt: new Date('2026-11-23T16:00:00Z') },
    { template: 'booking_sms_reminder', sendAt: new Date('2026-11-24T07:30:00Z') },
  ])
})

test('sans SMS : l’e-mail de la veille seulement', () => {
  const plan = planReminders({
    startsAt: new Date('2026-11-24T09:30:00Z'),
    now: new Date('2026-11-21T12:00:00Z'),
    sms: false,
  })
  assert.deepEqual(plan.map((p) => p.template), ['booking_reminder_email'])
})

test('heure d’été : la veille à 17 h de Bruxelles vaut 15 h UTC', () => {
  const plan = planReminders({
    startsAt: new Date('2027-06-15T08:00:00Z'),
    now: new Date('2027-06-01T08:00:00Z'),
    sms: false,
  })
  assert.deepEqual(plan[0], {
    template: 'booking_reminder_email',
    sendAt: new Date('2027-06-14T15:00:00Z'),
  })
})

test('réservé après 17 h la veille : pas d’e-mail de veille, SMS deux heures avant', () => {
  const plan = planReminders({
    startsAt: new Date('2026-11-24T09:30:00Z'),
    now: new Date('2026-11-23T18:00:00Z'),
    sms: true,
  })
  assert.deepEqual(plan.map((p) => p.template), ['booking_sms_confirmation', 'booking_sms_reminder'])
})

test('réservé moins de deux heures avant : la confirmation seule', () => {
  const plan = planReminders({
    startsAt: new Date('2026-11-24T09:30:00Z'),
    now: new Date('2026-11-24T08:00:00Z'),
    sms: true,
  })
  assert.deepEqual(plan.map((p) => p.template), ['booking_sms_confirmation'])
})
```

- [ ] **Step 2 : lancer** — échec attendu.

- [ ] **Step 3 : implémenter `src/lib/booking/reminders.ts`** avec les fonctions de fuseau existantes de `src/lib/booking/zoned-time.ts` (vérifiées le 20/11/2026 : `zonedParts(instant, zone)` rend `{ date, time }` locaux, `zonedTimeToUtc(date, time, zone)` rend l'instant, `addDays(date, n)` décale une date `AAAA-MM-JJ`).

```ts
// Messages programmés d'un appel (story 3.12, décisions 2 et 3 du plan) : e-mail la veille à 17 h
// (heure de Bruxelles), SMS de confirmation tout de suite et SMS deux heures avant si la personne
// l'a choisi. Un message dont l'heure est passée n'est pas programmé. Fonction pure.
import { addDays, zonedParts, zonedTimeToUtc } from './zoned-time.ts'

export type ReminderTemplate =
  | 'booking_reminder_email'
  | 'booking_sms_confirmation'
  | 'booking_sms_reminder'

export interface PlannedMessage {
  template: ReminderTemplate
  sendAt: Date
}

const ZONE = 'Europe/Brussels'
const EVE_HOUR = '17:00'
const SMS_BEFORE_MS = 2 * 60 * 60 * 1000

export function planReminders(input: { startsAt: Date; now: Date; sms: boolean }): PlannedMessage[] {
  const { startsAt, now, sms } = input
  const plan: PlannedMessage[] = []
  if (sms) plan.push({ template: 'booking_sms_confirmation', sendAt: now })
  const eve = zonedTimeToUtc(addDays(zonedParts(startsAt, ZONE).date, -1), EVE_HOUR, ZONE)
  if (eve > now) plan.push({ template: 'booking_reminder_email', sendAt: eve })
  const smsAt = new Date(startsAt.getTime() - SMS_BEFORE_MS)
  if (sms && smsAt > now) plan.push({ template: 'booking_sms_reminder', sendAt: smsAt })
  return plan
}
```

- [ ] **Step 4 : lancer** `npm run test:unit` — PASS ; vérifier aussi le passage à l'heure d'hiver (appel le lundi 26/10/2026 à 9 h : veille le dimanche 25/10 à 17 h = 16 h UTC) en ajoutant ce cas au test.
- [ ] **Step 5 : commit** — `git commit -m "Programmer les rappels d'un appel (3.12)"`

### Task 4 : E-mail de la veille

**Files :** Create `src/lib/email/booking-reminder.ts` ; Test `tests/unit/email-booking-reminder.test.ts`

Textes : **brouillons** à faire relire par `i18n-copy-editor`, balisés `[BROUILLON]` pour que `check:content` bloque la production tant qu'ils ne sont pas validés. Sujet neutre (TEM garde le sujet) : ni nom, ni service.

- [ ] **Step 1 : test qui échoue**

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { renderBookingReminder } from '../../src/lib/email/booking-reminder.ts'

test('rappel de la veille en français : date et heure de Bruxelles, aucun service nommé', () => {
  const mail = renderBookingReminder({ locale: 'fr', startsAt: new Date('2026-11-24T09:30:00Z') })
  assert.match(mail.subject, /Maison Triona/)
  assert.match(mail.text, /mardi 24 novembre/)
  assert.match(mail.text, /10 h 30/)
  assert.doesNotMatch(`${mail.subject} ${mail.text}`, /concierg|âge|enfant|aide|soins/i)
})

test('rappel de la veille en anglais', () => {
  const mail = renderBookingReminder({ locale: 'en', startsAt: new Date('2026-11-24T09:30:00Z') })
  assert.match(mail.text, /Tuesday 24 November/)
  assert.match(mail.text, /10:30/)
})
```

- [ ] **Step 2 : lancer** — échec attendu.
- [ ] **Step 3 : implémenter**, en reprenant le type `RenderedEmail` de `src/lib/email/templates.ts`, `zonedParts(startsAt, 'Europe/Brussels')` pour la date et l'heure locales, puis `libelleJour(date, langue)` et `libelleHeure(time, langue)` de `src/lib/booking/display.ts` pour les écrire comme sur la page de réservation (`formatSlot` de `src/lib/sms/templates.ts` n'est pas exporté et suit le format court des SMS). Corps proposé (brouillon) :
  - FR : sujet « [BROUILLON] Maison Triona : votre appel de demain » ; texte « Bonjour, nous vous appelons demain, {jour} à {heure} (heure de Bruxelles). Pour déplacer ou annuler cet appel, utilisez le lien reçu dans notre premier e-mail. À demain, Maison Triona ».
  - EN : sujet « [BROUILLON] Maison Triona: your call tomorrow » ; texte « Hello, we will call you tomorrow, {day} at {time} (Brussels time). To move or cancel this call, please use the link in our first email. Until tomorrow, Maison Triona ».
- [ ] **Step 4 : lancer** — PASS. **Relecture `i18n-copy-editor`** (mots bannis, ton, vouvoiement).
- [ ] **Step 5 : commit** — `git commit -m "Ajouter l'e-mail de rappel de la veille (3.12, brouillon)"`

### Task 5 : Migration `0015_rappels.sql` et droits

**Files :** Create `db/migrations/0015_rappels.sql` ; Modify `db/roles/site_public.sql`, `db/roles/envoi.sql` ; Test `tests/integration/rappels.test.ts`

- [ ] **Step 1 : test d'intégration qui échoue** (base `maison_triona_test`, comme les tests existants de `tests/integration/` : lire l'un d'eux pour la mise en place et les rôles). Cas :
  1. `site_public` peut insérer un message `booking_reminder_email` avec `booking_id` et `next_attempt_at`, et **ne peut pas** lire `bookings.contact_kms` ni `booking_tokens.email_kms`.
  2. `coffre` ne peut lire ni `contact_kms` ni `email_kms`.
  3. Un message `booking_*` sans `booking_id` est refusé ; un `request_notification` avec `booking_id` aussi.
  4. `envoi` peut lire `contact_kms`, `status`, `starts_at` et mettre `contact_kms` à nul.
- [ ] **Step 2 : lancer** `npm run test:integration` — échec attendu.
- [ ] **Step 3 : écrire la migration**

```sql
-- Rappels et SMS d'un appel (story 3.12, plan 2026-11-20-rappels-et-sms.md). Coordonnées chiffrées
-- par la clé serveur (Scaleway Key Manager), lisibles par le seul rôle `envoi`, effacées après le
-- dernier message. La boîte d'envoi ne porte qu'un identifiant de réservation.

alter table booking_tokens
  add column email_kms text check (email_kms ~ '^[A-Za-z0-9+/]+={0,2}$' and length(email_kms) <= 2000);

alter table bookings
  add column contact_kms text check (contact_kms ~ '^[A-Za-z0-9+/]+={0,2}$' and length(contact_kms) <= 2000);

alter table outbox add column booking_id uuid;

alter table outbox drop constraint outbox_template_check;
alter table outbox add constraint outbox_template_check check (template in (
  'request_notification', 'technical_alert', 'booking_access',
  'booking_reminder_email', 'booking_sms_confirmation', 'booking_sms_reminder'
));

-- Un message d'appel porte sa réservation, et seulement lui ; pas de clé étrangère (la réservation
-- peut être effacée avant l'envoi : le message est alors abandonné).
alter table outbox add constraint outbox_booking_shape check (
  (template in ('booking_reminder_email', 'booking_sms_confirmation', 'booking_sms_reminder'))
    = (booking_id is not null)
  and (booking_id is null or (request_id is null and priority = false))
);
create index outbox_booking_idx on outbox (booking_id) where booking_id is not null;
```

  Avant d'écrire : vérifier le **nom exact** de la contrainte de gabarit sur `main` (`\d outbox` sur la base de test, ou 0006 et 0011), et si la 3.11 a ajouté des valeurs à la liste ou des actions au journal d'accès : les recopier toutes (une migration ne retire jamais une valeur posée par une autre).

- [ ] **Step 4 : droits.** `db/roles/site_public.sql` : remplacer la ligne `grant insert (id, template, request_id, priority) on outbox` par `grant insert (id, template, request_id, priority, booking_id, next_attempt_at) on outbox to site_public;` ; ajouter `email_kms` à la liste d'insertion de `booking_tokens` et `contact_kms` à celle de `bookings`, **sans aucune lecture**. `db/roles/envoi.sql` : `grant select (id, status, starts_at, contact_kms), update (contact_kms) on bookings to envoi;` et `grant select (id, email_kms), update (email_kms) on booking_tokens to envoi;`. Ne rien ajouter à `coffre.sql`.
- [ ] **Step 5 : lancer** `npm run db:migrate` sur la base de test puis `npm run test:integration` — PASS.
- [ ] **Step 6 : commit** — `git commit -m "Ajouter les coordonnées chiffrées et les messages d'appel (migration 0015)"`

### Task 6 : Garder l'e-mail de la demande de lien (3.9)

**Files :** Modify `src/actions/booking-link.ts`, `src/lib/booking/tokens.ts` (ou le dépôt qui insère le jeton) ; Test : test unitaire ou d'intégration existant de la 3.9

- [ ] **Step 1 : test qui échoue** : avec une clé serveur configurée (double `createMemoryKey`), la création du lien écrit `email_kms` ; `openLinkEmail(key, tokenId, email_kms)` rend l'adresse saisie. Sans clé serveur (`readKmsConfig` nul) : comportement actuel inchangé, `email_kms` nul.
- [ ] **Step 2 : implémenter** : générer l'identifiant du jeton avant l'insertion (il l'est déjà si l'insertion n'utilise pas `RETURNING`), appeler `sealLinkEmail` **avant** d'ouvrir la transaction (aucun appel réseau dans une transaction), insérer `email_kms` avec le jeton. Une erreur du Key Manager ne bloque pas le lien : `email_kms` reste nul et l'appel n'aura pas de rappel (journal : `kms:failed`, sans valeur).
- [ ] **Step 3 : lancer** les tests de la 3.9 (`test:unit`, `test:integration`) — PASS.
- [ ] **Step 4 : commit** — `git commit -m "Garder l'e-mail de la demande de lien, chiffré par la clé serveur (3.12)"`

### Task 7 : Écrire les coordonnées et les rappels à la réservation (3.10)

**Files :** Modify `src/actions/booking.ts`, `src/lib/booking/bookings.ts` ; Modify `src/lib/outbox/repository.ts` (`enqueueBookingMessages`) ; Test : tests unitaires de la réservation et `tests/integration/`

- [ ] **Step 1 : ajouter `enqueueBookingMessages`** dans `src/lib/outbox/repository.ts`, sur le modèle de `enqueueAccessLink` (rôle `site_public`, sans `RETURNING`) :

```ts
// Messages programmés d'un appel (story 3.12), écrits dans la transaction de la réservation : un
// gabarit, l'identifiant de la réservation et l'heure d'envoi, aucune coordonnée.
export async function enqueueBookingMessages(
  client: PoolClient,
  bookingId: string,
  messages: readonly { id: string; template: ReminderTemplate; sendAt: Date }[],
): Promise<void> {
  assertId(bookingId, 'Identifiant de la réservation')
  for (const message of messages) {
    assertId(message.id, 'Identifiant du message')
    assertDate(message.sendAt, 'Heure d’envoi')
    await guard('enqueueBookingMessages', () =>
      client.query(
        `INSERT INTO outbox (id, template, booking_id, next_attempt_at) VALUES ($1, $2, $3, $4)`,
        [message.id, message.template, bookingId, message.sendAt],
      ),
    )
  }
}
```

  Ajouter les trois gabarits au type `OutboxTemplate`.

- [ ] **Step 2 : tests qui échouent** de la réservation : avec clé serveur et e-mail du lien (`email_kms` du jeton), la réservation écrit `contact_kms` (e-mail, numéro si la case est cochée, langue) et les messages de `planReminders` ; sans `email_kms` (lien créé avant la 3.12, ou Key Manager en panne) : réservation enregistrée, aucun message, aucune erreur visible.
- [ ] **Step 3 : implémenter dans l'action** : avant la transaction, lire `email_kms` du jeton. Le rôle `site_public` n'a aucun droit de lecture sur cette colonne : la lecture passe par le pool du rôle `envoi`, dans une fonction dédiée `readLinkEmail(pool, tokenId)` de `src/lib/outbox/repository.ts`. L'ouvrir (`openLinkEmail`), puis `sealBookingContact` avec l'identifiant de réservation déjà généré. Dans la transaction existante : insérer `contact_kms` avec la réservation, appeler `enqueueBookingMessages`. Après la transaction : remettre `email_kms` du jeton à nul (rôle `envoi`), et lancer le premier essai du SMS de confirmation par `sendNow` dans `after()`, comme la notification de la 3.3.
  - Le choix SMS et la langue viennent de la saisie validée de l'action (ils sont aussi scellés pour Cat, inchangé).
  - La case SMS n'apparaît que si `BOOKING_SMS_OPT_IN` vaut « true » **et** si la configuration SMS et la clé serveur sont présentes : modifier `src/lib/booking/options.ts` en conséquence, avec son test.
- [ ] **Step 4 : lancer** `npm run test:unit && npm run test:integration` — PASS ; puis le parcours E2E de réservation (projet `reservation`, `RESERVATION_E2E_DATABASE_URL`) avec le double de clé serveur.
- [ ] **Step 5 : commit** — `git commit -m "Programmer les rappels à la réservation d'un appel (3.12)"`

### Task 8 : Envoyer les trois gabarits

**Files :** Modify `src/lib/outbox/process.ts`, `src/lib/outbox/deps.ts`, `src/lib/outbox/repository.ts` ; Test `tests/unit/outbox-booking.test.ts`

- [ ] **Step 1 : tests qui échouent** (dépendances simulées, comme les tests existants de `sendItem`) :
  1. `booking_reminder_email` : `contact_kms` présent, appel confirmé → e-mail envoyé à l'adresse déchiffrée, dans la langue de la personne ; marqué `accepted`.
  2. `booking_sms_reminder` : numéro présent → SMS par le transport, `renderBookingSms({ kind: 'reminder' })`, `validForMinutes: 120` ; `accepted`.
  3. `contact_kms` nul, ou appel non confirmé (annulé, fait) → `markFailed(…, 'no_contact' | 'cancelled', null)` **sans alerte** (`alertId` nul) ; journal `failed:no-contact`.
  4. SMS sans configuration SMS → `failed` code `sms_disabled`, sans alerte ; l'e-mail du même appel part quand même.
  5. Erreur du Key Manager (réseau) → reprise (`markRetry`), comme une erreur réseau de TEM.
  6. SMS refusé définitivement par seven (code non reprenable) → `failed` avec alerte à Sady (comme un e-mail).
- [ ] **Step 2 : implémenter.** Dans `OutboxDeps`, ajouter `serverKey: ServerKey | null` et `sms: { transport: SmsTransport; sender: string } | null`, construits dans `deps.ts` à partir de `readKmsConfig` et `readSmsConfig`. Ajouter `bookingId` à `OutboxItem` (colonne `booking_id` dans `CLAIM_DUE` et `CLAIM_ONE`). Dans `sendItem`, avant le rendu des e-mails existants, une branche pour les trois gabarits : lire `status`, `starts_at`, `contact_kms` (fonction `readBookingContact(pool, bookingId)` du dépôt), puis les cas ci-dessus. Les SMS passent par `deps.sms.transport.send({ to, text, from: deps.sms.sender, foreignId: item.id, validForMinutes })` ; un résultat `duplicate` compte comme accepté. Le suivi de livraison (`listAccepted`) ignore les SMS (décision 4) : les marquer `accepted` puis `delivered` d'emblée, ou les exclure de `listAccepted` par leur gabarit.
- [ ] **Step 3 : lancer** `npm run test:unit` — PASS ; relancer toute la suite de la boîte d'envoi.
- [ ] **Step 4 : commit** — `git commit -m "Envoyer l'e-mail de la veille et les SMS d'un appel (3.12)"`

### Task 9 : Effacement des coordonnées

**Files :** Modify la tâche de conservation (`src/app/api/cron/retention/route.ts` et son module), les fonctions d'annulation et de déplacement de la 3.11 ; Test `tests/integration/rappels.test.ts`

Point d'accroche (session de la 3.11, 20/11/2026) : l'annulation et le déplacement, par la personne comme par Cat, passent chacun par **une seule fonction de dépôt**, dans sa transaction, qui porte le commentaire « 3.12 : effacer contact_kms et abandonner les rappels en attente de cet appel ». Le chercher (`git grep -n "3.12 : effacer contact_kms"`) et écrire les requêtes à cet endroit, dans la même transaction.

- [ ] **Step 1 : tests d'intégration qui échouent** :
  1. La passe de conservation met à nul `contact_kms` des appels finis depuis plus de 24 heures, et `email_kms` des jetons consommés ou expirés ; compte les lignes dans son résumé (`erased_contacts`, `erased_link_emails`), sans valeur.
  2. Annuler un appel (3.11) met `contact_kms` à nul et passe ses messages en attente à `failed` (`cancelled`), sans alerte.
  3. Déplacer un appel (3.11) remplace les messages en attente par ceux du nouveau créneau (`planReminders` avec le nouveau `startsAt`), sans toucher `contact_kms`.
- [ ] **Step 2 : implémenter** dans les mêmes transactions que la 3.11 (annulation, déplacement) et dans la passe de conservation (rôle `envoi` pour `contact_kms` et `email_kms`).
- [ ] **Step 3 : lancer** `npm run test:integration` — PASS.
- [ ] **Step 4 : test réel du Key Manager** (une fois, hors CI, avec une clé de développement de Sady) : script de scratchpad qui chiffre puis déchiffre « essai » avec `createScalewayKey`, pour lever le `[À VÉRIFIER]` de l'encodage base64. Noter le résultat dans ce plan et dans `docs/architecture.md`.
- [ ] **Step 5 : commit** — `git commit -m "Effacer les coordonnées après le dernier message et à l'annulation (3.12)"`

### Task 10 : Documentation et RGPD

- [ ] `docs/reservation-appel.md` §4.1 et §4.5 (chiffrement direct au lieu de l'enveloppe ; heure de la veille ; SMS de confirmation), §10 (écarts de la 3.12).
- [ ] `docs/architecture.md` §6.5 (exception de chiffrement : rôle `envoi`, `associated_data`), §6.6 (trois gabarits, `booking_id`), §1 (aucune dépendance).
- [ ] `docs/privacy.md` (§1, §7, §8 : e-mail et numéro gardés par la clé serveur jusqu'à 24 h après l'appel ; risque STOP en Belgique, décision 6).
- [ ] `docs/rgpd/registre-des-traitements.md` (T2, T8), `docs/rgpd/sous-traitants.md` (**Scaleway Key Manager** : même sous-traitant que la base, région `fr-par`), `docs/rgpd/analyse-impact.md`.
- [ ] `docs/email-deliverability.md` §1 (e-mail de la veille), `docs/launch-checklist.md` (clé `KMS_*`, réception des SMS dans les cinq pays).
- [ ] `docs/plan-implementation.md` (3.12, lot E) et `docs/decisions.md` (décisions 1 à 6, numéro libre au moment de la fusion).

### Task 11 : Relectures et fusion

- [ ] `security-privacy-reviewer` (clé serveur, droits par rôle, journaux, effacement) ; `i18n-copy-editor` (e-mail de la veille) ; `qa-a11y-perf` si la case SMS change d'affichage.
- [ ] `npm run lint && npm run typecheck && npm run format:check && npm run test:unit && npm run test:integration && npm run build && npm run check:third-party && npm run check:i18n`.
- [ ] PR, CI verte, fusion (pas un point de contrôle, D22).

## À faire par Sady, avant la production

1. **Console Scaleway** : créer une clé Key Manager en `fr-par`, usage `symmetric_encryption`, algorithme `aes_256_gcm`, **protégée** contre la suppression ; noter son identifiant (`KMS_KEY_ID`).
2. **IAM** : une application dédiée, avec une politique limitée au Key Manager (chiffrer et déchiffrer cette clé seulement), et sa clé secrète (`KMS_SECRET_KEY`). Jamais la clé de TEM.
3. **Vercel** (production) : `KMS_KEY_ID`, `KMS_SECRET_KEY`, `SEVEN_API_KEY`, `SMS_SENDER`, puis `BOOKING_SMS_OPT_IN=true` seulement après le contrat de traitement signé avec seven et la réponse à la question 5.
4. Relire la doc web du Key Manager dans un navigateur (tarif, limites, statut de l'API `v1alpha1`) et confirmer les décisions 1 à 6.
