# Calcul des créneaux (story 3.8, partie A) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** livrer le moteur qui calcule les créneaux réservables de Cat (fonction pure, testée), première brique de la réservation d'appel (D57).

**Architecture :** quatre modules sans dépendance dans `src/lib/booking/` : heures locales et fuseaux par l'API `Intl` (Node 24 n'a pas `Temporal`), jours fériés belges, réglages par défaut, calcul des créneaux. Aucune base, aucune horloge, aucun réseau : tout arrive en paramètre, ce qui permet de tout tester avec le testeur intégré de Node. La partie B de la story 3.8 (tables, page `/coffre/disponibilites`) viendra après le coffre (3.2).

**Tech Stack :** TypeScript strict (`noUncheckedIndexedAccess`), Node 24 (`node --test`, suppression des types intégrée), `Intl.DateTimeFormat`. Aucune nouvelle dépendance.

**Références :** `docs/reservation-appel.md` §3.1 (réglages), §4.2 (règle d'occupation), §4.3 (calcul) ; `docs/decisions.md` D57.

**Vérifié avant d'écrire ce plan (06/11/2026)** : les 30 tests ci-dessous passent sur le code ci-dessous ; ESLint et Prettier du projet passent ; `tsc` strict ne signale rien dans ces fichiers ; `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` coupe l'avertissement de Node ; Pâques 2024 à 2028 et les changements d'heure de 2027 contrôlés avec `Intl`.

> **Écarts du code livré (relecture finale, 06/11/2026)** : `bookings` est un `BookedCall[]` (`start`, `occupiedUntil` : plage `slot` enregistrée en base, pause comprise) et non un `TimeInterval[]` sans pause ; les réglages sont validés (`Réglages invalides`) ; les dates impossibles sont refusées ; la suite compte **41 tests**, pas 30. Le code de `src/lib/booking/` et `docs/reservation-appel.md` §4.3 font foi : les blocs de code ci-dessous sont l'état initial du plan.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/booking/zoned-time.ts` (créé) | Dates « YYYY-MM-DD » et heures « HH:MM » locales, conversion depuis et vers UTC dans un fuseau |
| `src/lib/booking/belgian-holidays.ts` (créé) | Dimanche de Pâques et les dix jours fériés légaux belges |
| `src/lib/booking/settings.ts` (créé) | Types des réglages, des plages et des absences ; valeurs par défaut de la spec §3.1 |
| `src/lib/booking/slots.ts` (créé) | `computeSlots` : créneaux réservables |
| `tests/unit/*.test.ts` (créés) | Tests unitaires, un fichier par module |
| `package.json` (modifié) | Script `test:unit` |
| `tsconfig.json` (modifié) | `allowImportingTsExtensions` : les imports gardent l'extension `.ts`, exigée par Node |
| `.github/workflows/ci.yml` (modifié) | Lance `test:unit` en CI |
| `README.md`, `CLAUDE.md`, `docs/plan-implementation.md`, `docs/reservation-appel.md` (modifiés) | Commande et état de la story |

**Convention d'import** : entre ces modules et depuis les tests, toujours un chemin relatif **avec** l'extension `.ts` (`'./zoned-time.ts'`), jamais l'alias `@/` : Node exécute les tests sans bundler.

---

### Task 0 : Préparer la branche

- [ ] **Step 1 : Créer un worktree depuis `main`**

Le dossier du projet peut contenir le travail d'une autre session : ne pas y changer de branche.

La branche `story/3.8a-calcul-creneaux` existe déjà : elle porte ce plan.

```bash
cd "/Volumes/DISQUE SADY/06_CLIENTS/MAMAN /MAISON TRIONA "
git fetch origin
WT="${TMPDIR:-/tmp}/wt-creneaux"
git worktree add "$WT" story/3.8a-calcul-creneaux
cd "$WT"
npm ci
```

Si un worktree existe déjà sur cette branche (`git worktree list`), s'y placer et lancer seulement `npm ci`.

Attendu : `npm ci` se termine sans erreur.

---

### Task 1 : Lanceur de tests unitaires et heures locales

**Files :**
- Modify : `package.json` (bloc `scripts`)
- Modify : `tsconfig.json` (`compilerOptions`)
- Modify : `.github/workflows/ci.yml`
- Create : `tests/unit/zoned-time.test.ts`
- Create : `src/lib/booking/zoned-time.ts`

- [ ] **Step 1 : Ajouter le script `test:unit`**

Dans `package.json`, juste après la ligne `"test:a11y": …,` :

```json
    "test:unit": "node --test --disable-warning=MODULE_TYPELESS_PACKAGE_JSON 'tests/unit/*.test.ts'",
```

- [ ] **Step 2 : Autoriser l'extension `.ts` dans les imports**

Dans `tsconfig.json`, juste après `"noEmit": true,` :

```json
    "allowImportingTsExtensions": true,
```

- [ ] **Step 3 : Écrire le test qui échoue**

Créer `tests/unit/zoned-time.test.ts` :

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  addDays,
  isoWeekday,
  minutesToTime,
  timeToMinutes,
  zonedParts,
  zonedTimeToUtc,
} from '../../src/lib/booking/zoned-time.ts'

