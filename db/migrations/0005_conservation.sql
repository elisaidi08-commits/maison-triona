-- Conservation planifiée du coffre (story 3.2, partie D) : la tâche quotidienne
-- (/api/cron/retention) inscrit au journal un résumé de chaque passage, en nombres seulement.
-- retention : un passage de la tâche, au nom de `system`, sans demande visée. Quatre compteurs
-- entiers, positifs ou nuls : demandes échues effacées (chacune a déjà sa ligne `purge`), sessions
-- échues ou inactives, compteurs de limitation de débit périmés, défis du second facteur expirés.
-- Des entiers seulement : aucune colonne du journal ne peut recevoir un texte de demande. Ils sont
-- obligatoires sur une ligne `retention` et interdits sur toute autre.

alter table vault_access_log
  add column purged_requests integer,
  add column purged_sessions integer,
  add column purged_rate_limits integer,
  add column purged_verifications integer;

alter table vault_access_log drop constraint vault_access_log_action_check;
alter table vault_access_log add constraint vault_access_log_action_check check (
  action in (
    'login', 'login_backup_code', 'login_failed', 'password_ok', 'totp_enrolled',
    'rate_limited', 'logout', 'list',
    'read', 'export', 'delete', 'purge', 'freeze', 'unfreeze', 'retention'
  )
);

alter table vault_access_log add constraint vault_access_log_retention_check check (
  case
    when action = 'retention' then
      request_id is null
      and coalesce(
        purged_requests >= 0 and purged_sessions >= 0
          and purged_rate_limits >= 0 and purged_verifications >= 0,
        false
      )
    else
      purged_requests is null and purged_sessions is null
        and purged_rate_limits is null and purged_verifications is null
  end
);

-- Dernier passage de la conservation (accueil du coffre) et dernière lecture de la liste par compte
-- (une ligne `list` par affichage, src/lib/vault/repository.ts).
create index vault_access_log_retention_idx
  on vault_access_log (at desc) where action = 'retention';
create index vault_access_log_liste_idx
  on vault_access_log (actor, at desc) where action = 'list';
