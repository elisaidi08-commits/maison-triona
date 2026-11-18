import type { Pool } from 'pg'

import { withTransaction } from '../db/transaction.ts'
import type { Demande } from '../validation/demande.ts'
import { insertRequest, VaultError, type NewVaultRequest } from './repository.ts'
import { RETENTION_MONTHS, retentionDeadline } from './retention.ts'
import { sealRequest, VaultKeyError, type SealedFields } from './seal.ts'

// Enregistrement d'une demande valide dans le coffre (story 3.2, partie B ; docs/architecture.md
// §6.5). Colonnes en clair = colonnes de tri, rien de personnel : type, service, pays, langue de
// réponse, urgence, origine. Tout le reste (nom, e-mail, téléphone, « pour qui », créneau, mot
// libre) est scellé avec la clé publique avant d'atteindre la base. Écrit dans une transaction :
// la boîte d'envoi des e-mails (story 3.3) s'y ajoutera.
// Ni le consentement (requis : toute demande enregistrée l'a donné) ni la langue de l'interface ne
// sont gardés. Aucune erreur levée ne cite un champ (VaultKeyError, VaultError).
// Imports relatifs seulement : testé par node --test.

export type ClearColumns = Omit<NewVaultRequest, 'sealed' | 'retentionUntil'>

export function splitRequest(demande: Demande): { clear: ClearColumns; sealed: SealedFields } {
  return {
    clear: {
      kind: 'request',
      service: demande.besoin,
      country: demande.pays,
      locale: demande.langue,
      urgency: demande.urgence,
      source: demande.origine ?? null,
    },
    sealed: {
      nom: demande.nom,
      email: demande.email ?? null,
      telephone: demande.telephone ?? null,
      pourQui: demande.pourQui ?? null,
      creneau: demande.creneau ?? null,
      message: demande.message ?? null,
    },
  }
}

/** Scelle puis enregistre la demande ; renvoie son identifiant. */
export async function storeRequest(
  pool: Pool,
  demande: Demande,
  publicKeyBase64: string,
  now: Date,
): Promise<string> {
  const { clear, sealed } = splitRequest(demande)
  const octets = await sealRequest(sealed, publicKeyBase64)
  const retentionUntil = retentionDeadline(now, RETENTION_MONTHS)
  try {
    return await withTransaction(pool, (client) =>
      insertRequest(client, { ...clear, sealed: octets, retentionUntil }),
    )
  } catch (error) {
    // Connexion refusée, transaction annulée : on ne garde que le code, jamais le message brut.
    if (error instanceof VaultError || error instanceof VaultKeyError) throw error
    throw new VaultError('storeRequest', error)
  }
}
