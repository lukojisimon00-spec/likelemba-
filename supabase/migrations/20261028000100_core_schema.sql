-- =============================================================================
-- LIKELEMBA — Migration 1 : schéma principal
-- -----------------------------------------------------------------------------
-- Principes :
--   * Les montants sont stockés en numeric(14,2) avec leur devise (USD ou CDF).
--     Aucune colonne ne mélange deux devises ; aucun calcul ne convertit.
--   * Aucun historique financier n'est supprimé : pas de DELETE sur les
--     tables financières, les membres sont « retirés » (status = 'removed').
--   * Les opérations sont simulées : is_simulated est forcé à true tant que
--     les paiements réels ne sont pas validés (voir docs/PAIEMENTS.md).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- Schéma non exposé par l'API pour les fonctions d'aide internes.
create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.currency_code as enum ('USD', 'CDF');
create type public.contribution_frequency as enum ('weekly', 'biweekly', 'monthly');
create type public.account_status as enum ('active', 'suspended');
create type public.group_status as enum ('active', 'archived');
create type public.member_role as enum ('manager', 'treasurer', 'member');
create type public.member_status as enum ('invited', 'active', 'removed');
create type public.cycle_status as enum ('draft', 'preparing', 'active', 'completed', 'cancelled');
create type public.contribution_status as enum ('pending', 'confirmed', 'failed', 'cancelled');
create type public.payout_status as enum ('pending', 'paid', 'failed', 'cancelled');
create type public.fee_status as enum ('due', 'paid', 'waived', 'cancelled');
create type public.destination_type as enum ('mobile_money', 'bank_account');

-- Numéro mobile RDC au format international : +243 suivi de 9 chiffres
-- commençant par 8 ou 9 (Vodacom, Airtel, Orange, Africell…).
create domain public.drc_phone as text
  check (value ~ '^\+243[89][0-9]{8}$');

-- -----------------------------------------------------------------------------
-- Mise à jour automatique de updated_at
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles : une ligne par compte Supabase Auth
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  full_name         text not null default '' check (char_length(full_name) <= 120),
  phone             public.drc_phone,
  account_status    public.account_status not null default 'active',
  suspended_at      timestamptz,
  suspension_reason text check (char_length(suspension_reason) <= 500),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.profiles is
  'Profil public minimal de chaque utilisateur. Le statut de compte n''est modifiable que par un administrateur via admin_set_account_status().';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Les administrateurs de la plateforme sont attribués uniquement côté serveur
-- (SQL Editor Supabase ou clé service_role). Aucune politique d'écriture.
create table public.platform_admins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  granted_at timestamptz not null default now(),
  note       text check (char_length(note) <= 200)
);

comment on table public.platform_admins is
  'Liste des administrateurs. Écriture réservée au rôle service_role / SQL Editor.';

