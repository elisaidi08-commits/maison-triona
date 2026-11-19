import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { emailConfigFromEnv } from '../../src/lib/email/config.ts'
import type { EmailConfig } from '../../src/lib/email/config.ts'
import type { Pool } from 'pg'

import {
  applyNotificationCap,
  CAP_ALERT_TTL_SECONDS,
  capAlertKey,
  NOTIFICATIONS_PAR_JOUR,
  notificationSetup,
  scheduleCapAlert,
  scheduleFirstAttempts,
  storedStatuses,
} from '../../src/lib/outbox/notify-request.ts'
import type { CapAlertDeps, FirstAttemptDeps } from '../../src/lib/outbox/notify-request.ts'
import type { OutboxDeps } from '../../src/lib/outbox/process.ts'

// Branchement de l'envoi sur la demande (story 3.3), sans Next : configuration lue avant
// l'écriture, statuts après l'écriture, premier essai posé avec `after`. Rien ne doit lever vers
// la Server Action (la demande est déjà enregistrée), et aucun journal ne porte un secret ni une
// adresse. Données factices.

const SECRET = 'cle-tem-secrete-factice'
const ADRESSES = ['no-reply@example.test', 'cat@example.test', 'sady@example.test']
const ENV_COMPLET = {
  TEM_SECRET_KEY: SECRET,
  TEM_PROJECT_ID: '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b',
  EMAIL_FROM: `Maison Triona <${ADRESSES[0]}>`,
  EMAIL_NOTIFY_TO: ADRESSES[1],
  EMAIL_ALERT_TO: ADRESSES[2],
  SITE_URL: 'https://maisontriona.example',
}
const ENV_PARTIEL = { TEM_SECRET_KEY: SECRET, EMAIL_NOTIFY_TO: ADRESSES[1] }
const ENV_INVALIDE = { ...ENV_COMPLET, TEM_PROJECT_ID: 'pas-un-uuid' }
const CONFIG = emailConfigFromEnv(ENV_COMPLET) as EmailConfig
const IDS = ['0b0c6a8e-1d2f-4a3b-8c4d-5e6f7a8b9c0d', '1c1d7b9f-2e3a-4b4c-9d5e-6f7a8b9c0d1e']

// Journal « une fois par instance », comme celui de la Server Action.
function journalUneFois() {
  const cles = new Set<string>()
  const appels: [string, string][] = []
  const lignes: string[] = []
  return {
    appels,
    lignes,
    logOnce: (cle: string, statut: string) => {
      appels.push([cle, statut])
      if (cles.has(cle)) return
      cles.add(cle)
      lignes.push(statut)
    },
  }
}

// Dépendances factices du premier essai : `after` garde les tâches, à lancer par le test.
function premierEssai(options: { createDeps?: () => OutboxDeps; afterThrows?: number[] } = {}) {
  const taches: (() => Promise<void>)[] = []
  const envois: [OutboxDeps, string][] = []
  const crees: EmailConfig[] = []
  const journal: string[] = []
  const once = journalUneFois()
  let appelsAfter = 0
  const deps: FirstAttemptDeps = {
    after: (tache) => {
      appelsAfter += 1
      if (options.afterThrows?.includes(appelsAfter)) {
        throw new Error(`after hors requête : ${ADRESSES[1]} ${SECRET}`)
      }
      taches.push(tache)
    },
    createDeps: (config) => {
      crees.push(config)
      return options.createDeps
        ? options.createDeps()
        : ({ marque: 'deps' } as unknown as OutboxDeps)
    },
    sendNow: async (outboxDeps, id) => {
      envois.push([outboxDeps, id])
    },
    log: (statut) => {
      journal.push(statut)
    },
    logOnce: once.logOnce,
  }
  return { deps, taches, envois, crees, journal, once }
}

