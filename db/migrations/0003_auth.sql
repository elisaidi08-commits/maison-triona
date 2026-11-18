-- Authentification du coffre (story 3.2, partie C ; D67) : schéma de Better Auth 1.7.25.
-- Numéro 0003 : 0002 est réservé à la partie B (0002_consentement.sql).
-- Généré par `getMigrations(auth.options).compileMigrations()` de better-auth (le plan que sa CLI
-- `generate` imprime pour Kysely), avec la configuration de src/lib/auth/auth.ts, sur une base vide.
-- Recopié tel quel, une instruction par bloc : noms de Better Auth conservés (tables, colonnes en
-- camelCase entre guillemets), pour comparer ligne à ligne lors d'une montée de version. Better Auth
-- vérifie ce schéma à sa première utilisation (`validateSchema`).
-- Secrets TOTP et codes de secours : chiffrés par Better Auth avec BETTER_AUTH_SECRET. Mots de passe :
-- empreinte scrypt. `rateLimit` garde « IP|chemin » le temps de la fenêtre de limitation.

create table "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null,
  "image" text,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null,
  "twoFactorEnabled" boolean
);

-- `twoFactorVerified` (champ ajouté par la configuration) : session ouverte par un code TOTP ou un
-- code de secours. Sans valeur par défaut, comme Better Auth le génère : une insertion qui
-- l'oublierait échoue, elle n'ouvre rien.
create table "session" (
  "id" text not null primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade,
  "twoFactorVerified" boolean not null
);

create table "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz not null
);

create table "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null
);

create table "twoFactor" (
  "id" text not null primary key,
  "secret" text not null,
  "backupCodes" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "verified" boolean,
  "failedVerificationCount" integer,
  "lockedUntil" timestamptz
);

create table "rateLimit" (
  "id" text not null primary key,
  "key" text not null unique,
  "count" integer not null,
  "lastRequest" bigint not null
);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");

create index "twoFactor_secret_idx" on "twoFactor" ("secret");

create index "twoFactor_userId_idx" on "twoFactor" ("userId");

-- Ajouts de la maison, hors Better Auth.

-- Deux comptes nominatifs au plus (docs/architecture.md §6.5), quel que soit le chemin d'insertion :
-- double la règle de scripts/coffre-compte.mjs. Le verrou de transaction sérialise deux créations
-- simultanées ; le message ne cite aucune valeur.
create function coffre_deux_comptes_au_plus() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('maison-triona:comptes'));
  if (select count(*) from "user") >= 2 then
    raise exception 'Coffre : deux comptes au plus' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger coffre_deux_comptes_au_plus
  before insert on "user"
  for each row execute function coffre_deux_comptes_au_plus();

-- Journal d'accès : échecs de connexion, déconnexions et lectures de la liste, toujours sans contenu.
alter table vault_access_log drop constraint vault_access_log_action_check;
alter table vault_access_log add constraint vault_access_log_action_check check (
  action in (
    'login', 'login_failed', 'logout', 'list',
    'read', 'export', 'delete', 'purge', 'freeze', 'unfreeze'
  )
);
