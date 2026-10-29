-- LIKELEMBA — Migration 2, PARTIE 1 SUR 5 (copie manuelle, à exécuter dans l'ordre 1 → 5)
-- Source : supabase/migrations/20261028000200_business_rules.sql, lignes 1 à 202
-- =============================================================================
-- LIKELEMBA — Migration 2 : fonctions d'aide, règles métier et journal d'audit
-- -----------------------------------------------------------------------------
-- Les règles critiques (transitions d'état, montants, devises, doublons) sont
-- appliquées ici, dans la base, et pas seulement dans l'interface.
-- Les fonctions SECURITY DEFINER fixent search_path = '' et qualifient tous
-- les objets pour éviter les détournements de schéma.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Fonctions d'aide (schéma private, non exposé par l'API)
-- -----------------------------------------------------------------------------
-- IMPORTANT : les fonctions booléennes ci-dessous renvoient toujours true ou
-- false, jamais NULL. Un NULL ferait échouer silencieusement les tests du type
-- « if not private.is_group_manager(...) then raise ... » dans les RPC.

-- Vrai quand la requête vient directement d'un client (navigateur / API),
-- faux quand elle s'exécute à l'intérieur d'une fonction SECURITY DEFINER.
create or replace function private.is_client_context()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('authenticated', 'anon');
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins a where a.user_id = auth.uid()
  );
$$;

create or replace function private.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.account_status = 'active'
  );
$$;

-- Rôle de l'utilisateur courant dans un groupe (null s'il n'en est pas membre).
create or replace function private.group_role(p_group_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (select 1 from public.groups g where g.id = p_group_id and g.owner_id = auth.uid())
      then 'manager'::public.member_role
    else (
      select m.role from public.group_members m
      where m.group_id = p_group_id
        and m.profile_id = auth.uid()
        and m.status = 'active'
      limit 1
    )
  end;
$$;

create or replace function private.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.group_role(p_group_id) is not null;
$$;

create or replace function private.is_group_manager(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.group_role(p_group_id) = 'manager', false);
$$;

-- Responsable ou trésorier : peut enregistrer cotisations et versements.
create or replace function private.can_handle_money(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.group_role(p_group_id) in ('manager', 'treasurer'), false);
$$;

create or replace function private.cycle_group_id(p_cycle_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.group_id from public.cycles c where c.id = p_cycle_id;
$$;

create or replace function private.member_group_id(p_member_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.group_id from public.group_members m where m.id = p_member_id;
$$;

-- Vrai si le membre est rattaché au compte de l'utilisateur courant.
create or replace function private.is_own_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.id = p_member_id and m.profile_id = auth.uid()
  );
$$;

-- Arrête l'opération si l'utilisateur n'est pas connecté ou est suspendu.
create or replace function private.assert_active_user()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Vous devez être connecté.' using errcode = '42501';
  end if;
  if not private.is_active_account() then
    raise exception 'Votre compte est suspendu ou inexistant.' using errcode = '42501';
  end if;
end;
$$;

-- Date d'échéance d'un tour. Identique à computeDueDate() côté TypeScript.
-- Pour « monthly », PostgreSQL ramène au dernier jour du mois si besoin
-- (31 janvier + 1 mois = 28 ou 29 février).
create or replace function private.round_due_date(
  p_start date,
  p_frequency public.contribution_frequency,
  p_round integer
)
returns date
language sql
immutable
set search_path = ''
as $$
  select case p_frequency
    when 'weekly'   then p_start + (7 * (p_round - 1))
    when 'biweekly' then p_start + (14 * (p_round - 1))
    when 'monthly'  then (p_start + make_interval(months => p_round - 1))::date
  end;
$$;

-- -----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription (Supabase Auth)
-- -----------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text := left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120);
  v_phone text := new.raw_user_meta_data ->> 'phone';
begin
  if v_phone is not null and v_phone !~ '^\+243[89][0-9]{8}$' then
    v_phone := null;
  end if;
  insert into public.profiles (id, full_name, phone)
  values (new.id, v_name, v_phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