const BRUSSELS = 'Europe/Brussels'

describe('heures locales', () => {
  test('convertit « HH:MM » en minutes et retour', () => {
    assert.equal(timeToMinutes('10:30'), 630)
    assert.equal(timeToMinutes('00:00'), 0)
    assert.equal(minutesToTime(630), '10:30')
    assert.equal(minutesToTime(0), '00:00')
  })

  test('refuse une heure mal formée', () => {
    assert.throws(() => timeToMinutes('24:00'), RangeError)
    assert.throws(() => timeToMinutes('9:30'), RangeError)
  })
})

describe('dates locales', () => {
  test('ajoute des jours en passant les fins de mois et les années bissextiles', () => {
    assert.equal(addDays('2027-02-28', 1), '2027-03-01')
    assert.equal(addDays('2028-02-28', 1), '2028-02-29')
    assert.equal(addDays('2027-12-31', 1), '2028-01-01')
    assert.equal(addDays('2027-03-01', -1), '2027-02-28')
  })

  test('donne le jour de la semaine ISO', () => {
    assert.equal(isoWeekday('2027-01-18'), 1)
    assert.equal(isoWeekday('2027-03-28'), 7)
  })

  test('refuse une date mal formée', () => {
    assert.throws(() => addDays('18/01/2027', 1), RangeError)
  })
})

describe('fuseau de Bruxelles', () => {
  test('10 h 30 en hiver et en été', () => {
    assert.equal(
      zonedTimeToUtc('2027-01-18', '10:30', BRUSSELS).toISOString(),
      '2027-01-18T09:30:00.000Z',
    )
    assert.equal(
      zonedTimeToUtc('2027-07-15', '10:30', BRUSSELS).toISOString(),
      '2027-07-15T08:30:00.000Z',
    )
  })

  test('10 h 30 les jours de changement d’heure', () => {
    assert.equal(
      zonedTimeToUtc('2027-03-28', '10:30', BRUSSELS).toISOString(),
      '2027-03-28T08:30:00.000Z',
    )
    assert.equal(
      zonedTimeToUtc('2027-10-31', '10:30', BRUSSELS).toISOString(),
      '2027-10-31T09:30:00.000Z',
    )
  })

  test('lit la date et l’heure locales, de part et d’autre du passage à l’heure d’été', () => {
    assert.deepEqual(zonedParts(new Date('2027-03-28T00:30:00Z'), BRUSSELS), {
      date: '2027-03-28',
      time: '01:30',
    })
    assert.deepEqual(zonedParts(new Date('2027-03-28T01:30:00Z'), BRUSSELS), {
      date: '2027-03-28',
      time: '03:30',
    })
  })

  test('change de date à minuit heure locale, pas à minuit UTC', () => {
    assert.deepEqual(zonedParts(new Date('2027-01-17T23:30:00Z'), BRUSSELS), {
      date: '2027-01-18',
      time: '00:30',
    })
  })
})
```

- [ ] **Step 4 : Vérifier qu'il échoue**

Run : `npm run test:unit`
Attendu : FAIL, `ERR_MODULE_NOT_FOUND` (module `src/lib/booking/zoned-time.ts` introuvable).

- [ ] **Step 5 : Écrire le module**

Créer `src/lib/booking/zoned-time.ts` :

```ts
/**
 * Dates et heures locales dans un fuseau, sans dépendance (API Intl).
 * Node 24 n'a pas encore Temporal (spec réservation d'appel §4.3).
 * Conventions : date locale « YYYY-MM-DD », heure locale « HH:MM » sur 24 heures.
 */

/** Jour de la semaine ISO : 1 = lundi … 7 = dimanche. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

const MINUTE_MS = 60_000
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

/** Ce qu'affiche une horloge murale du fuseau à cet instant. */
function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = formatterFor(timeZone).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  }
}

