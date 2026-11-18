-- Rôle du site public (story 3.2 B, docs/coffre-cles.md §3) : la Server Action du formulaire écrit
-- des demandes scellées, et rien d'autre. Ni lecture (même pas l'identifiant : il est tiré côté
-- serveur, l'insertion se fait sans RETURNING), ni modification, ni effacement, ni journal d'accès.
-- Hors des migrations automatiques : appliqué à la main, par l'administrateur de la base, APRÈS
-- `npm run db:migrate` (les droits portent sur une table existante). Rejouable.
-- Aucun mot de passe ici : le compte qui se connecte reçoit ce rôle à part (procédure).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'site_public') then
    create role site_public nologin;
  end if;
end;
$$;

-- Repartir de rien, puis donner le strict nécessaire.
revoke all on all tables in schema public from site_public;
revoke all on all sequences in schema public from site_public;
revoke all on schema public from site_public;

grant usage on schema public to site_public;
grant insert on vault_requests to site_public;
