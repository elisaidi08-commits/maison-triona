-- Demande d'un lien de réservation (story 3.9 ; docs/reservation-appel.md §2, §4.4, §4.5).
-- 1. Boîte d'envoi : nouveau gabarit `booking_access`, l'e-mail d'accès envoyé au visiteur. La ligne
--    ne porte ni l'adresse ni le jeton, ni aucun identifiant de demande ou d'alerte : un gabarit, des
--    dates et des statuts, comme les autres. Adresse et jeton ne vivent qu'en mémoire, le temps du
--    premier essai d'envoi (juste après la réponse) ; sans clé serveur (Key Manager, story 3.12 B),
--    aucune reprise n'est possible : la tâche planifiée passe une telle ligne en échec (`no_contact`)
--    et alerte Sady, comme le prévoit la spec (« si elle est effacée, le message est abandonné »).
-- 2. Jetons : « un nouveau lien annule l'ancien » passe par une fonction, `revoke_live_access_links`,
--    la seule que le rôle `site_public` peut appeler pour annuler (db/roles/site_public.sql) : elle
--    n'annule que les liens d'accès vivants d'UNE empreinte d'adresse donnée. Le site public n'a ainsi
--    ni la lecture des empreintes (`email_hmac`), ni l'écriture de `revoked_at` sur n'importe quel
--    lien. SECURITY DEFINER, chemin de recherche figé, droit d'exécution retiré à PUBLIC ; l'heure
--    de l'annulation est celle de la base (`now()`), jamais une valeur de l'appelant.
-- Le site public crée ses liens sans fixer ni `created_at` ni `purpose` (valeurs par défaut : `now()`,
-- `access`) : la contrainte des 48 heures se calcule ainsi depuis l'heure de la base, et il ne peut
-- fabriquer ni lien plus long ni lien de gestion (db/roles/site_public.sql).
-- 3. Une annulation (`revoked_at`) ne se pose qu'une fois et ne se retire jamais, quel que soit le
--    rôle : déclencheur, comme pour `used_at` (0010).
-- Les lignes existantes sont revérifiées par l'ajout des contraintes : une ligne non conforme ferait
-- échouer la migration, sans rien modifier.

alter table outbox drop constraint outbox_template_check;
alter table outbox add constraint outbox_template_check
  check (template in ('request_notification', 'technical_alert', 'booking_access'));

alter table outbox add constraint outbox_booking_access_shape check (
  template <> 'booking_access' or (request_id is null and priority = false)
);

create function revoke_live_access_links(cible bytea) returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update booking_tokens set revoked_at = now()
   where email_hmac = cible and purpose = 'access' and used_at is null and revoked_at is null;
$$;
revoke all on function revoke_live_access_links(bytea) from public;

create function booking_tokens_revocation_once() returns trigger
language plpgsql as $$
begin
  if old.revoked_at is not null then
    raise exception 'Lien déjà annulé' using errcode = 'check_violation';
  end if;
  if new.revoked_at is null then
    raise exception 'Annulation du lien sans date' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger booking_tokens_revocation_once
  before update of revoked_at on booking_tokens
  for each row execute function booking_tokens_revocation_once();