/** Décalage du fuseau à cet instant, en minutes (Bruxelles : 60 en hiver, 120 en été). */
function offsetMinutes(instant: Date, timeZone: string): number {
  const clock = wallClock(instant, timeZone)
  const wallAsUtc = Date.UTC(
    clock.year,
    clock.month - 1,
    clock.day,
    clock.hour,
    clock.minute,
    clock.second,
  )
  const wholeSeconds = Math.floor(instant.getTime() / 1000) * 1000
  return Math.round((wallAsUtc - wholeSeconds) / MINUTE_MS)
}

const pad = (value: number): string => String(value).padStart(2, '0')

function parseDate(date: string): [number, number, number] {
  const match = DATE_PATTERN.exec(date)
  if (!match) throw new RangeError(`Date invalide : ${date}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** « 10:30 » → 630. Refuse tout ce qui n'est pas « HH:MM » entre 00:00 et 23:59. */
export function timeToMinutes(time: string): number {
  const match = TIME_PATTERN.exec(time)
  if (!match) throw new RangeError(`Heure invalide : ${time}`)
  return Number(match[1]) * 60 + Number(match[2])
}

/** 630 → « 10:30 ». */
export function minutesToTime(totalMinutes: number): string {
  return `${pad(Math.floor(totalMinutes / 60))}:${pad(totalMinutes % 60)}`
}

/** Ajoute (ou retire) des jours à une date locale. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = parseDate(date)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** Jour de la semaine ISO d'une date locale. */
export function isoWeekday(date: string): IsoWeekday {
  const [year, month, day] = parseDate(date)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0 = dimanche
  return (weekday === 0 ? 7 : weekday) as IsoWeekday
}

/** Date et heure locales d'un instant dans le fuseau. */
export function zonedParts(instant: Date, timeZone: string): { date: string; time: string } {
  const clock = wallClock(instant, timeZone)
  return {
    date: `${clock.year}-${pad(clock.month)}-${pad(clock.day)}`,
    time: `${pad(clock.hour)}:${pad(clock.minute)}`,
  }
}

/**
 * Instant correspondant à une date et une heure locales. Deux passes : le décalage est relu
 * après la première conversion, ce qui suffit autour des changements d'heure. Une heure qui
 * n'existe pas (passage à l'heure d'été) est décalée d'une heure plus tard ; une heure qui existe
 * deux fois (retour à l'heure d'hiver) donne la seconde.
 */
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = parseDate(date)
  const minutes = timeToMinutes(time)
  const wallAsUtc = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60)
  const firstGuess = wallAsUtc - offsetMinutes(new Date(wallAsUtc), timeZone) * MINUTE_MS
  return new Date(wallAsUtc - offsetMinutes(new Date(firstGuess), timeZone) * MINUTE_MS)
}
```

- [ ] **Step 6 : Vérifier qu'il passe**

Run : `npm run test:unit`
Attendu : `ℹ tests 9`, `ℹ pass 9`, `ℹ fail 0`, aucun avertissement « Reparsing as ES module ».

- [ ] **Step 7 : Lancer les tests unitaires en CI**

Dans `.github/workflows/ci.yml`, juste après `      - run: npm run typecheck` :

```yaml
      - run: npm run test:unit
```

- [ ] **Step 8 : Commit**

```bash
git add package.json tsconfig.json .github/workflows/ci.yml src/lib/booking/zoned-time.ts tests/unit/zoned-time.test.ts
git commit -m "Lancer les tests unitaires et poser les heures locales de la réservation (3.8)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2 : Jours fériés belges

**Files :**
- Create : `tests/unit/belgian-holidays.test.ts`
- Create : `src/lib/booking/belgian-holidays.ts`

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/unit/belgian-holidays.test.ts` :

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { belgianHolidays, easterSunday } from '../../src/lib/booking/belgian-holidays.ts'

describe('jours fériés belges', () => {
  test('dimanche de Pâques de 2024 à 2028', () => {
    assert.equal(easterSunday(2024), '2024-03-31')
    assert.equal(easterSunday(2025), '2025-04-20')
    assert.equal(easterSunday(2026), '2026-04-05')
    assert.equal(easterSunday(2027), '2027-03-28')
    assert.equal(easterSunday(2028), '2028-04-16')
  })

  test('les dix jours fériés de 2027', () => {
    assert.deepEqual(
      belgianHolidays(2027).map((holiday) => holiday.date),
      [
        '2027-01-01',
        '2027-03-29',
        '2027-05-01',
        '2027-05-06',
        '2027-05-17',
        '2027-07-21',
        '2027-08-15',
        '2027-11-01',
        '2027-11-11',
        '2027-12-25',
      ],
    )
  })

  test('les fêtes mobiles de 2026', () => {
    const byName = new Map(belgianHolidays(2026).map((holiday) => [holiday.name, holiday.date]))
    assert.equal(byName.get('Lundi de Pâques'), '2026-04-06')
    assert.equal(byName.get('Ascension'), '2026-05-14')
    assert.equal(byName.get('Lundi de Pentecôte'), '2026-05-25')
  })

  test('reste trié quand l’Ascension précède le 1er mai (Pâques le 22 mars 2285)', () => {
    assert.equal(easterSunday(2285), '2285-03-22')
    const dates = belgianHolidays(2285).map((holiday) => holiday.date)
    assert.deepEqual(dates, [...dates].sort())
    assert.equal(dates.indexOf('2285-04-30'), 2)
  })
})
```

- [ ] **Step 2 : Vérifier qu'il échoue**

Run : `npm run test:unit`
Attendu : FAIL, `ERR_MODULE_NOT_FOUND` (module `belgian-holidays.ts` introuvable) ; les 9 tests de la tâche 1 restent verts.

- [ ] **Step 3 : Écrire le module**

Créer `src/lib/booking/belgian-holidays.ts` :

```ts
/**
 * Les dix jours fériés légaux belges, préremplis comme absences dans les réglages de Cat
 * (spec réservation d'appel §3.1). Libellés internes au coffre, en français.
 */
import { addDays } from './zoned-time.ts'

export interface Holiday {
  date: string
  name: string
}

/** Dimanche de Pâques, calendrier grégorien (algorithme de Meeus, Jones et Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const n = h + l - 7 * m + 114
  const month = Math.floor(n / 31)
  const day = (n % 31) + 1
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Jours fériés belges d'une année, triés par date. */
export function belgianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year)
  const holidays: Holiday[] = [
    { date: `${year}-01-01`, name: "Jour de l'An" },
    { date: addDays(easter, 1), name: 'Lundi de Pâques' },
    { date: `${year}-05-01`, name: 'Fête du Travail' },
    { date: addDays(easter, 39), name: 'Ascension' },
    { date: addDays(easter, 50), name: 'Lundi de Pentecôte' },
    { date: `${year}-07-21`, name: 'Fête nationale' },
    { date: `${year}-08-15`, name: 'Assomption' },
    { date: `${year}-11-01`, name: 'Toussaint' },
    { date: `${year}-11-11`, name: 'Armistice' },
    { date: `${year}-12-25`, name: 'Noël' },
  ]
  // L'Ascension peut tomber avant le 1er mai quand Pâques est très tôt (22 mars).
  return holidays.sort((x, y) => x.date.localeCompare(y.date))
}
```

- [ ] **Step 4 : Vérifier qu'il passe**

Run : `npm run test:unit`
Attendu : `ℹ tests 13`, `ℹ pass 13`, `ℹ fail 0`.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/booking/belgian-holidays.ts tests/unit/belgian-holidays.test.ts
git commit -m "Calculer les jours fériés belges pour les absences de Cat (3.8)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3 : Réglages et calcul des créneaux

**Files :**
- Create : `tests/unit/slots.test.ts`
- Create : `src/lib/booking/settings.ts`
- Create : `src/lib/booking/slots.ts`

Règles à respecter (spec §4.2 et §4.3) :
- un créneau occupe **[début, fin + pause)**, exactement comme un appel confirmé (même règle que la contrainte d'exclusion en base) ;
- les créneaux d'une plage partent de son début, tous les `durée + pause` (45 min par défaut), tant que l'appel tient dans la plage ;
- l'horizon compte **aujourd'hui compris** (21 jours = aujourd'hui et les 20 suivants) ;
- le délai minimal est **inclusif** (un créneau qui commence pile à `maintenant + 24 h` est proposé) ;
- le plafond compte les **appels confirmés** du jour local, pas les créneaux proposés.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `tests/unit/slots.test.ts` :

```ts
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { belgianHolidays } from '../../src/lib/booking/belgian-holidays.ts'
import {
  DEFAULT_AVAILABILITY_RULES,
  DEFAULT_BOOKING_SETTINGS,
} from '../../src/lib/booking/settings.ts'
import { computeSlots, type Slot, type SlotInput } from '../../src/lib/booking/slots.ts'

