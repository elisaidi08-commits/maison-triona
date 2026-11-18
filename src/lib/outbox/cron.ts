import { emailConfigFromEnv } from '../email/config.ts'
import type { EmailConfig } from '../email/config.ts'
import { cronAutorise } from '../security/cron.ts'
import type { OutboxDeps, OutboxRunSummary } from './process.ts'

// Logique testable de la route `/api/cron/envoi` (story 3.3), sans import de Next.
// Ordre : autorisation, configuration (envoi coupé = rien à faire), dépendances, passe.
// Le journal ne porte qu'un statut de route : jamais le secret ni un message d'erreur ; le corps
// de la réponse ne contient que des nombres.
// Imports relatifs seulement : testé par node --test.

export interface CronResult {
  status: 200 | 204 | 401 | 500 | 503
  body: OutboxRunSummary | null
}

export async function runCronPass(input: {
  authorization: string | null
  env: Record<string, string | undefined>
  createDeps: (config: EmailConfig) => OutboxDeps
  run: (deps: OutboxDeps) => Promise<OutboxRunSummary>
  log: (status: string) => void
}): Promise<CronResult> {
  const { authorization, env, createDeps, run, log } = input

  if (!cronAutorise(authorization, env.CRON_SECRET)) {
    log('rejected:cron')
    return { status: 401, body: null }
  }

  let config: EmailConfig | null
  try {
    config = emailConfigFromEnv(env)
  } catch {
    log('failed:config')
    return { status: 503, body: null }
  }
  // Envoi coupé : les demandes restent dans le coffre, rien à reprendre.
  if (config === null) return { status: 204, body: null }

  let deps: OutboxDeps
  try {
    deps = createDeps(config)
  } catch {
    log('failed:config')
    return { status: 503, body: null }
  }

  try {
    return { status: 200, body: await run(deps) }
  } catch {
    log('failed:run')
    return { status: 500, body: null }
  }
}
