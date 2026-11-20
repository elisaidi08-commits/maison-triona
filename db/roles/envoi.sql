-- Rôle de l'envoi des e-mails (story 3.3) : compte utilisé par la première tentative d'envoi
-- (`after()`, juste après la demande) et par la tâche Vercel Cron qui reprend les envois en attente.
-- Il gère la boîte d'envoi (lecture, bail, mise à jour, purge) et rien d'autre : aucun droit sur
-- les demandes, le journal d'accès ni les tables de Better Auth.
-- Hors des migrations automatiques : appliqué à la main, par l'administrateur de la base, APRÈS
-- `npm run db:migrate` (les droits portent sur une table existante). Rejouable.
-- Aucun mot de passe ici : le compte qui se connecte reçoit ce rôle à part (procédure).

-- Personne ne crée d'objet dans le schéma public, hors du propriétaire (défaut de PostgreSQL 15 et
-- plus ; posé ici pour une base plus ancienne ou modifiée). Rejouable.
revoke create on schema public from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'envoi') then
    create role envoi nologin;
  end if;
end;
$$;

-- Repartir de rien, puis donner le strict nécessaire.
revoke all on all tables in schema public from envoi;
revoke all on all sequences in schema public from envoi;
revoke all on schema public from envoi;

grant usage on schema public to envoi;
grant select, insert, update, delete on outbox to envoi;