/** Vendredi 15 janvier 2027, 12 h à Bruxelles. */
const NOW = new Date('2027-01-15T11:00:00Z')
const MONDAY = '2027-01-18'
const TUESDAY = '2027-01-19'
const FULL_DAY = ['10:30', '11:15', '12:00', '16:00', '16:45', '17:30']

function compute(overrides: Partial<SlotInput> = {}): Slot[] {
  return computeSlots({
    settings: DEFAULT_BOOKING_SETTINGS,
    rules: DEFAULT_AVAILABILITY_RULES,
    exceptions: [],
    bookings: [],
    busy: [],
    now: NOW,
    ...overrides,
  })
}

function timesOn(slots: Slot[], date: string): string[] {
  return slots.filter((slot) => slot.localDate === date).map((slot) => slot.localTime)
}

/** Un appel confirmé de 30 minutes, donné en heure UTC. */
function booking(startIso: string) {
  const start = new Date(startIso)
  return { start, end: new Date(start.getTime() + 30 * 60_000) }
}

describe('créneaux avec les réglages par défaut', () => {
  test('six créneaux un lundi ordinaire, de 30 minutes, à l’heure de Bruxelles', () => {
    const slots = compute()
    assert.deepEqual(timesOn(slots, MONDAY), FULL_DAY)
    const first = slots.find((slot) => slot.localDate === MONDAY)
    assert.equal(first?.start.toISOString(), '2027-01-18T09:30:00.000Z')
    assert.equal(first?.end.toISOString(), '2027-01-18T10:00:00.000Z')
  })

  test('triés du plus proche au plus lointain', () => {
    const starts = compute().map((slot) => slot.start.getTime())
    assert.deepEqual(
      starts,
      [...starts].sort((x, y) => x - y),
    )
  })

  test('aucun créneau le week-end', () => {
    const slots = compute()
    assert.deepEqual(timesOn(slots, '2027-01-16'), [])
    assert.deepEqual(timesOn(slots, '2027-01-17'), [])
  })

  test('respecte le délai minimal de 24 heures, limite comprise', () => {
    const mondayAtTen = compute({ now: new Date('2027-01-18T09:00:00Z') })
    assert.deepEqual(timesOn(mondayAtTen, MONDAY), [])
    assert.deepEqual(timesOn(mondayAtTen, TUESDAY), FULL_DAY)

    const exactlyOneDay = compute({ now: new Date('2027-01-18T09:30:00Z') })
    assert.equal(timesOn(exactlyOneDay, TUESDAY)[0], '10:30')
  })

  test('s’arrête à l’horizon de 21 jours, aujourd’hui compris', () => {
    const slots = compute()
    assert.equal(slots.at(-1)?.localDate, '2027-02-04')
    assert.deepEqual(timesOn(slots, '2027-02-05'), [])
  })
})

