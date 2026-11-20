-- Rôle du site public (story 3.2 B, docs/coffre-cles.md §3) : la Server Action du formulaire écrit
-- des demandes scellées, et rien d'autre. Ni lecture (même pas l'identifiant : il est tiré côté
-- serveur, l'insertion se fait sans RETURNING), ni modification, ni effacement, ni journal d'accès.
-- Elle écrit aussi, dans la même transaction, la notification de sa demande dans la boîte d'envoi
-- (story 3.3) : insertion seule, sans lecture, et limitée aux colonnes d'une notification (celles
-- de `enqueueNotification`, src/lib/outbox/repository.ts). L'état, les tentatives, les dates,
-- l'identifiant du prestataire et les alertes restent au rôle `envoi` : une fonction serveur
-- compromise ne peut pas forger une ligne « acceptée » ni une alerte.
-- Depuis la story 3.10, la réservation d'appel : lecture des disponibilités, du créneau et du statut
-- des réservations (jamais le contenu scellé), vérification et consommation des jetons, insertion
-- d'une réservation (voir en bas). Depuis la story 3.9, la demande de lien : création d'un lien
-- d'accès, annulation du précédent, e-mail d'accès dans la boîte d'envoi (voir en bas).
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
grant insert (id, template, request_id, priority) on outbox to site_public;

-- Réservation d'appel (story 3.10, db/migrations/0008_reservations.sql ; docs/reservation-appel.md
-- §4.2). La page publique calcule les créneaux : disponibilités de Cat en lecture (rien de personnel),
-- et des réservations, l'identifiant, le lien qui a servi, le créneau et le statut seulement : jamais
-- `sealed`, ni la version de la politique, ni les dates de création et de conservation. Jetons : les
-- colonnes utiles à la vérification, et `used_at` seul en écriture (consommer le lien ; il donne
-- aussi le verrou de ligne, SELECT … FOR UPDATE). Création et annulation : story 3.9, en bas ;
-- aucun effacement. Réservation : insertion des colonnes écrites par la page ; le statut
-- n'en fait pas partie, une réservation naît toujours « confirmée » (valeur par défaut).
grant select on booking_settings, availability_rules, availability_exceptions to site_public;
grant select (id, access_token_id, starts_at, ends_at, slot, status) on bookings to site_public;
grant insert (
  id, access_token_id, starts_at, ends_at, slot, privacy_version, retention_until, sealed
) on bookings to site_public;
grant select (id, token_hash, purpose, created_at, expires_at, used_at, revoked_at)
  on booking_tokens to site_public;
grant update (used_at) on booking_tokens to site_public;

-- Demande de lien (story 3.9, db/migrations/0011_demande_de_lien.sql ; docs/reservation-appel.md
-- §2, §4.4) : création d'un lien d'accès avec l'empreinte de l'adresse (jamais l'adresse, jamais le
-- jeton : son empreinte seule) ; annulation des liens vivants de CETTE empreinte (« un nouveau lien
-- annule l'ancien ») par la seule fonction `revoke_live_access_links`, sans lecture des empreintes ni
-- écriture de `revoked_at`. Aucun effacement. L'e-mail d'accès entre dans la boîte d'envoi par le
-- droit d'insertion déjà donné plus haut (gabarit `booking_access`, sans demande : contrainte de
-- 0011).
grant insert (id, token_hash, purpose, email_hmac, created_at, expires_at)
  on booking_tokens to site_public;
grant execute on function revoke_live_access_links(bytea, timestamptz) to site_public;
