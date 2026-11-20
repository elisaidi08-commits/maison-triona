-- Déplacer et annuler un appel (story 3.11 ; docs/reservation-appel.md §2, étape 6, §3.2, §4.1, §4.5).
-- Numéro 0014 : 0012 est réservé à l'alerte du plafond des liens (PR #84), 0013 est l'agenda (3.13).
-- 1. Séquence des invitations (`sequence`) : 0 à la réservation, +1 à chaque déplacement et à
--    l'annulation (RFC 5545 : même UID, séquence plus grande, l'agenda remplace l'événement). Posée
--    par les déclencheurs ci-dessous, jamais par l'application : aucun rôle n'a le droit d'écrire
--    cette colonne.
-- 2. Lien de gestion (`purpose = 'manage'`, prévu par 0008) : `booking_id`, l'appel qu'il gère (effacé
--    avec lui). Un seul lien de gestion vivant par appel. Il est créé dans la transaction de la
--    réservation par la seule fonction `issue_manage_token`, que le rôle `site_public` peut appeler :
--    elle ne crée un lien que pour l'appel que CE lien d'accès vient de réserver, et fixe elle-même
--    l'échéance (la fin de l'appel) et l'empreinte d'adresse (recopiée du lien d'accès, que le site
--    public ne lit pas). Le site public ne peut ainsi ni fabriquer un lien de gestion pour un autre
--    appel, ni en allonger un. L'échéance suit l'appel quand il est déplacé (déclencheur).
-- 3. Changements de statut (redéfinition de `bookings_status_transition`, 0013) : en plus de la
--    qualification, l'annulation d'un appel confirmé qui n'a pas commencé (`cancelled_by_guest`,
--    `cancelled_by_house`). Jamais de retour à « confirmé », rien après une annulation.
-- 4. Déplacement (nouveau déclencheur `bookings_move_guard`) : seul un appel confirmé qui n'a pas
--    commencé se déplace, et vers un créneau à venir. Le déplacement est une mise à jour de la même
--    ligne (début, fin, plage) : l'ancienne plage n'est libérée qu'au moment où la nouvelle est prise,
--    dans la même instruction ; la contrainte d'exclusion (0013) refuse un chevauchement (23P01) et
--    rien ne change alors.
-- 5. Le site public n'a AUCUN droit d'écriture sur `bookings` ni de lecture de `booking_tokens`
--    (relecture sécurité) : il ne réserve que par `book_slot_as_guest` (lien d'accès vivant retrouvé
--    par son empreinte, appel inséré dans les bornes de la base, lien consommé et lien de gestion
--    créé dans la même transaction) ; il ne verrouille,
--    ne déplace et n'annule un appel que par trois fonctions qui exigent l'empreinte d'un lien de
--    gestion valable (`lock_call_as_guest`, `move_booking_as_guest`, `cancel_booking_as_guest`), et
--    n'agissent que sur l'appel de ce lien. Il ne lit plus aucune empreinte de jeton
--    (`token_hash`) : il retrouve un lien par `find_booking_token` / `lock_booking_token`, sur
--    l'empreinte qu'il calcule du jeton reçu. Une empreinte est ainsi une capacité : sans le jeton, le
--    site public ne peut viser aucun lien, donc aucun appel.
-- 6. Bornes d'une réservation (`bookings_insert_guard`) et d'un déplacement (`bookings_move_guard`),
--    sous tout rôle (coffre et propriétaire compris) : durée des réglages (inchangée pour un
--    déplacement), pause au plus celle des réglages, début entre le délai minimal et l'horizon de
--    réservation ; l'échéance de conservation est toujours calculée par la base depuis le début.
-- 8. Contenu scellé d'un appel annulé effacé à la fin du créneau d'origine (D78, en bas).
-- 7. Journal d'accès : trois actions du coffre sur un appel, `booking_move`, `booking_cancel`,
--    `booking_delete` (effacement, procédure RGPD), chacune avec l'appel visé et rien d'autre.
-- Les droits (site public : déplacer et annuler par le lien de gestion ; coffre : déplacer, annuler,
-- effacer) sont dans db/roles/*.sql, appliqués à la main après les migrations.
-- Les lignes existantes sont revérifiées par l'ajout des contraintes : une ligne non conforme ferait
-- échouer la migration, sans rien modifier.

alter table bookings add column sequence integer not null default 0 check (sequence >= 0);

alter table booking_tokens
  add column booking_id uuid references bookings (id) on delete cascade;

-- Un lien de gestion vise toujours un appel ; un lien d'accès, jamais.
alter table booking_tokens add constraint booking_tokens_manage_check check (
  (purpose = 'manage') = (booking_id is not null)
);

create unique index booking_tokens_live_manage_idx on booking_tokens (booking_id)
  where purpose = 'manage' and revoked_at is null;

-- Lien de gestion de l'appel que le lien d'accès `p_access` vient de réserver : appel confirmé, pas
-- encore fini, lien d'accès consommé, aucun lien de gestion encore. Échéance : la fin de l'appel ;
-- empreinte d'adresse : celle du lien d'accès. Vrai si le lien est créé. Chemin de recherche figé,
-- noms qualifiés, droit d'exécution retiré à PUBLIC.
create function issue_manage_token(p_id uuid, p_hash bytea, p_access uuid) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  cree integer;
begin
  insert into public.booking_tokens
    (id, token_hash, purpose, booking_id, email_hmac, created_at, expires_at)
  select p_id, p_hash, 'manage', b.id, t.email_hmac, now(), b.ends_at
    from public.bookings as b
    join public.booking_tokens as t on t.id = b.access_token_id
   where b.access_token_id = p_access
     and t.purpose = 'access'
     and t.used_at is not null
     and b.status = 'confirmed'
     and b.ends_at > now()
     -- Seule la transaction de la réservation crée le lien : l'appel vient d'être inséré
     -- (`created_at`, valeur par défaut, que le site public n'écrit pas).
     and b.created_at = now()
     and not exists (
       select 1 from public.booking_tokens as m
        where m.booking_id = b.id and m.purpose = 'manage'
     );
  get diagnostics cree = row_count;
  return cree = 1;
end;
$$;
revoke all on function issue_manage_token(uuid, bytea, uuid) from public;

-- Le lien de gestion vaut jusqu'à la fin de l'appel : un déplacement porte son échéance à la nouvelle
-- fin (un appel annulé garde la sienne). SECURITY DEFINER : aucun rôle n'écrit `expires_at`.
create function bookings_sync_manage_expiry() returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  update public.booking_tokens set expires_at = new.ends_at
   where booking_id = new.id and purpose = 'manage';
  return null;
end;
$$;
revoke all on function bookings_sync_manage_expiry() from public;

create trigger bookings_sync_manage_expiry
  after update of ends_at on bookings
  for each row when (new.ends_at is distinct from old.ends_at)
  execute function bookings_sync_manage_expiry();

-- Statuts : qualification (0013, inchangée) et annulation (3.11). Une annulation incrémente la
-- séquence (le fichier « Retirer de mon agenda », METHOD:CANCEL, la porte).
create or replace function bookings_status_transition() returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.status = old.status then
    return new;
  end if;
  if new.status in ('done', 'no_answer') then
    if old.status not in ('confirmed', 'done', 'no_answer') then
      raise exception 'Appel annulé : il ne se qualifie pas' using errcode = 'check_violation';
    end if;
    if old.starts_at > now() then
      raise exception 'Appel pas encore commencé' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if new.status in ('cancelled_by_guest', 'cancelled_by_house') then
    if old.status <> 'confirmed' then
      raise exception 'Seul un appel confirmé s’annule' using errcode = 'check_violation';
    end if;
    if old.starts_at <= now() then
      raise exception 'Appel commencé : il ne s’annule plus' using errcode = 'check_violation';
    end if;
    new.sequence := old.sequence + 1;
    return new;
  end if;
  raise exception 'Changement de statut refusé' using errcode = 'check_violation';
end;
$$;

-- Déplacement : un appel confirmé, pas encore commencé, vers un début au-delà du délai minimal,
-- toujours confirmé, sous tout rôle. Bornes (relecture sécurité) : la durée de l'appel ne change pas ; la plage occupée
-- dépasse la fin d'au plus la pause des réglages ; le début reste dans l'horizon de réservation (la
-- fenêtre de `bookingWindow` court jusqu'au minuit local qui suit le dernier jour : horizon + 1 jour,
-- plus une heure pour un changement d'heure). L'échéance de conservation est recalculée depuis le
-- nouveau début, comme à la réservation (`retentionDeadline(début, RETENTION_MONTHS = 12)`, en UTC,
-- src/lib/vault/retention.ts ; les tests comparent les deux). Chaque déplacement incrémente la
-- séquence. Les déclencheurs BEFORE se suivent par ordre alphabétique : celui-ci passe avant
-- `bookings_status_transition`.
create function bookings_move_guard() returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  pause integer;
  horizon integer;
  delai integer;
begin
  if new.starts_at = old.starts_at and new.ends_at = old.ends_at and new.slot = old.slot then
    return new;
  end if;
  if old.status <> 'confirmed' or new.status <> 'confirmed' then
    raise exception 'Seul un appel confirmé se déplace' using errcode = 'check_violation';
  end if;
  if old.starts_at <= now() then
    raise exception 'Appel commencé : il ne se déplace plus' using errcode = 'check_violation';
  end if;
  if new.ends_at - new.starts_at <> old.ends_at - old.starts_at then
    raise exception 'La durée d’un appel ne change pas' using errcode = 'check_violation';
  end if;
  select buffer_minutes, horizon_days, min_notice_minutes into pause, horizon, delai
    from public.booking_settings;
  if not found then
    raise exception 'Réglages des appels absents' using errcode = 'check_violation';
  end if;
  -- Délai minimal, à l'heure de la base (relecture sécurité, troisième passage).
  if new.starts_at < now() + make_interval(mins => delai) then
    raise exception 'Nouveau créneau dans le délai minimal' using errcode = 'check_violation';
  end if;
  if upper(new.slot) - new.ends_at > make_interval(mins => pause) then
    raise exception 'Pause plus longue que celle des réglages' using errcode = 'check_violation';
  end if;
  if new.starts_at > now() + make_interval(days => horizon + 1, hours => 1) then
    raise exception 'Créneau hors de l’horizon de réservation' using errcode = 'check_violation';
  end if;
  new.retention_until := ((new.starts_at at time zone 'UTC') + interval '12 months') at time zone 'UTC';
  new.sequence := old.sequence + 1;
  return new;
end;
$$;

create trigger bookings_move_guard
  before update of starts_at, ends_at, slot on bookings
  for each row execute function bookings_move_guard();

-- Fonctions du site public (rôle `site_public`). Toutes SECURITY DEFINER, chemin de recherche figé,
-- noms qualifiés, droit d'exécution retiré à PUBLIC. Un lien de gestion « valable » : cette
-- empreinte, usage `manage`, pas annulé, pas expiré (l'heure de la base). L'application vérifie aussi
-- le lien à son heure (src/lib/booking/bookings.ts) ; la base a le dernier mot.

-- Un lien par son empreinte (lecture, puis verrou de ligne pour la réservation), sans l'empreinte ni
-- l'adresse : le site public ne lit plus `token_hash` ni `email_hmac`.
create function find_booking_token(p_hash bytea)
returns table (
  id uuid, purpose text, booking_id uuid, expires_at timestamptz, used_at timestamptz,
  revoked_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select t.id, t.purpose, t.booking_id, t.expires_at, t.used_at, t.revoked_at
    from public.booking_tokens as t
   where t.token_hash = p_hash;
$$;
revoke all on function find_booking_token(bytea) from public;

create function lock_booking_token(p_hash bytea)
returns table (
  id uuid, purpose text, booking_id uuid, expires_at timestamptz, used_at timestamptz,
  revoked_at timestamptz
)
language sql
security definer
set search_path = pg_catalog, pg_temp
as $$
  select t.id, t.purpose, t.booking_id, t.expires_at, t.used_at, t.revoked_at
    from public.booking_tokens as t
   where t.token_hash = p_hash
     for update of t;
$$;
revoke all on function lock_booking_token(bytea) from public;

-- L'appel d'un lien de gestion valable, verrouillé jusqu'à la fin de la transaction.
create function lock_call_as_guest(p_hash bytea)
returns table (id uuid, starts_at timestamptz, ends_at timestamptz, status text, sequence integer)
language sql
security definer
set search_path = pg_catalog, pg_temp
as $$
  select b.id, b.starts_at, b.ends_at, b.status, b.sequence
    from public.bookings as b
    join public.booking_tokens as t on t.booking_id = b.id
   where t.token_hash = p_hash
     and t.purpose = 'manage'
     and t.revoked_at is null
     and t.expires_at > now()
     for update of b;
$$;
revoke all on function lock_call_as_guest(bytea) from public;

-- Déplace l'appel de ce lien, et lui seul (début, fin, plage). L'application a recalculé les
-- créneaux sous le verrou du jour ; les bornes du déclencheur `bookings_move_guard` et la contrainte
-- d'exclusion valent ici aussi. Vrai si l'appel est déplacé.
create function move_booking_as_guest(
  p_hash bytea, p_start timestamptz, p_end timestamptz, p_occupied_until timestamptz
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  deplace integer;
begin
  update public.bookings as b
     set starts_at = p_start, ends_at = p_end, slot = tstzrange(p_start, p_occupied_until, '[)')
    from public.booking_tokens as t
   where t.booking_id = b.id
     and t.token_hash = p_hash
     and t.purpose = 'manage'
     and t.revoked_at is null
     and t.expires_at > now()
     and b.status = 'confirmed';
  get diagnostics deplace = row_count;
  return deplace = 1;
end;
$$;
revoke all on function move_booking_as_guest(bytea, timestamptz, timestamptz, timestamptz) from public;

-- Annule l'appel de ce lien, « annulé par la personne », s'il est confirmé ; le déclencheur des
-- statuts refuse un appel commencé et pose la séquence. Vrai si l'appel est annulé.
create function cancel_booking_as_guest(p_hash bytea) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  annule integer;
begin
  update public.bookings as b
     set status = 'cancelled_by_guest'
    from public.booking_tokens as t
   where t.booking_id = b.id
     and t.token_hash = p_hash
     and t.purpose = 'manage'
     and t.revoked_at is null
     and t.expires_at > now()
     and b.status = 'confirmed';
  get diagnostics annule = row_count;
  return annule = 1;
end;
$$;
revoke all on function cancel_booking_as_guest(bytea) from public;

-- Bornes de toute insertion d'un appel, sous tout rôle (troisième relecture sécurité : avant elle,
-- le site public insérait directement un appel à 3 h, avec une plage jusqu'en 2100 et une échéance
-- à 50 ans). Un appel naît confirmé, séquence 0 ; durée des réglages ; pause au plus celle des
-- réglages ; début entre le délai minimal et l'horizon (même tolérance que `bookings_move_guard`) ;
-- échéance de conservation posée ici, comme `retentionDeadline(début, 12)`. Les créneaux eux-mêmes
-- (semaine type, absences, plafond) restent calculés par l'application sous verrou du jour ; la
-- contrainte d'exclusion a le dernier mot sur les chevauchements. Les tests qui posent des appels
-- passés le font hors déclencheurs (`session_replication_role = replica`, superutilisateur).
create function bookings_insert_guard() returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  reglages record;
begin
  select duration_minutes, buffer_minutes, min_notice_minutes, horizon_days into reglages
    from public.booking_settings;
  if not found then
    raise exception 'Réglages des appels absents' using errcode = 'check_violation';
  end if;
  if new.status <> 'confirmed' or new.sequence <> 0 then
    raise exception 'Un appel naît confirmé' using errcode = 'check_violation';
  end if;
  if new.ends_at - new.starts_at <> make_interval(mins => reglages.duration_minutes) then
    raise exception 'Durée d’appel hors réglages' using errcode = 'check_violation';
  end if;
  if upper(new.slot) - new.ends_at > make_interval(mins => reglages.buffer_minutes) then
    raise exception 'Pause plus longue que celle des réglages' using errcode = 'check_violation';
  end if;
  if new.starts_at < now() + make_interval(mins => reglages.min_notice_minutes) then
    raise exception 'Créneau dans le délai minimal' using errcode = 'check_violation';
  end if;
  if new.starts_at > now() + make_interval(days => reglages.horizon_days + 1, hours => 1) then
    raise exception 'Créneau hors de l’horizon de réservation' using errcode = 'check_violation';
  end if;
  new.retention_until := ((new.starts_at at time zone 'UTC') + interval '12 months') at time zone 'UTC';
  return new;
end;
$$;

create trigger bookings_insert_guard
  before insert on bookings
  for each row execute function bookings_insert_guard();

-- Réservation par le site public (rôle `site_public`, seule voie d'insertion d'un appel) : le lien
-- d'accès de cette empreinte, verrouillé, doit être vivant (usage `access`, ni consommé, ni annulé,
-- ni expiré à l'heure de la base). Dans la même transaction : l'appel est inséré (bornes de
-- `bookings_insert_guard`, contrainte d'exclusion : 23P01 si le créneau vient d'être pris), le lien
-- consommé (`used_at` : l'heure de l'application si elle est plus tard que celle de la base, jamais
-- plus tôt ; elle ne sert qu'à la reprise de 15 minutes), et le lien de gestion créé
-- (`issue_manage_token`, devenue interne). Le contenu scellé (nom, numéro, langue, choix SMS,
-- origine) est celui que l'application a scellé, de taille fixe (contrainte). Rend l'identifiant de
-- l'appel, ou NULL si le lien ne vaut pas.
create function book_slot_as_guest(
  p_access_hash bytea, p_start timestamptz, p_end timestamptz, p_occupied_until timestamptz,
  p_privacy_version text, p_sealed bytea, p_manage_hash bytea, p_used_at timestamptz
) returns uuid
language plpgsql
security definer
-- `public, pg_temp` (comme `revoke_live_access_links`, 0011) et non `pg_catalog` seul : la
-- consommation du lien déclenche `booking_tokens_usage_unique` (0010), écrit sans chemin figé, qui
-- hérite de celui-ci pour trouver `bookings`. `pg_temp` en dernier : aucun objet temporaire ne masque
-- une table ; les noms restent qualifiés ici.
set search_path = public, pg_temp
as $$
declare
  lien record;
  appel uuid := gen_random_uuid();
begin
  select t.id, t.purpose, t.used_at, t.revoked_at, t.expires_at into lien
    from public.booking_tokens as t
   where t.token_hash = p_access_hash
     for update of t;
  if not found or lien.purpose <> 'access' or lien.used_at is not null
     or lien.revoked_at is not null or lien.expires_at <= now() then
    return null;
  end if;
  -- `retention_until` : posée par `bookings_insert_guard` (valeur provisoire ici).
  insert into public.bookings
    (id, access_token_id, starts_at, ends_at, slot, privacy_version, retention_until, sealed)
  values
    (appel, lien.id, p_start, p_end, tstzrange(p_start, p_occupied_until, '[)'),
     p_privacy_version, p_start, p_sealed);
  update public.booking_tokens
     set used_at = greatest(coalesce(p_used_at, now()), now())
   where id = lien.id;
  if not public.issue_manage_token(gen_random_uuid(), p_manage_hash, lien.id) then
    raise exception 'Lien de gestion non créé' using errcode = 'check_violation';
  end if;
  return appel;
end;
$$;
revoke all on function
  book_slot_as_guest(bytea, timestamptz, timestamptz, timestamptz, text, bytea, bytea, timestamptz)
  from public;

-- Liste complète des actions, reprise telle quelle de 0013 (`availability`, `booking_link` et les
-- quatre de l'agenda compris) : une migration qui redéfinit cette contrainte ne retire jamais une
-- action.
alter table vault_access_log drop constraint vault_access_log_action_check;
alter table vault_access_log add constraint vault_access_log_action_check check (
  action in (
    'login', 'login_backup_code', 'login_failed', 'password_ok', 'totp_enrolled',
    'rate_limited', 'logout', 'list',
    'read', 'export', 'delete', 'purge', 'freeze', 'unfreeze', 'retention',
    'availability',
    'booking_link',
    'booking_list', 'booking_read', 'booking_status', 'booking_attach',
    'booking_move', 'booking_cancel', 'booking_delete'
  )
);

-- Forme d'une ligne de l'agenda (0013), et des trois nouvelles : l'appel visé, sans demande.
alter table vault_access_log drop constraint vault_access_log_booking_check;
alter table vault_access_log add constraint vault_access_log_booking_check check (
  case
    when action = 'booking_list' then booking_id is null and request_id is null
    when action in (
      'booking_read', 'booking_status', 'booking_move', 'booking_cancel', 'booking_delete'
    ) then booking_id is not null and request_id is null
    when action = 'booking_attach' then booking_id is not null
    else booking_id is null
  end
);

-- 8. Conservation d'un appel annulé (D78, RGPD : minimisation). Après une annulation, par la personne
--    ou par la maison, le contenu scellé (nom, numéro, langue, choix SMS, origine) est effacé à la fin
--    du créneau d'origine (`ends_at`, qui ne bouge plus après une annulation) par la conservation
--    planifiée (/api/cron/retention, `purgeCancelledContents`) ; le créneau et le statut restent, sans
--    contenu, jusqu'à l'échéance de la réservation. Jusqu'à l'heure prévue, Cat peut encore rappeler
--    la personne (aucun message ne part avant la 3.12).
--    Solution retenue : `sealed` devient nullable (plutôt qu'une valeur vide factice) ; NULL n'est
--    permis que pour un appel annulé (contrainte), et seulement par une remise à NULL (déclencheur,
--    sous tout rôle) : jamais de contenu rendu à un appel, jamais d'effacement d'un appel actif. La
--    contrainte de taille (2 096 octets) reste pour tout contenu présent.
alter table bookings alter column sealed drop not null;
alter table bookings add constraint bookings_sealed_presence_check check (
  sealed is not null or status in ('cancelled_by_guest', 'cancelled_by_house')
);

create function bookings_sealed_guard() returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.sealed is not distinct from old.sealed then
    return new;
  end if;
  if new.sealed is not null or old.status not in ('cancelled_by_guest', 'cancelled_by_house') then
    raise exception 'Contenu d’un appel : seul celui d’un appel annulé s’efface'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger bookings_sealed_guard
  before update of sealed on bookings
  for each row execute function bookings_sealed_guard();

-- Résumé de la conservation : un compteur de plus, `purged_cancelled_calls` (contenus d'appels
-- annulés effacés), entier, obligatoire sur une ligne `retention`, interdit ailleurs. Posée NOT VALID,
-- comme en 0010 : les lignes `retention` antérieures n'ont pas ce compteur (le journal ne se réécrit
-- jamais).
alter table vault_access_log add column purged_cancelled_calls integer;

alter table vault_access_log drop constraint vault_access_log_retention_check;
alter table vault_access_log add constraint vault_access_log_retention_check check (
  case
    when action = 'retention' then
      request_id is null
      and coalesce(
        purged_requests >= 0 and purged_sessions >= 0
          and purged_rate_limits >= 0 and purged_verifications >= 0
          and purged_bookings >= 0 and purged_tokens >= 0
          and purged_cancelled_calls >= 0,
        false
      )
    else
      purged_requests is null and purged_sessions is null
        and purged_rate_limits is null and purged_verifications is null
        and purged_bookings is null and purged_tokens is null
        and purged_cancelled_calls is null
  end
) not valid;