describe('absences', () => {
  test('un congé ferme tous ses jours, bornes comprises', () => {
    const slots = compute({
      exceptions: [{ startDate: MONDAY, endDate: TUESDAY, kind: 'leave' }],
    })
    assert.deepEqual(timesOn(slots, MONDAY), [])
    assert.deepEqual(timesOn(slots, TUESDAY), [])
    assert.deepEqual(timesOn(slots, '2027-01-20'), FULL_DAY)
  })

  test('les jours fériés belges ferment le lundi de Pâques 2027', () => {
    const exceptions = belgianHolidays(2027).map((holiday) => ({
      startDate: holiday.date,
      endDate: holiday.date,
      kind: 'holiday' as const,
    }))
    const slots = compute({ exceptions, now: new Date('2027-03-24T12:00:00Z') })
    assert.deepEqual(timesOn(slots, '2027-03-29'), [])
    assert.deepEqual(timesOn(slots, '2027-03-30'), FULL_DAY)
  })
})

describe('appels déjà pris', () => {
  test('un appel confirmé retire son créneau, pause comprise', () => {
    const slots = compute({ bookings: [booking('2027-01-18T10:15:00Z')] }) // 11 h 15 à Bruxelles
    assert.deepEqual(timesOn(slots, MONDAY), ['10:30', '12:00', '16:00', '16:45', '17:30'])
  })

  test('un appel hors grille retire tous les créneaux qu’il chevauche', () => {
    const slots = compute({ bookings: [booking('2027-01-18T10:00:00Z')] }) // 11 h à Bruxelles
    assert.deepEqual(timesOn(slots, MONDAY), ['12:00', '16:00', '16:45', '17:30'])
  })

  test('trois appels laissent les créneaux libres de la journée', () => {
    const slots = compute({
      bookings: [
        booking('2027-01-18T09:30:00Z'),
        booking('2027-01-18T10:15:00Z'),
        booking('2027-01-18T11:00:00Z'),
      ],
    })
    assert.deepEqual(timesOn(slots, MONDAY), ['16:00', '16:45', '17:30'])
  })

  test('quatre appels confirmés ferment la journée (plafond)', () => {
    const slots = compute({
      bookings: [
        booking('2027-01-18T09:30:00Z'),
        booking('2027-01-18T10:15:00Z'),
        booking('2027-01-18T11:00:00Z'),
        booking('2027-01-18T15:00:00Z'),
      ],
    })
    assert.deepEqual(timesOn(slots, MONDAY), [])
    assert.deepEqual(timesOn(slots, TUESDAY), FULL_DAY)
  })

  test('une heure occupée ailleurs retire le créneau qu’elle touche', () => {
    const slots = compute({
      busy: [{ start: new Date('2027-01-18T15:20:00Z'), end: new Date('2027-01-18T15:40:00Z') }],
    })
    assert.deepEqual(timesOn(slots, MONDAY), ['10:30', '11:15', '12:00', '16:45', '17:30'])
  })
})

