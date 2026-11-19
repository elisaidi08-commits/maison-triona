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
-- d'une réservation (voir en bas).
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
-- aussi le verrou de ligne, SELECT … FOR UPDATE). Aucune création de jeton (story 3.9), ni
-- annulation, ni effacement. Réservation : insertion des colonnes écrites par la page ; le statut
-- n'en fait pas partie, une réservation naît toujours « confirmée » (valeur par défaut).
grant select on booking_settings, availability_rules, availability_exceptions to site_public;
grant select (id, access_token_id, starts_at, ends_at, slot, status) on bookings to site_public;
grant insert (
  id, access_token_id, starts_at, ends_at, slot, privacy_version, retention_until, sealed
) on bookings to site_public;
grant select (id, token_hash, purpose, created_at, expires_at, used_at, revoked_at)
  on booking_tokens to site_public;
grant update (used_at) on booking_tokens to site_public;
