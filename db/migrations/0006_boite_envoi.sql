-- Boîte d'envoi des e-mails (story 3.3, docs/architecture.md §6.6). Écrite dans la même
-- transaction que la demande. Aucune adresse ni aucun contenu de demande : un gabarit et des
-- identifiants ; les destinataires (Cat, Sady) sont lus dans la configuration à l'envoi.
-- Pas de clé étrangère vers vault_requests : la demande peut être effacée avant l'envoi.
create table outbox (
  id uuid primary key,
  created_at timestamptz not null default now(),
  template text not null check (template in ('request_notification', 'technical_alert')),
  request_id uuid,
  priority boolean not null default false,
  alert_event text check (alert_event in ('send_failed', 'undelivered', 'tracking_expired')),
  alert_subject uuid,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'delivered', 'undelivered', 'failed')),
  attempts smallint not null default 0 check (attempts between 0 and 10),
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  provider_id text check (length(provider_id) between 1 and 100),
  provider_flags text[] not null default '{}',
  last_error text check (length(last_error) between 1 and 60),
  accepted_at timestamptz,
  constraint outbox_alert_shape check (
    (template = 'technical_alert') = (alert_event is not null and alert_subject is not null)
  ),
  constraint outbox_notification_shape check (
    template <> 'request_notification' or request_id is not null
  ),
  constraint outbox_accepted_shape check (
    status in ('pending', 'failed') or (provider_id is not null and accepted_at is not null)
  )
);
create index outbox_due_idx on outbox (next_attempt_at) where status = 'pending';
create index outbox_tracking_idx on outbox (accepted_at) where status = 'accepted';
create index outbox_created_idx on outbox (created_at);
