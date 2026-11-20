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
-- d'accès, annulation du précédent, e-mail d'accès dans la boîte d'envoi (voir en bas). Depuis la
-- story 3.11, le lien de gestion : sa création par une fonction, le déplacement et l'annulation d'un
-- appel (voir en bas).
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
-- `sealed`, ni la version de la politique, ni les dates de création et de conservation. Jetons :
-- depuis la story 3.11, AUCUNE lecture directe (ni l'empreinte, ni l'adresse, ni les liens vivants) :
-- un lien se retrouve par `find_booking_token` et `lock_booking_token` (verrou de ligne), sur
-- l'empreinte du jeton reçu. Création et annulation : story 3.9, en bas ; aucun effacement.
grant select on booking_settings, availability_rules, availability_exceptions to site_public;
grant select (id, access_token_id, starts_at, ends_at, slot, status, sequence)
  on bookings to site_public;
-- Depuis la story 3.11 (troisième relecture sécurité) : ni insertion d'un appel, ni lecture, ni
-- écriture directe des jetons. Réserver passe par `book_slot_as_guest` (en bas).

-- Demande de lien (story 3.9, db/migrations/0011_demande_de_lien.sql ; docs/reservation-appel.md
-- §2, §4.4) : création d'un lien d'accès avec l'empreinte de l'adresse (jamais l'adresse, jamais le
-- jeton : son empreinte seule), sans `created_at` ni `purpose` (valeurs par défaut de la base : un
-- lien d'accès, de 48 heures au plus depuis l'heure de la base) ; annulation des liens vivants de CETTE empreinte (« un nouveau lien
-- annule l'ancien ») par la seule fonction `revoke_live_access_links`, sans lecture des empreintes ni
-- écriture de `revoked_at`. Aucun effacement. L'e-mail d'accès entre dans la boîte d'envoi par le
-- droit d'insertion déjà donné plus haut (gabarit `booking_access`, sans demande : contrainte de
-- 0011).
-- Insertion sans RETURNING (le site public ne lit aucune colonne des jetons, story 3.11).
grant insert (id, token_hash, email_hmac, expires_at) on booking_tokens to site_public;
grant execute on function revoke_live_access_links(bytea) to site_public;

-- Lien de gestion (story 3.11, db/migrations/0014_deplacer_annuler.sql ; docs/reservation-appel.md
-- §2, étapes 4 et 6 ; relecture sécurité) : le site public n'a AUCUN droit d'écriture sur `bookings`.
-- Tout passe par des fonctions SECURITY DEFINER qui exigent l'empreinte d'un lien valable, qu'il ne
-- peut pas lire (plus haut) : il ne vise donc un appel qu'avec le jeton de son lien de gestion.
-- - `book_slot_as_guest` : réserver, par l'empreinte d'un lien d'accès vivant ; l'appel est inséré
--   dans les bornes de la base (`bookings_insert_guard`), le lien consommé et le lien de gestion créé
--   (`issue_manage_token`, interne : le site public ne l'appelle plus) dans la même transaction ;
-- - `find_booking_token`, `lock_booking_token` : un lien par son empreinte (sans l'empreinte) ;
-- - `lock_call_as_guest`, `move_booking_as_guest`, `cancel_booking_as_guest` : verrouiller,
--   déplacer, annuler (« annulé par la personne ») l'appel d'un lien de gestion valable, et lui seul.
-- Les déclencheurs de 0014 bornent le déplacement (appel confirmé à venir, durée inchangée, pause des
-- réglages, horizon) et posent la séquence et l'échéance de conservation ; la contrainte d'exclusion
-- refuse tout chevauchement. Lecture de `booking_id` et de la séquence (plus haut). Aucun droit sur
-- le statut, le contenu scellé, l'échéance, le lien d'accès ni le rattachement ; aucun effacement.
-- REVOKE : un rôle déjà posé par une version précédente de ce fichier perd ces droits (le fichier
-- repart de toute façon de rien, en haut).
revoke update on bookings from site_public;
revoke insert on bookings from site_public;
revoke select, update on booking_tokens from site_public;
revoke execute on function issue_manage_token(uuid, bytea, uuid) from site_public;
grant execute on function
  book_slot_as_guest(bytea, timestamptz, timestamptz, timestamptz, text, bytea, bytea, timestamptz)
  to site_public;
grant execute on function find_booking_token(bytea) to site_public;
grant execute on function lock_booking_token(bytea) to site_public;
grant execute on function lock_call_as_guest(bytea) to site_public;
grant execute on function move_booking_as_guest(bytea, timestamptz, timestamptz, timestamptz)
  to site_public;
grant execute on function cancel_booking_as_guest(bytea) to site_public;