describe('changements d’heure', () => {
  test('fin mars 2027 : 10 h 30 passe de 9 h 30 à 8 h 30 UTC', () => {
    const slots = compute({ now: new Date('2027-03-24T12:00:00Z') })
    const startOf = (date: string) =>
      slots.find((slot) => slot.localDate === date)?.start.toISOString()
    assert.equal(startOf('2027-03-26'), '2027-03-26T09:30:00.000Z')
    assert.equal(startOf('2027-03-30'), '2027-03-30T08:30:00.000Z')
  })

  test('fin octobre 2027 : 10 h 30 passe de 8 h 30 à 9 h 30 UTC', () => {
    const slots = compute({ now: new Date('2027-10-27T12:00:00Z') })
    const startOf = (date: string) =>
      slots.find((slot) => slot.localDate === date)?.start.toISOString()
    assert.equal(startOf('2027-10-29'), '2027-10-29T08:30:00.000Z')
    assert.equal(startOf('2027-11-02'), '2027-11-02T09:30:00.000Z')
  })
})

describe('réglages limites', () => {
  test('une plage plus courte qu’un appel ne donne aucun créneau', () => {
    assert.deepEqual(compute({ rules: [{ weekday: 1, start: '10:00', end: '10:20' }] }), [])
  })

  test('deux plages qui se chevauchent ne donnent pas de doublon', () => {
    const slots = compute({
      rules: [
        { weekday: 1, start: '10:30', end: '12:30' },
        { weekday: 1, start: '10:30', end: '11:30' },
      ],
    })
    assert.deepEqual(timesOn(slots, MONDAY), ['10:30', '11:15', '12:00'])
  })

  test('refuse une durée nulle', () => {
    assert.throws(
      () => compute({ settings: { ...DEFAULT_BOOKING_SETTINGS, durationMinutes: 0 } }),
      RangeError,
    )
  })
})
```

- [ ] **Step 2 : Vérifier qu'il échoue**

Run : `npm run test:unit`
Attendu : FAIL, `ERR_MODULE_NOT_FOUND` (module `settings.ts` ou `slots.ts` introuvable) ; les 13 tests précédents restent verts.

- [ ] **Step 3 : Écrire les réglages**

Créer `src/lib/booking/settings.ts` :

```ts
/**
 * Réglages de la réservation d'appel (spec §3.1). Les valeurs par défaut ont été validées par
 * Sady le 06/11/2026 ; Cat les modifie depuis le coffre (story 3.8, partie B).
 */
import type { IsoWeekday } from './zoned-time.ts'

export interface BookingSettings {
  /** Fuseau des plages de Cat. */
  timeZone: string
  /** Durée d'un appel. */
  durationMinutes: number
  /** Pause après chaque appel. */
  bufferMinutes: number
  /** Délai minimal entre maintenant et le début d'un appel. */
  minNoticeMinutes: number
  /** Nombre de jours réservables, aujourd'hui compris. */
  horizonDays: number
  /** Nombre maximal d'appels confirmés par jour. */
  dailyCap: number
}

/** Une plage d'ouverture de la semaine type, en heure locale. */
export interface AvailabilityRule {
  weekday: IsoWeekday
  start: string
  end: string
}

export type ExceptionKind = 'leave' | 'holiday' | 'blocked'

/** Une absence : congé, jour férié ou journée bloquée, dates locales incluses. */
export interface AvailabilityException {
  startDate: string
  endDate: string
  kind: ExceptionKind
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  timeZone: 'Europe/Brussels',
  durationMinutes: 30,
  bufferMinutes: 15,
  minNoticeMinutes: 24 * 60,
  horizonDays: 21,
  dailyCap: 4,
}

const WORKING_DAYS: IsoWeekday[] = [1, 2, 3, 4, 5]

