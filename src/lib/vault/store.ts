import { randomUUID } from 'node:crypto'

import type { Pool } from 'pg'

import { withTransaction } from '../db/transaction.ts'
import { enqueueNotification } from '../outbox/repository.ts'
import type { Demande } from '../validation/demande.ts'
import { insertRequest, VaultError, type NewVaultRequest } from './repository.ts'
import { RETENTION_MONTHS, retentionDeadline } from './retention.ts'
import { sealRequest, VaultKeyError, type SealedFields } from './seal.ts'

// Enregistrement d'une demande valide dans le coffre (story 3.2, partie B ; docs/architecture.md
// §6.5). Colonnes en clair = colonnes de tri, rien de personnel : type, service, pays, langue de
// réponse, urgence, origine. Tout le reste (nom, e-mail, téléphone, « pour qui », créneau, mot
// libre) est scellé avec la clé publique avant d'atteindre la base.
// Notification (story 3.3) : avec `notify`, la ligne de la boîte d'envoi (un gabarit, des
// identifiants, la priorité) est écrite dans la MÊME transaction que la demande : les deux, ou
// aucune. Identifiants tirés ici (`randomUUID`) : le rôle `site_public` insère sans RETURNING.
// Prioritaire seulement pour l'urgence « urgent ».
// Consentement : la version de la politique acceptée (`privacy_version`) et la date (`created_at`).
// La langue de l'interface n'est pas gardée. Aucune erreur levée ne cite un champ (VaultKeyError,
// VaultError, RangeError si le texte dépasse 16 Kio).
// Imports relatifs seulement : testé par node --test.

export type ClearColumns = Omit<NewVaultRequest, 'sealed' | 'retentionUntil' | 'privacyVersion'>

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

export interface StoreOptions {
  /** Clé publique du coffre, base64 (`VAULT_PUBLIC_KEY`). */
  publicKey: string
  /** Version de la politique de confidentialité acceptée (`PRIVACY_POLICY_VERSION`). */
  privacyVersion: string
  now: Date
  /** Écrire la notification à Cat dans la boîte d'envoi (faux quand l'envoi est coupé). */
  notify: boolean
}

export interface StoredRequest {
  /** Identifiant de la demande. */
  id: string
  /** Identifiants des messages écrits dans la boîte d'envoi (vide sans notification). */
  outbox: string[]
}

/** Scelle puis enregistre la demande, et sa notification si `notify`, dans une transaction. */
export async function storeRequest(
  pool: Pool,
  demande: Demande,
  { publicKey, privacyVersion, now, notify }: StoreOptions,
): Promise<StoredRequest> {
  const { clear, sealed } = splitRequest(demande)
  const octets = await sealRequest(sealed, publicKey)
  const retentionUntil = retentionDeadline(now, RETENTION_MONTHS)
  try {
    return await withTransaction(pool, async (client) => {
      const id = await insertRequest(client, {
        ...clear,
        sealed: octets,
        retentionUntil,
        privacyVersion,
      })
      if (!notify) return { id, outbox: [] }
      const outboxId = randomUUID()
      await enqueueNotification(client, {
        id: outboxId,
        requestId: id,
        priority: demande.urgence === 'urgent',
      })
      return { id, outbox: [outboxId] }
    })
  } catch (error) {
    // Connexion refusée, transaction annulée : on ne garde que le code, jamais le message brut.
    if (error instanceof VaultError || error instanceof VaultKeyError) throw error
    throw new VaultError('storeRequest', error)
  }
}
