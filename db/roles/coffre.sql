-- Rôle de l'espace /coffre (story 3.2 C et D, docs/coffre-cles.md §3) : comptes et sessions de Better
-- Auth, lecture des demandes, gel et effacement des demandes (partie D), journal d'accès en écriture et
-- en lecture, disponibilités de Cat (story 3.8 B), rien d'autre. Ni insertion d'une demande, ni modification d'une autre colonne que
-- `frozen` (ni le contenu scellé, ni l'échéance, ni le statut), ni modification ni effacement du
-- journal, ni table de migrations, ni création d'objet. La tâche planifiée de conservation
-- (/api/cron/retention) passe par ce même rôle. Depuis la story 3.3 (suites C), il lit aussi cinq
-- colonnes de la boîte d'envoi, pour l'état de l'envoi des e-mails sur l'accueil (des comptes).
-- Hors des migrations automatiques : appliqué à la main, par l'administrateur de la base, APRÈS
-- `npm run db:migrate` (les droits portent sur des tables existantes). Rejouable.
-- Aucun mot de passe ici : le compte qui se connecte (COFFRE_DATABASE_URL) reçoit ce rôle à part.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'coffre') then
    create role coffre nologin;
  end if;
end;
$$;

-- Repartir de rien, puis donner le strict nécessaire.
revoke all on all tables in schema public from coffre;
revoke all on all sequences in schema public from coffre;
revoke all on schema public from coffre;

grant usage on schema public to coffre;

-- Better Auth (db/migrations/0003_auth.sql) : comptes, sessions, défis du second facteur, TOTP,
-- compteurs de limitation de débit. Effacements compris : sessions et défis consommés, purge.
grant select, insert, update, delete
  on "user", "session", "account", "verification", "twoFactor", "rateLimit"
  to coffre;

-- Demandes : lecture (liste, octets scellés), effacement (à la demande ou par la conservation) et
-- gel (`frozen` seulement : limitation, RGPD art. 18). Aucune autre colonne ne se modifie.
grant select, delete on vault_requests to coffre;
grant update (frozen) on vault_requests to coffre;

-- Journal d'accès : écrire et relire, jamais modifier ni effacer.
grant select, insert on vault_access_log to coffre;

-- Boîte d'envoi (story 3.3, suites C, db/migrations/0006_boite_envoi.sql) : lecture des seules
-- colonnes qu'il faut pour compter, sur l'accueil, les messages en retard ou en échec et les
-- demandes sans notification. Ni l'identifiant du message (il relierait une ligne
-- `[envoi] <statut> <id>` des journaux à une demande), ni celui du prestataire, ni le code
-- d'erreur, ni les tentatives ; aucune écriture (l'envoi reste au rôle `envoi`).
grant select (template, status, request_id, next_attempt_at, created_at) on outbox to coffre;

-- Disponibilités (story 3.8 B, db/migrations/0007_disponibilites.sql) : réglages, une seule ligne,
-- modifiables colonne par colonne (ni le fuseau, ni la ligne elle-même : ni insertion ni effacement) ;
-- semaine type, ajout et retrait de plages (une plage ne se modifie pas : on la retire, on en ajoute
-- une) ; absences, ajout et retrait, et pour un jour férié seulement `active` (décocher, recocher).
grant select on booking_settings to coffre;
grant update (duration_minutes, buffer_minutes, min_notice_minutes, horizon_days, daily_cap, updated_at)
  on booking_settings to coffre;
grant select, insert, delete on availability_rules to coffre;
grant select, insert, delete on availability_exceptions to coffre;
grant update (active) on availability_exceptions to coffre;
