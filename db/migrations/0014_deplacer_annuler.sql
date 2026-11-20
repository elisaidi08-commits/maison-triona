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
-- 5. Annulation par la personne : la seule fonction `cancel_booking_as_guest`, que le rôle
--    `site_public` peut appeler ; il n'a aucun droit d'écrire le statut (il ne peut ni qualifier un
--    appel, ni l'annuler au nom de la maison).
-- 6. Journal d'accès : trois actions du coffre sur un appel, `booking_move`, `booking_cancel`,
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

-- Déplacement : un appel confirmé, pas encore commencé, vers un début à venir, toujours confirmé.
-- Chaque déplacement incrémente la séquence. Les déclencheurs BEFORE se suivent par ordre alphabétique :
-- celui-ci passe avant `bookings_status_transition`.
create function bookings_move_guard() returns trigger
language plpgsql
set search_path = pg_catalog
as $$
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
  if new.starts_at <= now() then
    raise exception 'Nouveau créneau déjà passé' using errcode = 'check_violation';
  end if;
  new.sequence := old.sequence + 1;
  return new;
end;
$$;

create trigger bookings_move_guard
  before update of starts_at, ends_at, slot on bookings
  for each row execute function bookings_move_guard();

-- Annulation par la personne (lien de gestion, rôle `site_public`) : « annulé par la personne », pour
-- un appel confirmé ; le déclencheur des statuts refuse un appel commencé et pose la séquence. Vrai si
-- l'appel est annulé. L'appelant a déjà verrouillé la ligne (SELECT … FOR UPDATE) et vérifié le lien.
create function cancel_booking_as_guest(p_booking uuid) returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  annule integer;
begin
  update public.bookings set status = 'cancelled_by_guest'
   where id = p_booking and status = 'confirmed';
  get diagnostics annule = row_count;
  return annule = 1;
end;
$$;
revoke all on function cancel_booking_as_guest(uuid) from public;

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