-- Paramètres non sensibles de la plateforme (ex. montant des frais de service).
create table public.platform_settings (
  key         text primary key check (key ~ '^[a-z][a-z0-9_]{1,62}$'),
  value       jsonb not null,
  description text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function private.set_updated_at();

insert into public.platform_settings (key, value, description) values
  ('service_fee_amount_usd', '1.00'::jsonb,
   'Frais LIKELEMBA par groupe et par cycle, en USD. Jamais converti automatiquement en CDF.'),
  ('payments_mode', '"simulation"'::jsonb,
   'Mode des paiements. Seule la valeur "simulation" est prise en charge dans le MVP.');

-- -----------------------------------------------------------------------------
-- groups : un groupe de likelemba
-- -----------------------------------------------------------------------------
create table public.groups (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references public.profiles (id) on delete restrict,
  name                text not null check (char_length(btrim(name)) between 2 and 80),
  description         text not null default '' check (char_length(description) <= 1000),
  currency            public.currency_code not null,
  contribution_amount numeric(14, 2) not null check (contribution_amount > 0),
  frequency           public.contribution_frequency not null,
  max_members         integer not null check (max_members between 2 and 100),
  rules               text not null default '' check (char_length(rules) <= 4000),
  status              public.group_status not null default 'active',
  is_demo             boolean not null default false,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint groups_archived_consistency
    check ((status = 'archived') = (archived_at is not null))
);

comment on column public.groups.is_demo is
  'true = groupe de démonstration, à afficher clairement comme tel dans l''interface.';

create index groups_owner_id_idx on public.groups (owner_id);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- group_members : membres d'un groupe (avec ou sans compte LIKELEMBA)
-- -----------------------------------------------------------------------------
create table public.group_members (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups (id) on delete restrict,
  profile_id     uuid references public.profiles (id) on delete set null,
  full_name      text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone          public.drc_phone,
  role           public.member_role not null default 'member',
  status         public.member_status not null default 'active',
  joined_at      date not null default current_date,
  removed_at     timestamptz,
  removal_reason text check (char_length(removal_reason) <= 500),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint group_members_removed_consistency
    check ((status = 'removed') = (removed_at is not null))
);

comment on table public.group_members is
  'Un membre peut exister sans compte (profile_id nul). Un membre retiré garde tout son historique.';

create index group_members_group_id_idx on public.group_members (group_id);
create index group_members_profile_id_idx on public.group_members (profile_id);
-- Un même numéro ou un même compte ne peut figurer qu'une fois parmi les membres non retirés.
create unique index group_members_unique_phone
  on public.group_members (group_id, phone)
  where phone is not null and status <> 'removed';
create unique index group_members_unique_profile
  on public.group_members (group_id, profile_id)
  where profile_id is not null and status <> 'removed';

create trigger group_members_set_updated_at
  before update on public.group_members
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- cycles : un tour complet de likelemba
-- -----------------------------------------------------------------------------
create table public.cycles (
  id                  uuid primary key default gen_random_uuid(),
  group_id            uuid not null references public.groups (id) on delete restrict,
  cycle_number        integer not null check (cycle_number > 0),
  status              public.cycle_status not null default 'draft',
  -- Copiés depuis le groupe à la création : un cycle ne change jamais de devise.
  currency            public.currency_code not null,
  contribution_amount numeric(14, 2) not null check (contribution_amount > 0),
  frequency           public.contribution_frequency not null,
  start_date          date not null,
  planned_end_date    date,
  created_by          uuid references public.profiles (id) on delete set null,
  prepared_at         timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  cancelled_at        timestamptz,
  cancellation_reason text check (char_length(cancellation_reason) <= 500),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint cycles_unique_number unique (group_id, cycle_number),
  constraint cycles_end_after_start
    check (planned_end_date is null or planned_end_date >= start_date)
);

create index cycles_group_id_idx on public.cycles (group_id);
-- Un seul cycle ouvert (brouillon, en préparation ou actif) par groupe.
create unique index cycles_one_open_per_group
  on public.cycles (group_id)
  where status in ('draft', 'preparing', 'active');

create trigger cycles_set_updated_at
  before update on public.cycles
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- cycle_participants : membres participant à un cycle et ordre des bénéficiaires
-- -----------------------------------------------------------------------------
create table public.cycle_participants (
  id              uuid primary key default gen_random_uuid(),
  cycle_id        uuid not null references public.cycles (id) on delete restrict,
  member_id       uuid not null references public.group_members (id) on delete restrict,
  payout_position integer not null check (payout_position > 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint cycle_participants_unique_member unique (cycle_id, member_id),
  -- Différée pour permettre d'échanger deux positions dans une même transaction.
  constraint cycle_participants_unique_position unique (cycle_id, payout_position)
    deferrable initially deferred
);

create index cycle_participants_member_id_idx on public.cycle_participants (member_id);

create trigger cycle_participants_set_updated_at
  before update on public.cycle_participants
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- contribution_schedules : une échéance (un tour) par bénéficiaire
-- -----------------------------------------------------------------------------
create table public.contribution_schedules (
  id                         uuid primary key default gen_random_uuid(),
  cycle_id                   uuid not null references public.cycles (id) on delete restrict,
  round_number               integer not null check (round_number > 0),
  due_date                   date not null,
  beneficiary_participant_id uuid not null references public.cycle_participants (id) on delete restrict,
  amount_per_member          numeric(14, 2) not null check (amount_per_member > 0),
  currency                   public.currency_code not null,
  created_at                 timestamptz not null default now(),
  constraint contribution_schedules_unique_round unique (cycle_id, round_number)
);

create index contribution_schedules_due_date_idx on public.contribution_schedules (due_date);

-- -----------------------------------------------------------------------------
-- contributions : cotisations (simulées dans le MVP)
-- -----------------------------------------------------------------------------
create table public.contributions (
  id                 uuid primary key default gen_random_uuid(),
  cycle_id           uuid not null references public.cycles (id) on delete restrict,
  schedule_id        uuid not null references public.contribution_schedules (id) on delete restrict,
  participant_id     uuid not null references public.cycle_participants (id) on delete restrict,
  amount             numeric(14, 2) not null check (amount > 0),
  currency           public.currency_code not null,
  status             public.contribution_status not null default 'pending',
  is_simulated       boolean not null default true,
  provider           text not null default 'simulation',
  provider_reference text,
  idempotency_key    text not null unique check (char_length(idempotency_key) between 8 and 100),
  receipt_number     text unique,
  failure_reason     text check (char_length(failure_reason) <= 500),
  recorded_by        uuid references public.profiles (id) on delete set null,
  paid_at            timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Verrou MVP : aucune opération réelle ne peut être enregistrée.
  constraint contributions_simulation_only
    check (is_simulated and provider = 'simulation'),
  constraint contributions_paid_when_confirmed
    check ((status = 'confirmed') = (paid_at is not null))
);

create index contributions_cycle_id_idx on public.contributions (cycle_id);
create index contributions_participant_id_idx on public.contributions (participant_id);
-- Empêche une double cotisation pour la même échéance et le même participant.
create unique index contributions_one_active_per_schedule
  on public.contributions (schedule_id, participant_id)
  where status in ('pending', 'confirmed');

create trigger contributions_set_updated_at
  before update on public.contributions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- payment_destinations : préférence de réception des fonds d'un membre
-- -----------------------------------------------------------------------------
-- Aucune donnée d'authentification (code PIN, mot de passe, code OTP) n'est
-- stockée ici, et aucune colonne n'est prévue pour cela.
create table public.payment_destinations (
  id                  uuid primary key default gen_random_uuid(),
  member_id           uuid not null references public.group_members (id) on delete restrict,
  destination_type    public.destination_type not null,
  provider_name       text not null check (char_length(btrim(provider_name)) between 2 and 80),
  account_holder_name text not null check (char_length(btrim(account_holder_name)) between 2 and 120),
  mobile_number       public.drc_phone,
  bank_account_number text check (bank_account_number ~ '^[A-Z0-9 -]{6,40}$'),
  is_default          boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint payment_destinations_fields check (
    (destination_type = 'mobile_money' and mobile_number is not null and bank_account_number is null)
    or (destination_type = 'bank_account' and bank_account_number is not null and mobile_number is null)
  )
);

create index payment_destinations_member_id_idx on public.payment_destinations (member_id);
create unique index payment_destinations_one_default
  on public.payment_destinations (member_id) where is_default;

create trigger payment_destinations_set_updated_at
  before update on public.payment_destinations
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- payout_orders : versement du tour au bénéficiaire (simulé dans le MVP)
-- -----------------------------------------------------------------------------
create table public.payout_orders (
  id             uuid primary key default gen_random_uuid(),
  cycle_id       uuid not null references public.cycles (id) on delete restrict,
  schedule_id    uuid not null unique references public.contribution_schedules (id) on delete restrict,
  participant_id uuid not null references public.cycle_participants (id) on delete restrict,
  amount         numeric(14, 2) not null check (amount > 0),
  currency       public.currency_code not null,
  status         public.payout_status not null default 'pending',
  destination_id uuid references public.payment_destinations (id) on delete set null,
  is_simulated   boolean not null default true,
  paid_at        timestamptz,
  paid_by        uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint payout_orders_simulation_only check (is_simulated),
  constraint payout_orders_paid_consistency check ((status = 'paid') = (paid_at is not null))
);

create index payout_orders_cycle_id_idx on public.payout_orders (cycle_id);
create index payout_orders_participant_id_idx on public.payout_orders (participant_id);

create trigger payout_orders_set_updated_at
  before update on public.payout_orders
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- service_fees : frais LIKELEMBA (1 USD par groupe et par cycle)
-- -----------------------------------------------------------------------------
-- Facturés au groupe, jamais déduits des sommes destinées aux membres.
create table public.service_fees (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups (id) on delete restrict,
  cycle_id     uuid not null unique references public.cycles (id) on delete restrict,
  amount       numeric(14, 2) not null check (amount >= 0),
  currency     public.currency_code not null default 'USD',
  status       public.fee_status not null default 'due',
  is_simulated boolean not null default true,
  due_at       timestamptz not null default now(),
  paid_at      timestamptz,
  paid_by      uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Les frais sont toujours exprimés en USD : aucune conversion implicite.
  constraint service_fees_usd_only check (currency = 'USD'),
  constraint service_fees_simulation_only check (is_simulated),
  constraint service_fees_paid_consistency check ((status = 'paid') = (paid_at is not null))
);

create index service_fees_group_id_idx on public.service_fees (group_id);

create trigger service_fees_set_updated_at
  before update on public.service_fees
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- audit_logs : journal d'audit en ajout seul
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  actor_id    uuid,
  group_id    uuid,
  entity_type text not null,
  entity_id   uuid,
  action      text not null,
  details     jsonb not null default '{}'::jsonb
);

comment on table public.audit_logs is
  'Journal en ajout seul. Aucune mise à jour ni suppression n''est autorisée, même pour les administrateurs.';

create index audit_logs_group_id_idx on public.audit_logs (group_id, created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create or replace function private.prevent_audit_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Le journal d''audit ne peut pas être modifié ni supprimé.';
end;
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_changes();