/** Lundi à vendredi, fin de matinée et fin d'après-midi (D41). */
export const DEFAULT_AVAILABILITY_RULES: AvailabilityRule[] = WORKING_DAYS.flatMap((weekday) => [
  { weekday, start: '10:30', end: '12:30' },
  { weekday, start: '16:00', end: '18:00' },
])
```

- [ ] **Step 4 : Écrire le calcul**

Créer `src/lib/booking/slots.ts` :

```ts
/**
 * Calcul des créneaux réservables (spec réservation d'appel §4.3). Fonction pure : aucune
 * lecture de base, d'horloge ni de réseau ; tout arrive en paramètre.
 */
import type { AvailabilityException, AvailabilityRule, BookingSettings } from './settings.ts'
import {
  addDays,
  isoWeekday,
  minutesToTime,
  timeToMinutes,
  zonedParts,
  zonedTimeToUtc,
} from './zoned-time.ts'

export interface TimeInterval {
  start: Date
  end: Date
}

export interface Slot {
  start: Date
  end: Date
  /** Date locale dans le fuseau des réglages, « YYYY-MM-DD ». */
  localDate: string
  /** Heure locale de début, « HH:MM ». */
  localTime: string
}

export interface SlotInput {
  settings: BookingSettings
  rules: AvailabilityRule[]
  exceptions: AvailabilityException[]
  /** Appels confirmés : début et fin, sans la pause. */
  bookings: TimeInterval[]
  /** Heures occupées venues d'ailleurs (agenda Google, story 3.14). */
  busy: TimeInterval[]
  now: Date
}

const MINUTE_MS = 60_000

interface Range {
  start: number
  end: number
}

function overlapsAny(start: number, end: number, ranges: Range[]): boolean {
  return ranges.some((range) => start < range.end && range.start < end)
}

function countByLocalDate(intervals: TimeInterval[], timeZone: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { start } of intervals) {
    const { date } = zonedParts(start, timeZone)
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return counts
}

/**
 * Créneaux réservables, du plus proche au plus lointain. Un créneau occupe [début, fin + pause),
 * comme un appel confirmé : c'est la même règle que la contrainte d'exclusion en base (§4.2).
 */
export function computeSlots(input: SlotInput): Slot[] {
  const { settings, rules, exceptions, bookings, busy, now } = input
  if (settings.durationMinutes <= 0 || settings.bufferMinutes < 0) {
    throw new RangeError('Durée ou pause invalide')
  }

  const bufferMs = settings.bufferMinutes * MINUTE_MS
  const durationMs = settings.durationMinutes * MINUTE_MS
  const step = settings.durationMinutes + settings.bufferMinutes
  const earliest = now.getTime() + settings.minNoticeMinutes * MINUTE_MS
  const today = zonedParts(now, settings.timeZone).date
  const bookingsPerDay = countByLocalDate(bookings, settings.timeZone)
  const taken: Range[] = bookings.map((booking) => ({
    start: booking.start.getTime(),
    end: booking.end.getTime() + bufferMs,
  }))
  const external: Range[] = busy.map((interval) => ({
    start: interval.start.getTime(),
    end: interval.end.getTime(),
  }))

  const slots: Slot[] = []
  const seen = new Set<number>()

  for (let offset = 0; offset < settings.horizonDays; offset++) {
    const date = addDays(today, offset)
    if ((bookingsPerDay.get(date) ?? 0) >= settings.dailyCap) continue
    if (exceptions.some((absence) => absence.startDate <= date && date <= absence.endDate)) continue

    const weekday = isoWeekday(date)
    for (const rule of rules.filter((candidate) => candidate.weekday === weekday)) {
      const ruleEnd = timeToMinutes(rule.end)
      for (
        let minute = timeToMinutes(rule.start);
        minute + settings.durationMinutes <= ruleEnd;
        minute += step
      ) {
        const localTime = minutesToTime(minute)
        const start = zonedTimeToUtc(date, localTime, settings.timeZone).getTime()
        const occupiedEnd = start + durationMs + bufferMs
        if (start < earliest || seen.has(start)) continue
        if (overlapsAny(start, occupiedEnd, taken)) continue
        if (overlapsAny(start, occupiedEnd, external)) continue
        seen.add(start)
        slots.push({
          start: new Date(start),
          end: new Date(start + durationMs),
          localDate: date,
          localTime,
        })
      }
    }
  }

  return slots.sort((x, y) => x.start.getTime() - y.start.getTime())
}
```

- [ ] **Step 5 : Vérifier qu'il passe**

Run : `npm run test:unit`
Attendu : `ℹ tests 30`, `ℹ pass 30`, `ℹ fail 0`.

- [ ] **Step 6 : Commit**

```bash
git add src/lib/booking/settings.ts src/lib/booking/slots.ts tests/unit/slots.test.ts
git commit -m "Calculer les créneaux réservables de Cat (3.8, partie A)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4 : Contrôles du projet, documentation, PR