describe('notificationSetup', () => {
  it('configuration vide : envoi coupé, `mail:disabled` une fois par instance', () => {
    const journal = journalUneFois()
    for (let i = 0; i < 3; i += 1) {
      assert.deepEqual(notificationSetup({}, journal.logOnce), { notify: false, config: null })
    }
    assert.deepEqual(journal.appels, [
      ['e-mails', 'mail:disabled'],
      ['e-mails', 'mail:disabled'],
      ['e-mails', 'mail:disabled'],
    ])
    assert.deepEqual(journal.lignes, ['mail:disabled'])
  })

  it('configuration à moitié posée ou invalide : pas de notification, `failed:config` une fois', () => {
    for (const env of [ENV_PARTIEL, ENV_INVALIDE]) {
      const journal = journalUneFois()
      assert.deepEqual(notificationSetup(env, journal.logOnce), { notify: false, config: null })
      assert.deepEqual(notificationSetup(env, journal.logOnce), { notify: false, config: null })
      assert.deepEqual(journal.lignes, ['failed:config'])
      assert.ok(journal.appels.every(([cle]) => cle === 'e-mails'))
    }
  })

  it('configuration complète : notification, configuration lue, aucun journal', () => {
    const journal = journalUneFois()
    assert.deepEqual(notificationSetup(ENV_COMPLET, journal.logOnce), {
      notify: true,
      config: CONFIG,
    })
    assert.deepEqual(journal.appels, [])
  })
})

describe('storedStatuses', () => {
  it('notification écrite : `stored` puis `queued`', () => {
    assert.deepEqual(storedStatuses({ id: IDS[0]!, outbox: [IDS[1]!], notifyFailed: false }), [
      'stored',
      'queued',
    ])
  })

  it('notification refusée : `failed:outbox` à chaque demande, jamais une fois par instance', () => {
    const resultat = { id: IDS[0]!, outbox: [], notifyFailed: true }
    assert.deepEqual(storedStatuses(resultat), ['stored', 'failed:outbox'])
    assert.deepEqual(storedStatuses(resultat), ['stored', 'failed:outbox'])
  })

  it('sans notification demandée : `stored` seulement', () => {
    assert.deepEqual(storedStatuses({ id: IDS[0]!, outbox: [], notifyFailed: false }), ['stored'])
  })
})

describe('scheduleFirstAttempts', () => {
  it('un `after` par message ; chaque tâche crée les dépendances et envoie ce message', async () => {
    const t = premierEssai()
    scheduleFirstAttempts(IDS, CONFIG, t.deps)
    assert.equal(t.taches.length, 2)
    // Rien ne part avant la fin de la réponse.
    assert.equal(t.envois.length, 0)
    for (const tache of t.taches) await tache()
    assert.deepEqual(t.crees, [CONFIG, CONFIG])
    assert.deepEqual(
      t.envois.map(([, id]) => id),
      IDS,
    )
    assert.deepEqual(t.journal, [])
    assert.deepEqual(t.once.appels, [])
  })

  it('aucun message : aucun `after`', () => {
    const t = premierEssai()
    scheduleFirstAttempts([], CONFIG, t.deps)
    assert.equal(t.taches.length, 0)
  })

  it('dépendances impossibles à créer : la tâche ne lève pas, `failed:config` une fois', async () => {
    const t = premierEssai({
      createDeps: () => {
        throw new Error(`ENVOI_DATABASE_URL manquante ${SECRET}`)
      },
    })
    scheduleFirstAttempts(IDS, CONFIG, t.deps)
    for (const tache of t.taches) await assert.doesNotReject(tache())
    assert.deepEqual(t.envois, [])
    assert.deepEqual(t.once.appels, [
      ['envoi', 'failed:config'],
      ['envoi', 'failed:config'],
    ])
    assert.deepEqual(t.once.lignes, ['failed:config'])
  })

  it('un envoi qui lèverait malgré son contrat ne fait pas lever la tâche', async () => {
    const t = premierEssai()
    t.deps.sendNow = async () => {
      throw new Error(`réponse inattendue ${ADRESSES[1]}`)
    }
    scheduleFirstAttempts(IDS, CONFIG, t.deps)
    for (const tache of t.taches) await assert.doesNotReject(tache())
  })

  it('`after` qui lève : rien ne remonte, `failed:after` à chaque fois, les autres posés', () => {
    const t = premierEssai({ afterThrows: [1] })
    assert.doesNotThrow(() => scheduleFirstAttempts(IDS, CONFIG, t.deps))
    assert.deepEqual(t.journal, ['failed:after'])
    assert.equal(t.taches.length, 1)

    const toujours = premierEssai({ afterThrows: [1, 2] })
    assert.doesNotThrow(() => scheduleFirstAttempts(IDS, CONFIG, toujours.deps))
    assert.deepEqual(toujours.journal, ['failed:after', 'failed:after'])
  })

  it('un journal qui lève ne fait rien remonter non plus', async () => {
    const t = premierEssai({
      afterThrows: [1],
      createDeps: () => {
        throw new Error('dépendances absentes')
      },
    })
    t.deps.log = () => {
      throw new Error('journal en panne')
    }
    t.deps.logOnce = () => {
      throw new Error('journal en panne')
    }
    assert.doesNotThrow(() => scheduleFirstAttempts(IDS, CONFIG, t.deps))
    for (const tache of t.taches) await assert.doesNotReject(tache())
  })
})

