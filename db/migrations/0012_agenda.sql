-- Agenda des appels de Cat dans le coffre (story 3.13 ; docs/reservation-appel.md §3.2). Numéro 0012,
-- réservé à cette story.
-- 1. Statuts. La liste est déjà celle de la spec depuis 0008 (`confirmed`, `done`, `no_answer`,
--    `cancelled_by_guest`, `cancelled_by_house`) ; « à qualifier » ne se stocke pas : il se déduit
--    (confirmé, heure de fin passée, src/lib/booking/agenda.ts). Ce qui change : un déclencheur dit
--    quels changements de statut la base accepte, sous tout rôle. En 3.13, seulement la qualification
--    d'un appel commencé : confirmé, fait ou pas de réponse → fait ou pas de réponse (Cat peut
--    corriger un clic). Jamais de retour à « confirmé » (il rendrait la plage à la contrainte
--    d'exclusion après coup), aucune annulation : déplacer et annuler sont la story 3.11, qui
--    redéfinira cette fonction.
-- 2. Rattachement d'un appel à une demande du coffre : `request_id`, facultatif, remis à nul si la
--    demande est effacée (à la main ou par la conservation). Un identifiant, rien de personnel.
-- 3. Journal d'accès : quatre actions de l'agenda, et l'identifiant de l'appel visé (`booking_id`,
--    sans clé étrangère : la ligne survit à l'effacement de l'appel, comme `request_id`). Jamais de
--    contenu : ni nom, ni numéro, ni heure, ni statut.
--    - `booking_list` : affichage de l'agenda (heures, statuts, demandes récentes en colonnes en
--      clair), ni appel ni demande visés ;
--    - `booking_read` : remise des octets scellés d'un appel au navigateur, qui les ouvre, une ligne
--      par appel ;
--    - `booking_status` : « fait » ou « pas de réponse », l'appel visé ;
--    - `booking_attach` : rattachement, l'appel visé et la demande rattachée (nulle : rattachement
--      retiré).
-- Les droits du rôle `coffre` (UPDATE des seules colonnes `status` et `request_id`) sont dans
-- db/roles/coffre.sql, appliqué à la main après les migrations ; `site_public` ne change pas.

alter table bookings
  add column request_id uuid references vault_requests (id) on delete set null;

create index bookings_request_idx on bookings (request_id) where request_id is not null;

create function bookings_status_transition() returns trigger
language plpgsql as $$
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
  raise exception 'Changement de statut refusé' using errcode = 'check_violation';
end;
$$;

create trigger bookings_status_transition
  before update of status on bookings
  for each row execute function bookings_status_transition();

alter table vault_access_log add column booking_id uuid;

-- Liste complète des actions, reprise telle quelle de 0010 (`availability`, `booking_link` compris) :
-- une migration qui redéfinit cette contrainte ne retire jamais une action.
alter table vault_access_log drop constraint vault_access_log_action_check;
alter table vault_access_log add constraint vault_access_log_action_check check (
  action in (
    'login', 'login_backup_code', 'login_failed', 'password_ok', 'totp_enrolled',
    'rate_limited', 'logout', 'list',
    'read', 'export', 'delete', 'purge', 'freeze', 'unfreeze', 'retention',
    'availability',
    'booking_link',
    'booking_list', 'booking_read', 'booking_status', 'booking_attach'
  )
);

-- Forme d'une ligne de l'agenda ; toute autre action ne vise aucun appel. Les lignes existantes n'ont
-- pas de `booking_id` : la contrainte se vérifie sur elles sans rien réécrire.
alter table vault_access_log add constraint vault_access_log_booking_check check (
  case
    when action = 'booking_list' then booking_id is null and request_id is null
    when action in ('booking_read', 'booking_status') then
      booking_id is not null and request_id is null
    when action = 'booking_attach' then booking_id is not null
    else booking_id is null
  end
);

-- Dernier affichage de l'agenda par compte (une ligne `booking_list` par affichage, comme `list`) et
-- lignes d'un appel.
create index vault_access_log_agenda_idx
  on vault_access_log (actor, at desc) where action = 'booking_list';
create index vault_access_log_booking_idx
  on vault_access_log (booking_id, at desc) where booking_id is not null;