**Files :**
- Modify : `README.md` (table des commandes)
- Modify : `CLAUDE.md` (bloc « Commandes »)
- Modify : `docs/plan-implementation.md` (story 3.8)
- Modify : `docs/reservation-appel.md` (§4.3)

- [ ] **Step 1 : Lancer tous les contrôles du projet**

```bash
npm run lint && npm run typecheck && npm run format:check && npm run test:unit && npm run build
```

Attendu : tout passe. Si `format:check` échoue, lancer `npx prettier --write src/lib/booking tests/unit`, relancer, puis ajouter les fichiers au commit de l'étape 6.

- [ ] **Step 2 : Documenter la commande dans le README**

Dans `README.md`, dans la table des commandes, juste après la ligne de `npm run test:a11y` (« axe, WCAG 2.2 AA ») :

```markdown
| `npm run test:unit` | Tests unitaires (testeur intégré de Node) : calcul des créneaux de la réservation d'appel |
```

- [ ] **Step 3 : Documenter la commande dans `CLAUDE.md`**

Dans le bloc « Commandes », juste après la ligne `npm run test:a11y          # axe, WCAG 2.2 AA, FR et EN` :

```bash
npm run test:unit          # tests unitaires (node --test) : calcul des créneaux
```

- [ ] **Step 4 : Noter l'état de la story 3.8**

Dans `docs/plan-implementation.md`, juste après la ligne qui commence par `**CA** : réglages par défaut de la spec §3.1 (plafond 4 par jour)` :

```markdown
*Partie A livrée (moteur sans base)* : `src/lib/booking/` (`zoned-time`, `belgian-holidays`, `settings`, `slots`), 30 tests unitaires lancés en CI par `npm run test:unit`. *Partie B* (tables, page `/coffre/disponibilites`, validation Zod des réglages) après la story 3.2.
```

- [ ] **Step 5 : Trancher la gestion des fuseaux dans la spec**

Dans `docs/reservation-appel.md` §4.3, remplacer :

```markdown
Gestion des fuseaux : `Temporal` natif s'il est disponible dans Node 24 au moment de la story, sinon une petite bibliothèque, justifiée par écrit.
```

par :

```markdown
Gestion des fuseaux : API `Intl`, sans dépendance (`src/lib/booking/zoned-time.ts`) ; Node 24 n'a pas `Temporal` (vérifié le 06/11/2026).
```

- [ ] **Step 6 : Commit et push**

```bash
git add README.md CLAUDE.md docs/plan-implementation.md docs/reservation-appel.md
git commit -m "Documenter les tests unitaires et la partie A de la story 3.8

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -u origin story/3.8a-calcul-creneaux
```

- [ ] **Step 7 : Ouvrir la PR, attendre la CI, fusionner**

```bash
gh pr create --base main --head story/3.8a-calcul-creneaux \
  --title "Calculer les créneaux réservables de Cat (3.8, partie A)" \
  --body "Moteur de la réservation d'appel (D57), sans base : heures locales par Intl, jours fériés belges, réglages par défaut (4 appels par jour), calcul des créneaux. 30 tests unitaires, lancés en CI. Aucune nouvelle dépendance, aucun écran.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks --watch
```

Attendu : la CI passe, y compris la nouvelle étape `npm run test:unit` sur Node 24. Puis `gh pr merge --merge` (règle D22 : fusion quand la CI est verte). Aucune capture d'écran : la story n'a pas d'interface.

---

## Couverture de la spec

| Exigence (`docs/reservation-appel.md`) | Tâche |
|---|---|
| §3.1 réglages par défaut, plafond 4 | Task 3 (`settings.ts`, tests plafond) |
| §3.1 jours fériés belges préremplis | Task 2 ; utilisés comme absences dans Task 3 |
| §4.2 occupation [début, fin + pause) | Task 3 (tests « pause comprise », « hors grille ») |
| §4.3 semaine type, absences, réservations, heures occupées, délai, horizon, plafond | Task 3 |
| §4.3 fuseau de Bruxelles, changements d'heure | Tasks 1 et 3 |
| §6 tests unitaires avec `node --test`, sans dépendance | Tasks 1 à 3, CI en Task 1 |
| §3.1 réglages modifiables dans le coffre, §4.1 tables | **Hors de ce plan** : partie B, après 3.2 |