describe('journaux du branchement', () => {
  it('aucun secret ni aucune adresse, quel que soit le cas', async () => {
    const vus: unknown[] = []
    const logOnce = (...args: unknown[]) => {
      vus.push(args)
    }
    for (const env of [{}, ENV_PARTIEL, ENV_INVALIDE, ENV_COMPLET]) notificationSetup(env, logOnce)
    vus.push(storedStatuses({ id: IDS[0]!, outbox: [], notifyFailed: true }))
    vus.push(storedStatuses({ id: IDS[0]!, outbox: [IDS[1]!], notifyFailed: false }))
    const t = premierEssai({
      afterThrows: [1],
      createDeps: () => {
        throw new Error(`échec ${SECRET} ${ADRESSES[2]}`)
      },
    })
    t.deps.log = (...args: unknown[]) => {
      vus.push(args)
    }
    t.deps.logOnce = logOnce
    scheduleFirstAttempts(IDS, CONFIG, t.deps)
    for (const tache of t.taches) await tache()

    const texte = JSON.stringify(vus)
    assert.match(texte, /failed:config/)
    assert.match(texte, /failed:after/)
    for (const interdit of [SECRET, ...ADRESSES, '@', 'manquante', 'Configuration']) {
      assert.ok(!texte.includes(interdit), interdit)
    }
  })
})

// Plafond quotidien des notifications : au-delà, la demande est gardée sans notification.
describe('applyNotificationCap', () => {
  it('fixe le plafond à vingt notifications par jour', () => {
    assert.equal(NOTIFICATIONS_PAR_JOUR, 20)
  })
  it('laisse passer une notification dans le plafond', () => {
    assert.deepEqual(applyNotificationCap(true, 'autorise'), { notify: true, status: null })
  })
  it('coupe la notification au-delà du plafond et journalise', () => {
    assert.deepEqual(applyNotificationCap(true, 'depasse'), {
      notify: false,
      status: 'alert:notify-cap',
    })
  })
  it('laisse passer quand le compteur est indisponible (échec ouvert)', () => {
    assert.deepEqual(applyNotificationCap(true, 'indisponible'), { notify: true, status: null })
  })
  it("ne change rien quand il n'y a pas de notification", () => {
    for (const quota of ['autorise', 'depasse', 'indisponible'] as const) {
      assert.deepEqual(applyNotificationCap(false, quota), { notify: false, status: null })
    }
  })
})

