-- Réservation d'appel (story 3.10 ; docs/reservation-appel.md §4.1, §4.2, §4.4). Deux tables : les
-- jetons des liens personnels (empreinte seule) et les réservations (créneau et statut en clair, la
-- personne scellée avec la clé publique du coffre, comme une demande). Numéro 0008 : 0006 est réservé
-- à la boîte d'envoi (story 3.3), sans rapport avec ces tables.

-- Liens personnels. Le jeton (32 octets aléatoires, base64url) n'est jamais en base : seulement son
-- empreinte SHA-256, qui suffit à le retrouver et ne permet pas de le reconstituer.
-- `access` : lien de réservation, 48 heures au plus, réutilisable jusqu'à la réservation (`used_at`).
-- `manage` : lien de gestion (déplacer, annuler), story 3.11.
-- `email_hmac` : HMAC-SHA256 de l'adresse normalisée (story 3.9). Vide tant que la demande de lien
-- n'existe pas : un lien créé depuis le coffre n'a pas de cible.
create table booking_tokens (
  id uuid primary key,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  purpose text not null default 'access' check (purpose in ('access', 'manage')),
  email_hmac bytea check (email_hmac is null or octet_length(email_hmac) = 32),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  constraint booking_tokens_expiry_check check (expires_at > created_at),
  constraint booking_tokens_access_ttl_check check (
    purpose <> 'access' or expires_at <= created_at + interval '48 hours'
  )
);

-- Un nouveau lien annule l'ancien pour une même adresse (§4.4) : un seul lien d'accès vivant (ni
-- utilisé, ni annulé) par cible. La création annule d'abord les précédents, sous verrou consultatif.
create unique index booking_tokens_live_access_idx on booking_tokens (email_hmac)
  where purpose = 'access' and email_hmac is not null and used_at is null and revoked_at is null;
-- Purge des jetons 7 jours après leur expiration (tâche quotidienne, story 3.12).
create index booking_tokens_expires_idx on booking_tokens (expires_at);

-- Réservations. En clair : le créneau et le statut (le calcul des créneaux et la contrainte
-- d'exclusion en ont besoin), la version de la politique acceptée (preuve du consentement, comme
-- `vault_requests.privacy_version`), l'échéance de conservation. Scellé (sealed box, taille fixe de
-- 2 Kio, 2 096 octets) : nom, numéro, langue de l'appel, choix SMS, origine.
-- `slot` : début → fin de l'appel + pause en vigueur au moment de la réservation (§4.3) ; une pause
-- changée ensuite ne déplace rien. `access_token_id` : le lien qui a servi ; unique, un jeton ne crée
-- jamais deux réservations (double clic, renvoi du formulaire). Il survit à la purge du jeton (nul).
-- Statuts (§3.2) : confirmé, fait, pas de réponse, annulé par la personne, annulé par la maison ;
-- « à qualifier » se déduit (confirmé, heure de fin passée).
create table bookings (
  id uuid primary key,
  access_token_id uuid unique references booking_tokens (id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  slot tstzrange not null,
  status text not null default 'confirmed' check (
    status in ('confirmed', 'done', 'no_answer', 'cancelled_by_guest', 'cancelled_by_house')
  ),
  created_at timestamptz not null default now(),
  privacy_version text not null check (length(privacy_version) between 1 and 40),
  retention_until timestamptz not null,
  sealed bytea not null check (octet_length(sealed) = 2096),
  constraint bookings_time_check check (starts_at < ends_at),
  constraint bookings_slot_check check (
    coalesce(
      lower(slot) = starts_at and upper(slot) >= ends_at and lower_inc(slot) and not upper_inc(slot),
      false
    )
  ),
  -- Un créneau ne se prend qu'une fois (§4.2) : deux appels confirmés ne se chevauchent jamais, pause
  -- comprise, même validés à la même seconde. Une seule colonne de plage : l'opérateur && a sa classe
  -- GiST native, l'extension btree_gist n'est pas nécessaire (elle ne servirait qu'à ajouter une
  -- colonne scalaire comparée par =).
  constraint bookings_no_overlap exclude using gist (slot with &&) where (status = 'confirmed')
);

create index bookings_starts_at_idx on bookings (starts_at);
create index bookings_retention_idx on bookings (retention_until);

-- Journal d'accès : `booking_link`, création d'un lien de réservation depuis le coffre (pont en
-- attendant l'e-mail de la story 3.9), au nom du compte, sans demande visée et sans aucune valeur
-- (ni le jeton, ni son empreinte). Liste complète, recopiée de 0007 (`availability` compris) : la
-- boîte d'envoi (0006, autre session) redéfinit aussi cette contrainte ; la seconde fusionnée des deux
-- réunit les listes (une migration appliquée plus tard ne doit retirer aucune action).
alter table vault_access_log drop constraint vault_access_log_action_check;
alter table vault_access_log add constraint vault_access_log_action_check check (
  action in (
    'login', 'login_backup_code', 'login_failed', 'password_ok', 'totp_enrolled',
    'rate_limited', 'logout', 'list',
    'read', 'export', 'delete', 'purge', 'freeze', 'unfreeze', 'retention',
    'availability',
    'booking_link'
  )
);

alter table vault_access_log add constraint vault_access_log_booking_link_check check (
  action <> 'booking_link' or request_id is null
);
