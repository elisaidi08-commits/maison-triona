-- Preuve du consentement (story 3.2 B) : version de la politique de confidentialité acceptée par la
-- case du formulaire (constante PRIVACY_POLICY_VERSION, src/lib/privacy.ts). La date de
-- l'acceptation est created_at. Donnée technique : aucun texte publié ne change (D61).
-- Obligatoire pour toute nouvelle ligne (déclencheur avant insertion) ; une ligne antérieure à
-- cette migration reste nulle, sans bloquer ses mises à jour (statut, gel).

alter table vault_requests
  add column privacy_version text
    check (privacy_version is null or length(privacy_version) between 1 and 40);

create function vault_requests_require_privacy_version() returns trigger
  language plpgsql
as $$
begin
  if new.privacy_version is null then
    raise exception 'privacy_version requise' using errcode = 'not_null_violation';
  end if;
  return new;
end;
$$;

create trigger vault_requests_privacy_version_required
  before insert on vault_requests
  for each row execute function vault_requests_require_privacy_version();
