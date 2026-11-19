-- Alerte à Sady au premier dépassement du jour du plafond de notifications (story 3.3, suites ;
-- décision de Sady du 19/11/2026, D70 ; docs/architecture.md §6.6). Numéro 0009 : 0008 est réservé
-- à la réservation (story 3.10).
-- Nouvel événement `notify_cap` : écrit par le rôle `envoi` (le site public n'a aucun droit sur les
-- colonnes d'alerte, db/roles/site_public.sql), une fois par jour UTC au plus. Il ne concerne aucun
-- message ni aucune demande : il ne porte aucun identifiant (`alert_subject` nul).
-- Forme d'une ligne, désormais :
-- - alerte technique : un événement ; l'identifiant du message en cause, sauf pour `notify_cap`,
--   qui n'en a jamais ;
-- - notification : ni événement ni identifiant d'alerte (elle garde sa demande, contrainte
--   `outbox_notification_shape`, inchangée).
-- Le reste de la table ne change pas. Les lignes existantes sont revérifiées par l'ajout des
-- contraintes : une ligne non conforme ferait échouer la migration, sans rien modifier.

alter table outbox drop constraint outbox_alert_event_check;
alter table outbox add constraint outbox_alert_event_check
  check (alert_event in ('send_failed', 'undelivered', 'tracking_expired', 'notify_cap'));

alter table outbox drop constraint outbox_alert_shape;
alter table outbox add constraint outbox_alert_shape check (
  case
    when template = 'technical_alert' then
      alert_event is not null and (alert_event = 'notify_cap') = (alert_subject is null)
    else alert_event is null and alert_subject is null
  end
);