// Alerte à Sady au premier dépassement du jour (3.3, suites, décision de Sady du 19/11/2026) : la
// Server Action pose une clé d'usage unique du jour ; seul `nouveau` (clé posée par cet appel)
// déclenche l'alerte, écrite par le rôle `envoi` dans un `after`, puis envoyée tout de suite.
const ALERTE_ID = '2d2e8cab-3f4b-4c5d-8e6f-7a8b9c0d1e2f'
// Identifiant d'une demande : il ne doit jamais apparaître dans un journal de l'alerte.
const DEMANDE_ID = IDS[0]!

function alertePlafond(
  options: {
    afterThrows?: boolean
    createDeps?: () => OutboxDeps
    enqueue?: (pool: Pool, id: string) => Promise<void>
  } = {},
) {
  const taches: (() => Promise<void>)[] = []
  const ecrites: [Pool, string][] = []
  const envois: [OutboxDeps, string][] = []
  const crees: EmailConfig[] = []
  const journal: string[] = []
  const once = journalUneFois()
  const pool = { marque: 'pool-envoi' } as unknown as Pool
  const outboxDeps = { pool, newId: () => ALERTE_ID } as unknown as OutboxDeps
  const deps: CapAlertDeps = {
    after: (tache) => {
      if (options.afterThrows) throw new Error(`after hors requête : ${ADRESSES[2]} ${SECRET}`)
      taches.push(tache)
    },
    createDeps: (config) => {
      crees.push(config)
      return options.createDeps ? options.createDeps() : outboxDeps
    },
    enqueue:
      options.enqueue ??
      (async (p, id) => {
        ecrites.push([p, id])
      }),
    sendNow: async (d, id) => {
      envois.push([d, id])
    },
    log: (statut) => {
      journal.push(statut)
    },
    logOnce: once.logOnce,
  }
  return { deps, taches, ecrites, envois, crees, journal, once, pool, outboxDeps }
}

describe('alerte du plafond : clé du jour', () => {
  it('une clé par jour UTC, sans autre donnée que la date', () => {
    assert.equal(capAlertKey(new Date('2026-11-19T00:00:00Z')), 'notif-plafond:2026-11-19')
    assert.equal(capAlertKey(new Date('2026-11-19T23:59:59Z')), 'notif-plafond:2026-11-19')
    assert.equal(capAlertKey(new Date('2026-11-20T00:00:00Z')), 'notif-plafond:2026-11-20')
  })
  it('gardée deux jours', () => {
    assert.equal(CAP_ALERT_TTL_SECONDS, 2 * 24 * 60 * 60)
  })
})

