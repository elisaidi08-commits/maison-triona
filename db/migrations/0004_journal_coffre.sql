-- Journal d'accès du coffre (story 3.2 C, relecture sécurité) : actions de connexion distinguées,
-- limitations journalisées, index des échecs récents (verrou par compte et disjoncteur,
-- src/lib/auth/auth.ts). Toujours sans contenu.
-- password_ok : mot de passe juste, second facteur attendu. login : session ouverte par le TOTP
-- (ou par le mot de passe, pour un compte qui doit encore enrôler son TOTP). login_backup_code :
-- session ouverte par un code de secours. totp_enrolled : TOTP confirmé, session ouverte.
-- rate_limited : réponse 429, une ligne au plus par route et par 15 minutes ; l'acteur est alors
-- la route (« limitation:/sign-in/email »), pseudo-acteur comme « system ».

alter table vault_access_log drop constraint vault_access_log_action_check;
alter table vault_access_log add constraint vault_access_log_action_check check (
  action in (
    'login', 'login_backup_code', 'login_failed', 'password_ok', 'totp_enrolled',
    'rate_limited', 'logout', 'list',
    'read', 'export', 'delete', 'purge', 'freeze', 'unfreeze'
  )
);

create index vault_access_log_echecs_idx
  on vault_access_log (at desc) where action = 'login_failed';
create index vault_access_log_echecs_acteur_idx
  on vault_access_log (actor, at desc) where action = 'login_failed';
create index vault_access_log_limites_idx
  on vault_access_log (actor, at desc) where action = 'rate_limited';
