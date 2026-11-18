import { randomUUID } from 'node:crypto'

import { getEnvoiPool } from '../db/pool.ts'
import type { EmailConfig } from '../email/config.ts'
import { createTemTransport } from '../email/tem.ts'
import type { OutboxDeps } from './process.ts'

// Dépendances de la boîte d'envoi en production (story 3.3), partagées par le premier essai
// (Server Action du formulaire, `after()`) et la tâche planifiée (`/api/cron/envoi`) :
// - le pool du rôle `envoi` (ENVOI_DATABASE_URL), un seul par processus ; lève si la variable
//   manque ou est refusée : à l'appelant de n'en retenir qu'un statut ;
// - le transport TEM tiré de la configuration des e-mails (`emailConfigFromEnv`, non nulle) ;
// - l'horloge et les identifiants des alertes (`randomUUID`) ;
// - le journal : `[envoi] <statut> <identifiant du message>`, jamais une adresse, un sujet, une
//   réponse du prestataire ni un message d'erreur.
// Imports relatifs seulement : testé par node --test.

export function createOutboxDeps(config: EmailConfig): OutboxDeps {
  return {
    pool: getEnvoiPool(),
    transport: createTemTransport({
      secretKey: config.temSecretKey,
      projectId: config.temProjectId,
    }),
    config,
    now: () => new Date(),
    newId: () => randomUUID(),
    log: (status, id) => console.info(`[envoi] ${status} ${id}`),
  }
}
