-- Rôle de l'espace /coffre (story 3.2 C et D, docs/coffre-cles.md §3) : comptes et sessions de Better
-- Auth, lecture des demandes, gel et effacement des demandes (partie D), journal d'accès en écriture et
-- en lecture, disponibilités de Cat (story 3.8 B), réservations en lecture et création d'un lien de
-- réservation (story 3.10), effacement des réservations échues et des jetons expirés par la
-- conservation (0010), statut et rattachement des appels par l'agenda (story 3.13), rien d'autre.
-- Ni insertion d'une demande, ni modification d'une autre colonne que `frozen` (ni le contenu scellé,
-- ni l'échéance, ni le statut), ni modification ni effacement du journal, ni table de migrations, ni
-- création d'objet. La tâche planifiée de conservation (/api/cron/retention) passe par ce même rôle.
-- Depuis la story 3.3 (suites C), il lit aussi cinq colonnes de la boîte d'envoi, pour l'état de
-- l'envoi des e-mails sur l'accueil (des comptes).
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

-- Réservation d'appel (story 3.10, db/migrations/0008_reservations.sql) : lecture des réservations
-- (créneaux de l'aperçu, appels gardés d'une journée bloquée ; l'agenda de la story 3.13 y lira le
-- contenu scellé, ouvert dans le navigateur). Création d'un lien de réservation (pont en attendant
-- l'e-mail de la story 3.9) : insertion d'un jeton, empreinte seule, sans cible. Ni lecture, ni
-- modification, ni effacement des jetons ; ni écriture des réservations (story 3.11 ; l'agenda de la
-- 3.13 n'écrit que deux colonnes, plus bas).
grant select on bookings to coffre;
grant insert (id, token_hash, purpose, created_at, expires_at) on booking_tokens to coffre;

-- Conservation planifiée (/api/cron/retention, db/migrations/0010_jetons_usage.sql) : effacement des
-- réservations échues et des jetons expirés depuis plus de 48 heures. Pour les jetons, la lecture des
-- deux seules colonnes que la condition d'effacement exige (identifiant, expiration), jamais
-- l'empreinte ni les dates d'usage.
grant delete on bookings to coffre;
grant select (id, expires_at), delete on booking_tokens to coffre;

-- Agenda des appels (story 3.13, db/migrations/0011_agenda.sql) : modification des deux seules colonnes
-- que l'agenda écrit, le statut (« fait », « pas de réponse » : le déclencheur de 0011 refuse tout
-- autre changement, sous tout rôle) et le rattachement à une demande (`request_id`). Ni le créneau, ni
-- le contenu scellé, ni l'échéance, ni le lien ; ni insertion de réservation.
grant update (status, request_id) on bookings to coffre;