describe('scheduleCapAlert', () => {
  it('premier dépassement : un `after`, puis l’alerte écrite par l’envoi et envoyée aussitôt', async () => {
    const t = alertePlafond()
    scheduleCapAlert('nouveau', CONFIG, t.deps)
    assert.equal(t.taches.length, 1)
    assert.deepEqual(t.journal, ['alert:notify-cap-sent'])
    // Rien ne s'écrit ni ne part avant la fin de la réponse.
    assert.deepEqual(t.ecrites, [])
    await t.taches[0]!()
    assert.deepEqual(t.crees, [CONFIG])
    assert.deepEqual(t.ecrites, [[t.pool, ALERTE_ID]])
    assert.deepEqual(t.envois, [[t.outboxDeps, ALERTE_ID]])
    assert.deepEqual(t.journal, ['alert:notify-cap-sent'])
    assert.deepEqual(t.once.appels, [])
  })

  it('tout autre résultat de la clé : aucune alerte (échec fermé, jamais de rafale)', () => {
    for (const statut of ['deja-vu', 'inactif', 'reseau', 'config', 'reponse', '']) {
      const t = alertePlafond()
      scheduleCapAlert(statut, CONFIG, t.deps)
      assert.equal(t.taches.length, 0, statut)
      assert.deepEqual(t.journal, [], statut)
    }
  })

  it('`after` qui lève : rien ne remonte, `failed:after`', () => {
    const t = alertePlafond({ afterThrows: true })
    assert.doesNotThrow(() => scheduleCapAlert('nouveau', CONFIG, t.deps))
    assert.deepEqual(t.journal, ['failed:after'])
  })

  it('dépendances impossibles à créer : rien ne s’écrit, `failed:config` une fois', async () => {
    const t = alertePlafond({
      createDeps: () => {
        throw new Error(`ENVOI_DATABASE_URL manquante ${SECRET}`)
      },
    })
    scheduleCapAlert('nouveau', CONFIG, t.deps)
    await assert.doesNotReject(t.taches[0]!())
    assert.deepEqual(t.ecrites, [])
    assert.deepEqual(t.envois, [])
    assert.deepEqual(t.once.appels, [['envoi', 'failed:config']])
    assert.deepEqual(t.once.lignes, ['failed:config'])
  })

  it('écriture refusée : rien ne part ni ne remonte, `failed:notify-cap-alert`', async () => {
    const t = alertePlafond({
      enqueue: async () => {
        throw new Error(`permission refusée ${ADRESSES[2]}`)
      },
    })
    scheduleCapAlert('nouveau', CONFIG, t.deps)
    await assert.doesNotReject(t.taches[0]!())
    assert.deepEqual(t.envois, [])
    assert.deepEqual(t.journal, ['alert:notify-cap-sent', 'failed:notify-cap-alert'])
  })

  it('un envoi ou un journal qui lèvent ne font rien remonter', async () => {
    const t = alertePlafond()
    t.deps.sendNow = async () => {
      throw new Error('contrat rompu')
    }
    t.deps.log = () => {
      throw new Error('journal en panne')
    }
    assert.doesNotThrow(() => scheduleCapAlert('nouveau', CONFIG, t.deps))
    await assert.doesNotReject(t.taches[0]!())

    const panne = alertePlafond({
      afterThrows: true,
      createDeps: () => {
        throw new Error('dépendances absentes')
      },
    })
    panne.deps.log = () => {
      throw new Error('journal en panne')
    }
    assert.doesNotThrow(() => scheduleCapAlert('nouveau', CONFIG, panne.deps))

    const sansDeps = alertePlafond({
      createDeps: () => {
        throw new Error('dépendances absentes')
      },
    })
    sansDeps.deps.logOnce = () => {
      throw new Error('journal en panne')
    }
    scheduleCapAlert('nouveau', CONFIG, sansDeps.deps)
    await assert.doesNotReject(sansDeps.taches[0]!())
  })

  it('journaux : des statuts fixes, jamais une demande, une adresse ni un secret', async () => {
    const vus: unknown[] = []
    const cas = [
      alertePlafond(),
      alertePlafond({ afterThrows: true }),
      alertePlafond({
        createDeps: () => {
          throw new Error(`échec ${SECRET} ${ADRESSES[1]} ${DEMANDE_ID}`)
        },
      }),
      alertePlafond({
        enqueue: async () => {
          throw new Error(`refus ${SECRET} ${ADRESSES[2]} ${DEMANDE_ID}`)
        },
      }),
    ]
    for (const t of cas) {
      t.deps.log = (...args: unknown[]) => {
        vus.push(args)
      }
      t.deps.logOnce = (...args: unknown[]) => {
        vus.push(args)
      }
      scheduleCapAlert('nouveau', CONFIG, t.deps)
      for (const tache of t.taches) await tache()
    }
    const texte = JSON.stringify(vus)
    for (const attendu of [
      'alert:notify-cap-sent',
      'failed:after',
      'failed:config',
      'failed:notify-cap-alert',
    ]) {
      assert.ok(texte.includes(attendu), attendu)
    }
    for (const interdit of [SECRET, ...ADRESSES, DEMANDE_ID, ALERTE_ID, '@', 'manquante']) {
      assert.ok(!texte.includes(interdit), interdit)
    }
  })
})
