-- Coffre des demandes (story 3.2). Le contenu arrive chiffré (sealed box) : la base ne voit
-- jamais de nom, de coordonnée ni de message en clair. Colonnes en clair = colonnes de tri.

create table vault_requests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('request', 'urgent')),
  created_at timestamptz not null default now(),
  -- Listes fermées validées par l'application (Zod) ; pas de contrainte ici pour pouvoir les faire
  -- évoluer sans migration.
  service text,
  country text,
  locale text not null check (locale in ('fr', 'en')),
  urgency text,
  source text,
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed')),
  -- Limitation (RGPD art. 18) : une demande gelée n'est jamais effacée automatiquement.
  frozen boolean not null default false,
  retention_until timestamptz not null,
  -- Sealed box libsodium : 48 octets de surcoût, donc au moins 49 octets.
  sealed bytea not null check (octet_length(sealed) between 49 and 65536)
);

create index vault_requests_created_at_idx on vault_requests (created_at desc);
create index vault_requests_retention_idx on vault_requests (retention_until) where not frozen;

-- Journal d'accès : jamais de contenu. Pas de clé étrangère : il survit à l'effacement.
create table vault_access_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null check (length(actor) between 1 and 120),
  action text not null check (
    action in ('login', 'read', 'export', 'delete', 'purge', 'freeze', 'unfreeze')
  ),
  request_id uuid
);

create index vault_access_log_request_idx on vault_access_log (request_id, at desc);
