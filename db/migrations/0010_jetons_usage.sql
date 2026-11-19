-- Jetons et conservation de la réservation d'appel (story 3.10, relecture sécurité).
-- 1. Un lien ne se consomme qu'une fois, et seulement par une réservation : la base refuse toute mise
--    à jour de `used_at` qui le remettrait à zéro, le changerait après coup, ou le poserait sans
--    réservation qui pointe vers ce jeton (`bookings.access_token_id`). Le rôle `site_public` a le droit
--    d'écrire cette colonne : ce garde-fou ne dépend plus de l'application seule.
-- 2. La conservation planifiée (/api/cron/retention, story 3.2 D) efface aussi les jetons expirés depuis
--    plus de 48 heures et les réservations échues ; son résumé au journal gagne deux compteurs entiers.

create function booking_tokens_usage_unique() returns trigger
language plpgsql as $$
begin
  if old.used_at is not null then
    raise exception 'Lien déjà utilisé' using errcode = 'check_violation';
  end if;
  if new.used_at is null then
    raise exception 'Utilisation du lien sans date' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from bookings where access_token_id = new.id) then
    raise exception 'Lien utilisé sans réservation' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger booking_tokens_usage_unique
  before update of used_at on booking_tokens
  for each row execute function booking_tokens_usage_unique();

-- Résumé de la conservation : réservations échues (`retention_until` passée) et jetons expirés depuis
-- plus de 48 heures, effacés à chaque passage. Des entiers seulement, obligatoires sur une ligne
-- `retention` et interdits sur toute autre, comme les quatre premiers compteurs (0005).
alter table vault_access_log
  add column purged_bookings integer,
  add column purged_tokens integer;

-- Liste complète des actions, reprise telle quelle de 0008 (0009, autre session, ne la touche pas) (`availability`, `booking_link` compris) :
-- une migration qui redéfinit cette contrainte ne retire jamais une action.
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

-- Les lignes `retention` antérieures à cette migration n'ont pas les deux nouveaux compteurs (rien
-- n'était effacé) : la contrainte est posée NOT VALID, elle s'applique à toute ligne nouvelle sans
-- réécrire le journal (qui ne se modifie jamais).
alter table vault_access_log drop constraint vault_access_log_retention_check;
alter table vault_access_log add constraint vault_access_log_retention_check check (
  case
    when action = 'retention' then
      request_id is null
      and coalesce(
        purged_requests >= 0 and purged_sessions >= 0
          and purged_rate_limits >= 0 and purged_verifications >= 0
          and purged_bookings >= 0 and purged_tokens >= 0,
        false
      )
    else
      purged_requests is null and purged_sessions is null
        and purged_rate_limits is null and purged_verifications is null
        and purged_bookings is null and purged_tokens is null
  end
) not valid;
