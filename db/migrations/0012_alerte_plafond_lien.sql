-- Alerte à Sady au premier dépassement du jour du plafond global des demandes de lien (story 3.9,
-- suites ; décision de Sady du 20/11/2026, D72 ; docs/architecture.md §6.6). Même mécanisme que
-- l'alerte du plafond de notifications (0009) : nouvel événement `link_cap`, écrit par le rôle
-- `envoi` (le site public n'a aucun droit sur les colonnes d'alerte, db/roles/site_public.sql), une
-- fois par jour UTC au plus. Il ne concerne aucun message, aucune demande ni aucune adresse : il ne
-- porte aucun identifiant (`alert_subject` nul).
-- Forme d'une ligne, désormais :
-- - alerte technique : un événement ; l'identifiant du message en cause, sauf pour les deux
--   alertes de plafond (`notify_cap`, `link_cap`), qui n'en ont jamais ;
-- - autres gabarits : ni événement ni identifiant d'alerte (inchangé).
-- Le reste de la table ne change pas. Les lignes existantes sont revérifiées par l'ajout des
-- contraintes : une ligne non conforme ferait échouer la migration, sans rien modifier.

alter table outbox drop constraint outbox_alert_event_check;
alter table outbox add constraint outbox_alert_event_check
  check (alert_event in ('send_failed', 'undelivered', 'tracking_expired', 'notify_cap', 'link_cap'));

alter table outbox drop constraint outbox_alert_shape;
alter table outbox add constraint outbox_alert_shape check (
  case
    when template = 'technical_alert' then
      alert_event is not null
        and (alert_event in ('notify_cap', 'link_cap')) = (alert_subject is null)
    else alert_event is null and alert_subject is null
  end
);
