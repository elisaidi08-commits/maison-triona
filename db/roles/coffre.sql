-- Rôle de l'espace /coffre (story 3.2 C, docs/coffre-cles.md §3) : comptes et sessions de Better Auth,
-- lecture des demandes, journal d'accès en écriture et en lecture, rien d'autre. Ni modification ni
-- effacement des demandes (gel et effacement : partie D, qui étendra ce fichier), ni modification ni
-- effacement du journal, ni table de migrations, ni création d'objet.
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

-- Demandes : lecture seule (liste, octets scellés).
grant select on vault_requests to coffre;

-- Journal d'accès : écrire et relire, jamais modifier ni effacer.
grant select, insert on vault_access_log to coffre;
