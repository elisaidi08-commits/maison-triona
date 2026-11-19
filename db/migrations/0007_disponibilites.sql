-- Disponibilités de Cat (story 3.8, partie B ; docs/reservation-appel.md §3.1, §4.1). Trois tables en
-- clair : rien de personnel, seulement des heures et des dates. Numéro 0007 : 0006 est réservé à la
-- boîte d'envoi (story 3.3), 0008 à la réservation (story 3.10).
-- Les bornes des réglages doublent celles de la validation du coffre (SETTINGS_LIMITS,
-- src/lib/booking/settings.ts) : une écriture qui contournerait l'application est refusée aussi.

-- Réglages : une seule ligne (`id` toujours vrai). Valeurs par défaut validées par Sady le 06/11/2026
-- (§3.1) : 30 min, pause 15 min, délai 24 h, horizon 3 semaines, 4 appels par jour au plus.
-- Fuseau figé sur Bruxelles : en changer demandera une migration, pas un formulaire.
create table booking_settings (
  id boolean primary key default true check (id),
  time_zone text not null default 'Europe/Brussels' check (time_zone = 'Europe/Brussels'),
  duration_minutes integer not null default 30
    check (duration_minutes between 15 and 120 and duration_minutes % 5 = 0),
  buffer_minutes integer not null default 15
    check (buffer_minutes between 0 and 60 and buffer_minutes % 5 = 0),
  min_notice_minutes integer not null default 1440
    check (min_notice_minutes between 60 and 10080 and min_notice_minutes % 60 = 0),
  horizon_days integer not null default 21 check (horizon_days between 1 and 90),
  daily_cap integer not null default 4 check (daily_cap between 1 and 12),
  updated_at timestamptz not null default now()
);

insert into booking_settings default values;

-- Semaine type : plages d'ouverture en heure locale (1 = lundi … 7 = dimanche), à la minute.
create table availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 1 and 7),
  start_time time(0) not null check (extract(second from start_time) = 0),
  end_time time(0) not null check (extract(second from end_time) = 0),
  created_at timestamptz not null default now(),
  constraint availability_rules_order_check check (start_time < end_time)
);

create index availability_rules_weekday_idx on availability_rules (weekday, start_time);

-- Deux plages d'un même jour ne se chevauchent pas (elles peuvent se toucher : 12 h 30 puis 12 h 30).
-- Le verrou de transaction sérialise deux ajouts simultanés ; le message ne cite aucune valeur.
create function availability_rules_sans_chevauchement() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('maison-triona:semaine-type'));
  if exists (
    select 1 from availability_rules
    where weekday = new.weekday and id <> new.id
      and start_time < new.end_time and new.start_time < end_time
  ) then
    raise exception 'Semaine type : deux plages se chevauchent' using errcode = 'exclusion_violation';
  end if;
  return new;
end;
$$;

create trigger availability_rules_sans_chevauchement
  before insert or update on availability_rules
  for each row execute function availability_rules_sans_chevauchement();

-- Lundi à vendredi, 10 h 30-12 h 30 et 16 h-18 h (D41 : fin de matinée, fin d'après-midi).
insert into availability_rules (weekday, start_time, end_time)
select jour, debut, fin
from generate_series(1, 5) as jour,
  (values (time '10:30', time '12:30'), (time '16:00', time '18:00')) as plage (debut, fin);

-- Absences, dates locales incluses : congé (plage de dates), jour férié (prérempli, décochable :
-- `active`), journée bloquée (en un clic). Aucun texte libre : seul un jour férié porte un nom,
-- celui de la liste (src/lib/booking/belgian-holidays.ts).
create table availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('leave', 'holiday', 'blocked')),
  start_date date not null,
  end_date date not null,
  label text check (length(label) between 1 and 40),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint availability_exceptions_order_check check (start_date <= end_date),
  constraint availability_exceptions_length_check check (end_date - start_date < 366),
  -- Un jour férié et une journée bloquée tiennent sur un jour.
  constraint availability_exceptions_day_check check (kind = 'leave' or start_date = end_date),
  constraint availability_exceptions_holiday_label_check check ((kind = 'holiday') = (label is not null)),
  -- Seul un jour férié se décoche ; un congé ou une journée bloquée se retire.
  constraint availability_exceptions_active_check check (kind = 'holiday' or active)
);

-- Un jour férié ou une journée bloquée par date : un double clic ne crée rien de plus.
create unique index availability_exceptions_day_idx
  on availability_exceptions (kind, start_date) where kind in ('holiday', 'blocked');
create index availability_exceptions_end_idx on availability_exceptions (end_date);

-- Jours fériés belges de 2026 à 2035, préremplis et actifs. Même calcul que belgianHolidays()
-- (Pâques : algorithme de Meeus, Jones et Butcher ; entiers positifs, la division tronque comme
-- Math.floor) ; tests/integration/disponibilites-schema.test.ts compare les deux. Les années
-- suivantes se préremplissent depuis /coffre/disponibilites.
with annee as (
  select y from generate_series(2026, 2035) as y
), paques as (
  select y, make_date(y, n / 31, n % 31 + 1) as dimanche
  from annee,
    lateral (select y % 19 as a, y / 100 as b, y % 100 as c) as s1,
    lateral (select b / 4 as d, b % 4 as e, (b + 8) / 25 as f) as s2,
    lateral (select (b - f + 1) / 3 as g) as s3,
    lateral (select (19 * a + b - d - g + 15) % 30 as h, c / 4 as i, c % 4 as k) as s4,
    lateral (select (32 + 2 * e + 2 * i - h - k) % 7 as l) as s5,
    lateral (select (a + 11 * h + 22 * l) / 451 as m) as s6,
    lateral (select h + l - 7 * m + 114 as n) as s7
)
insert into availability_exceptions (kind, start_date, end_date, label)
select 'holiday', jour, jour, nom
from paques,
  lateral (
    values
      (make_date(y, 1, 1), 'Jour de l’An'),
      (dimanche + 1, 'Lundi de Pâques'),
      (make_date(y, 5, 1), 'Fête du Travail'),
      (dimanche + 39, 'Ascension'),
      (dimanche + 50, 'Lundi de Pentecôte'),
      (make_date(y, 7, 21), 'Fête nationale'),
      (make_date(y, 8, 15), 'Assomption'),
      (make_date(y, 11, 1), 'Toussaint'),
      (make_date(y, 11, 11), 'Armistice'),
      (make_date(y, 12, 25), 'Noël')
  ) as ferie (jour, nom);

-- Journal d'accès : `availability`, une ligne par modification des disponibilités (réglages, semaine
-- type, absences, jours fériés, journée bloquée), au nom du compte, sans demande visée et sans
-- aucune valeur (ni heure, ni date, ni nombre). Liste complète, recopiée de 0005 : une autre
-- migration qui redéfinit cette contrainte (0006, boîte d'envoi) doit garder `availability`, et
-- celle-ci les actions de 0006 si elle en ajoute ; à réconcilier par la seconde fusionnée.
alter table vault_access_log drop constraint vault_access_log_action_check;
alter table vault_access_log add constraint vault_access_log_action_check check (
  action in (
    'login', 'login_backup_code', 'login_failed', 'password_ok', 'totp_enrolled',
    'rate_limited', 'logout', 'list',
    'read', 'export', 'delete', 'purge', 'freeze', 'unfreeze', 'retention',
    'availability'
  )
);

alter table vault_access_log add constraint vault_access_log_availability_check check (
  action <> 'availability' or request_id is null
);
