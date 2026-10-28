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

-- -----------------------------------------------------------------------------
-- Journal d'audit automatique
-- -----------------------------------------------------------------------------
-- Usage : execute function private.audit_row('colonne_masquee', ...)
-- Les colonnes passées en argument sont remplacées par « *** » dans le journal.
create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new      jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_old      jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_row      jsonb := coalesce(v_new, v_old);
  v_group_id uuid;
  v_details  jsonb := '{}'::jsonb;
  v_key      text;
  v_masked   text[] := coalesce(tg_argv::text[], '{}');
begin
  if tg_table_name = 'groups' then
    v_group_id := (v_row ->> 'id')::uuid;
  elsif v_row ? 'group_id' then
    v_group_id := (v_row ->> 'group_id')::uuid;
  elsif v_row ? 'cycle_id' then
    v_group_id := private.cycle_group_id((v_row ->> 'cycle_id')::uuid);
  elsif v_row ? 'member_id' then
    v_group_id := private.member_group_id((v_row ->> 'member_id')::uuid);
  end if;

  foreach v_key in array v_masked loop
    if v_new ? v_key and v_new ->> v_key is not null then
      v_new := jsonb_set(v_new, array[v_key], '"***"');
    end if;
    if v_old ? v_key and v_old ->> v_key is not null then
      v_old := jsonb_set(v_old, array[v_key], '"***"');
    end if;
  end loop;

  if tg_op = 'INSERT' then
    v_details := v_new - 'created_at' - 'updated_at';
  elsif tg_op = 'DELETE' then
    v_details := v_old;
  else
    -- Seules les colonnes modifiées sont enregistrées.
    for v_key in select jsonb_object_keys(v_new) loop
      if v_key <> 'updated_at' and (v_new -> v_key) is distinct from (v_old -> v_key) then
        v_details := v_details || jsonb_build_object(
          v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key)
        );
      end if;
    end loop;
    if v_details = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into public.audit_logs (actor_id, group_id, entity_type, entity_id, action, details)
  values (auth.uid(), v_group_id, tg_table_name, (v_row ->> 'id')::uuid, lower(tg_op), v_details);

  return coalesce(new, old);
end;
$$;

create or replace function private.log_event(
  p_group_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (actor_id, group_id, entity_type, entity_id, action, details)
  values (auth.uid(), p_group_id, p_entity_type, p_entity_id, p_action, coalesce(p_details, '{}'::jsonb));
$$;

create trigger audit_profiles after insert or update on public.profiles
  for each row execute function private.audit_row('phone');
create trigger audit_platform_admins after insert or update or delete on public.platform_admins
  for each row execute function private.audit_row();
create trigger audit_platform_settings after insert or update on public.platform_settings
  for each row execute function private.audit_row();
create trigger audit_groups after insert or update on public.groups
  for each row execute function private.audit_row();
create trigger audit_group_members after insert or update on public.group_members
  for each row execute function private.audit_row('phone');
create trigger audit_cycles after insert or update on public.cycles
  for each row execute function private.audit_row();
create trigger audit_cycle_participants after insert or update or delete on public.cycle_participants
  for each row execute function private.audit_row();
create trigger audit_contributions after insert or update on public.contributions
  for each row execute function private.audit_row();
create trigger audit_payout_orders after insert or update on public.payout_orders
  for each row execute function private.audit_row();
create trigger audit_service_fees after insert or update on public.service_fees
  for each row execute function private.audit_row();
create trigger audit_payment_destinations after insert or update or delete on public.payment_destinations
  for each row execute function private.audit_row('mobile_number', 'bank_account_number');

-- -----------------------------------------------------------------------------
-- Règles sur les groupes
-- -----------------------------------------------------------------------------
create or replace function private.groups_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if private.is_client_context() then
      -- Le responsable est toujours l'utilisateur connecté, jamais une valeur du navigateur.
      new.owner_id := auth.uid();
      new.status := 'active';
      new.archived_at := null;
      new.is_demo := false;
    end if;
    new.name := btrim(new.name);
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id then
    raise exception 'Le responsable du groupe ne peut pas être modifié ainsi.';
  end if;
  if new.currency is distinct from old.currency
     and exists (select 1 from public.cycles c where c.group_id = old.id) then
    raise exception 'La devise ne peut plus être modifiée : le groupe a déjà des cycles.';
  end if;
  if old.status = 'archived' and private.is_client_context() then
    raise exception 'Ce groupe est archivé et ne peut plus être modifié.';
  end if;
  if new.max_members < (
    select count(*) from public.group_members m
    where m.group_id = old.id and m.status <> 'removed'
  ) then
    raise exception 'Le nombre maximal de membres est inférieur au nombre de membres actuels.';
  end if;
  new.name := btrim(new.name);
  return new;
end;
$$;

create trigger groups_before_write
  before insert or update on public.groups
  for each row execute function private.groups_before_write();

-- Le responsable devient automatiquement membre « manager » de son groupe.
create or replace function private.groups_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = new.owner_id;
  insert into public.group_members (group_id, profile_id, full_name, phone, role, status, created_by)
  values (
    new.id,
    new.owner_id,
    coalesce(nullif(btrim(v_profile.full_name), ''), 'Responsable'),
    v_profile.phone,
    'manager',
    'active',
    new.owner_id
  );
  return new;
end;
$$;

create trigger groups_after_insert
  after insert on public.groups
  for each row execute function private.groups_after_insert();

-- -----------------------------------------------------------------------------
-- Règles sur les membres
-- -----------------------------------------------------------------------------
create or replace function private.group_members_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_group public.groups;
  v_count integer;
begin
  select * into v_group from public.groups where id = new.group_id;

  if tg_op = 'INSERT' then
    if v_group.status = 'archived' then
      raise exception 'Impossible d''ajouter un membre à un groupe archivé.';
    end if;
    if private.is_client_context() then
      if new.role = 'manager' then
        raise exception 'Le rôle de responsable est réservé au créateur du groupe.';
      end if;
      new.status := 'active';
      new.removed_at := null;
      new.removal_reason := null;
      new.created_by := auth.uid();
    end if;
    select count(*) into v_count from public.group_members m
    where m.group_id = new.group_id and m.status <> 'removed';
    if v_count >= v_group.max_members then
      raise exception 'Le groupe a atteint son nombre maximal de membres (%).', v_group.max_members;
    end if;
    new.full_name := btrim(new.full_name);
    return new;
  end if;

  -- UPDATE
  if new.group_id is distinct from old.group_id then
    raise exception 'Un membre ne peut pas changer de groupe.';
  end if;
  if private.is_client_context() then
    if v_group.status = 'archived' then
      raise exception 'Ce groupe est archivé et ne peut plus être modifié.';
    end if;
    if old.status = 'removed' then
      raise exception 'Ce membre a été retiré ; sa fiche est conservée pour l''historique.';
    end if;
    if new.role is distinct from old.role
       and (new.role = 'manager' or old.role = 'manager') then
      raise exception 'Le rôle de responsable ne peut pas être modifié ainsi.';
    end if;
  end if;
  new.full_name := btrim(new.full_name);
  return new;
end;
$$;

create trigger group_members_before_write
  before insert or update on public.group_members
  for each row execute function private.group_members_before_write();

-- -----------------------------------------------------------------------------
-- Règles sur les cycles
-- -----------------------------------------------------------------------------
create or replace function private.cycles_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_group public.groups;
begin
  if tg_op = 'INSERT' then
    select * into v_group from public.groups where id = new.group_id;
    if v_group.id is null or v_group.status <> 'active' then
      raise exception 'Le groupe est introuvable ou archivé.';
    end if;
    -- Les paramètres financiers viennent toujours du groupe, jamais du navigateur.
    new.currency := v_group.currency;
    new.contribution_amount := v_group.contribution_amount;
    new.frequency := v_group.frequency;
    new.status := 'draft';
    new.planned_end_date := null;
    new.prepared_at := null;
    new.started_at := null;
    new.completed_at := null;
    new.cancelled_at := null;
    new.cancellation_reason := null;
    new.created_by := coalesce(auth.uid(), new.created_by);
    select coalesce(max(c.cycle_number), 0) + 1 into new.cycle_number
    from public.cycles c where c.group_id = new.group_id;
    return new;
  end if;

  if new.group_id is distinct from old.group_id
     or new.currency is distinct from old.currency
     or new.cycle_number is distinct from old.cycle_number then
    raise exception 'Le groupe, la devise et le numéro d''un cycle sont définitifs.';
  end if;
  if private.is_client_context() and old.status <> 'draft' then
    raise exception 'Seul un cycle en brouillon peut être modifié directement.';
  end if;
  if old.status in ('completed', 'cancelled') then
    raise exception 'Un cycle terminé ou annulé ne peut plus être modifié.';
  end if;
  return new;
end;
$$;

create trigger cycles_before_write
  before insert or update on public.cycles
  for each row execute function private.cycles_before_write();

-- -----------------------------------------------------------------------------
-- Règles sur les participants et l'ordre des bénéficiaires
-- -----------------------------------------------------------------------------
create or replace function private.cycle_participants_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_cycle  public.cycles;
  v_member public.group_members;
begin
  select * into v_cycle from public.cycles where id = coalesce(new.cycle_id, old.cycle_id);

  if private.is_client_context() and v_cycle.status <> 'draft' then
    raise exception 'Les participants et l''ordre des bénéficiaires ne sont modifiables que lorsque le cycle est en brouillon.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if tg_op = 'UPDATE'
     and (new.cycle_id is distinct from old.cycle_id or new.member_id is distinct from old.member_id) then
    raise exception 'Seule la position d''un participant peut être modifiée.';
  end if;

  select * into v_member from public.group_members where id = new.member_id;
  if v_member.id is null or v_member.group_id <> v_cycle.group_id then
    raise exception 'Ce membre n''appartient pas au groupe du cycle.';
  end if;
  if tg_op = 'INSERT' and v_member.status <> 'active' then
    raise exception 'Seul un membre actif peut participer à un cycle.';
  end if;
  return new;
end;
$$;

create trigger cycle_participants_before_write
  before insert or update or delete on public.cycle_participants
  for each row execute function private.cycle_participants_before_write();

-- -----------------------------------------------------------------------------
-- Actions métier appelables depuis l'application (RPC)
-- -----------------------------------------------------------------------------

-- Brouillon → en préparation : verrouille les participants et crée les frais dus.
create or replace function public.prepare_cycle(p_cycle_id uuid)
returns public.cycles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles;
  v_count integer;
  v_max   integer;
  v_fee   numeric(14, 2);
begin
  perform private.assert_active_user();
  select * into v_cycle from public.cycles where id = p_cycle_id for update;
  if v_cycle.id is null or not private.is_group_manager(v_cycle.group_id) then
    raise exception 'Cycle introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_cycle.status <> 'draft' then
    raise exception 'Seul un cycle en brouillon peut passer en préparation.';
  end if;

  select count(*), max(payout_position) into v_count, v_max
  from public.cycle_participants where cycle_id = p_cycle_id;
  if v_count < 2 then
    raise exception 'Un cycle doit compter au moins 2 participants.';
  end if;
  if v_max <> v_count then
    raise exception 'L''ordre des bénéficiaires doit aller de 1 à % sans trou.', v_count;
  end if;
  if exists (
    select 1 from public.cycle_participants p
    join public.group_members m on m.id = p.member_id
    where p.cycle_id = p_cycle_id and m.status <> 'active'
  ) then
    raise exception 'Tous les participants doivent être des membres actifs.';
  end if;

  select (value #>> '{}')::numeric into v_fee
  from public.platform_settings where key = 'service_fee_amount_usd';

  insert into public.service_fees (group_id, cycle_id, amount, currency, status)
  values (v_cycle.group_id, v_cycle.id, coalesce(v_fee, 1.00), 'USD', 'due')
  on conflict (cycle_id) do update
    set status = 'due', amount = excluded.amount, due_at = now(), paid_at = null, paid_by = null;

  update public.cycles
  set status = 'preparing',
      prepared_at = now(),
      planned_end_date = private.round_due_date(v_cycle.start_date, v_cycle.frequency, v_count)
  where id = p_cycle_id
  returning * into v_cycle;

  return v_cycle;
end;
$$;

-- En préparation → brouillon : permet de corriger les participants ou l'ordre.
create or replace function public.return_cycle_to_draft(p_cycle_id uuid)
returns public.cycles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles;
begin
  perform private.assert_active_user();
  select * into v_cycle from public.cycles where id = p_cycle_id for update;
  if v_cycle.id is null or not private.is_group_manager(v_cycle.group_id) then
    raise exception 'Cycle introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_cycle.status <> 'preparing' then
    raise exception 'Seul un cycle en préparation peut revenir en brouillon.';
  end if;
  if exists (select 1 from public.service_fees f where f.cycle_id = p_cycle_id and f.status = 'paid') then
    raise exception 'Les frais de ce cycle sont déjà réglés : le cycle ne peut plus revenir en brouillon.';
  end if;

  update public.service_fees set status = 'cancelled' where cycle_id = p_cycle_id and status = 'due';
  update public.cycles
  set status = 'draft', prepared_at = null, planned_end_date = null
  where id = p_cycle_id
  returning * into v_cycle;
  return v_cycle;
end;
$$;

-- Règlement simulé des frais LIKELEMBA d'un cycle.
create or replace function public.pay_service_fee_simulated(p_cycle_id uuid)
returns public.service_fees
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee public.service_fees;
begin
  perform private.assert_active_user();
  select * into v_fee from public.service_fees where cycle_id = p_cycle_id for update;
  if v_fee.id is null or not private.is_group_manager(v_fee.group_id) then
    raise exception 'Frais introuvables ou accès refusé.' using errcode = '42501';
  end if;
  if v_fee.status = 'paid' then
    return v_fee; -- déjà réglés : aucune double opération
  end if;
  if v_fee.status <> 'due' then
    raise exception 'Ces frais ne sont pas à régler (statut : %).', v_fee.status;
  end if;

  update public.service_fees
  set status = 'paid', paid_at = now(), paid_by = auth.uid()
  where id = v_fee.id
  returning * into v_fee;
  return v_fee;
end;
$$;

-- En préparation → actif : génère le calendrier et les versements prévus.
create or replace function public.start_cycle(p_cycle_id uuid)
returns public.cycles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles;
  v_count integer;
  v_part  record;
  v_sched public.contribution_schedules;
begin
  perform private.assert_active_user();
  select * into v_cycle from public.cycles where id = p_cycle_id for update;
  if v_cycle.id is null or not private.is_group_manager(v_cycle.group_id) then
    raise exception 'Cycle introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_cycle.status <> 'preparing' then
    raise exception 'Seul un cycle en préparation peut être démarré.';
  end if;
  if not exists (
    select 1 from public.service_fees f
    where f.cycle_id = p_cycle_id and f.status in ('paid', 'waived')
  ) then
    raise exception 'Les frais LIKELEMBA de ce cycle doivent être réglés avant le démarrage.';
  end if;

  select count(*) into v_count from public.cycle_participants where cycle_id = p_cycle_id;

  for v_part in
    select * from public.cycle_participants where cycle_id = p_cycle_id order by payout_position
  loop
    insert into public.contribution_schedules
      (cycle_id, round_number, due_date, beneficiary_participant_id, amount_per_member, currency)
    values (
      p_cycle_id,
      v_part.payout_position,
      private.round_due_date(v_cycle.start_date, v_cycle.frequency, v_part.payout_position),
      v_part.id,
      v_cycle.contribution_amount,
      v_cycle.currency
    )
    returning * into v_sched;

    -- Le bénéficiaire reçoit la cotisation de chaque participant, y compris la sienne.
    insert into public.payout_orders (cycle_id, schedule_id, participant_id, amount, currency, destination_id)
    values (
      p_cycle_id,
      v_sched.id,
      v_part.id,
      v_cycle.contribution_amount * v_count,
      v_cycle.currency,
      (select d.id from public.payment_destinations d
       where d.member_id = v_part.member_id and d.is_default limit 1)
    );
  end loop;

  update public.cycles
  set status = 'active',
      started_at = now(),
      planned_end_date = private.round_due_date(v_cycle.start_date, v_cycle.frequency, v_count)
  where id = p_cycle_id
  returning * into v_cycle;
  return v_cycle;
end;
$$;

-- Enregistre une cotisation SIMULÉE. Idempotent : rejouer la même clé renvoie
-- la même opération au lieu d'en créer une seconde.
create or replace function public.record_simulated_contribution(
  p_schedule_id uuid,
  p_participant_id uuid,
  p_idempotency_key text,
  p_simulate_failure boolean default false
)
returns public.contributions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.contributions;
  v_sched    public.contribution_schedules;
  v_cycle    public.cycles;
  v_result   public.contributions;
begin
  perform private.assert_active_user();

  select * into v_existing from public.contributions where idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    if v_existing.schedule_id <> p_schedule_id or v_existing.participant_id <> p_participant_id then
      raise exception 'Cette clé d''opération a déjà été utilisée pour une autre cotisation.';
    end if;
    return v_existing;
  end if;

  select * into v_sched from public.contribution_schedules where id = p_schedule_id;
  select * into v_cycle from public.cycles where id = v_sched.cycle_id for update;
  if v_sched.id is null or not private.can_handle_money(v_cycle.group_id) then
    raise exception 'Échéance introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_cycle.status <> 'active' then
    raise exception 'Les cotisations ne peuvent être enregistrées que pour un cycle actif.';
  end if;
  if not exists (
    select 1 from public.cycle_participants p where p.id = p_participant_id and p.cycle_id = v_cycle.id
  ) then
    raise exception 'Ce participant ne fait pas partie de ce cycle.';
  end if;
  if exists (
    select 1 from public.contributions c
    where c.schedule_id = p_schedule_id and c.participant_id = p_participant_id
      and c.status in ('pending', 'confirmed')
  ) then
    raise exception 'Une cotisation est déjà enregistrée pour ce participant et cette échéance.';
  end if;

  insert into public.contributions (
    cycle_id, schedule_id, participant_id, amount, currency, status,
    idempotency_key, receipt_number, failure_reason, recorded_by, paid_at, provider_reference
  )
  values (
    v_cycle.id,
    p_schedule_id,
    p_participant_id,
    v_sched.amount_per_member,
    v_sched.currency,
    case when p_simulate_failure then 'failed' else 'confirmed' end::public.contribution_status,
    p_idempotency_key,
    case when p_simulate_failure then null
         else 'SIM-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    end,
    case when p_simulate_failure then 'Échec simulé (test)' end,
    auth.uid(),
    case when p_simulate_failure then null else now() end,
    'sim_' || replace(gen_random_uuid()::text, '-', '')
  )
  returning * into v_result;
  return v_result;
end;
$$;

-- Versement simulé du tour : uniquement quand toutes les cotisations du tour sont confirmées.
create or replace function public.mark_payout_paid_simulated(p_payout_id uuid)
returns public.payout_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payout   public.payout_orders;
  v_cycle    public.cycles;
  v_expected integer;
  v_received integer;
begin
  perform private.assert_active_user();
  select * into v_payout from public.payout_orders where id = p_payout_id for update;
  select * into v_cycle from public.cycles where id = v_payout.cycle_id;
  if v_payout.id is null or not private.can_handle_money(v_cycle.group_id) then
    raise exception 'Versement introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_payout.status = 'paid' then
    return v_payout; -- déjà versé : aucune double opération
  end if;
  if v_payout.status <> 'pending' or v_cycle.status <> 'active' then
    raise exception 'Ce versement ne peut pas être effectué (statut : %).', v_payout.status;
  end if;

  select count(*) into v_expected from public.cycle_participants where cycle_id = v_cycle.id;
  select count(*) into v_received from public.contributions
  where schedule_id = v_payout.schedule_id and status = 'confirmed';
  if v_received < v_expected then
    raise exception 'Cotisations incomplètes pour ce tour : % reçue(s) sur %.', v_received, v_expected;
  end if;

  update public.payout_orders
  set status = 'paid', paid_at = now(), paid_by = auth.uid()
  where id = p_payout_id
  returning * into v_payout;
  return v_payout;
end;
$$;

-- Actif → terminé : tous les versements doivent avoir été effectués.
create or replace function public.complete_cycle(p_cycle_id uuid)
returns public.cycles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles;
begin
  perform private.assert_active_user();
  select * into v_cycle from public.cycles where id = p_cycle_id for update;
  if v_cycle.id is null or not private.is_group_manager(v_cycle.group_id) then
    raise exception 'Cycle introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_cycle.status <> 'active' then
    raise exception 'Seul un cycle actif peut être terminé.';
  end if;
  if exists (select 1 from public.payout_orders p where p.cycle_id = p_cycle_id and p.status <> 'paid') then
    raise exception 'Tous les bénéficiaires doivent avoir reçu leur tour avant de terminer le cycle.';
  end if;

  update public.cycles set status = 'completed', completed_at = now()
  where id = p_cycle_id returning * into v_cycle;
  return v_cycle;
end;
$$;

-- Annulation d'un cycle (motif obligatoire). L'historique est conservé.
create or replace function public.cancel_cycle(p_cycle_id uuid, p_reason text)
returns public.cycles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles;
begin
  perform private.assert_active_user();
  select * into v_cycle from public.cycles where id = p_cycle_id for update;
  if v_cycle.id is null or not private.is_group_manager(v_cycle.group_id) then
    raise exception 'Cycle introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_cycle.status not in ('draft', 'preparing', 'active') then
    raise exception 'Ce cycle est déjà terminé ou annulé.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Merci d''indiquer le motif de l''annulation (au moins 5 caractères).';
  end if;

  update public.payout_orders set status = 'cancelled' where cycle_id = p_cycle_id and status = 'pending';
  update public.contributions set status = 'cancelled' where cycle_id = p_cycle_id and status = 'pending';
  update public.service_fees set status = 'cancelled' where cycle_id = p_cycle_id and status = 'due';
  update public.cycles
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = btrim(p_reason)
  where id = p_cycle_id returning * into v_cycle;
  return v_cycle;
end;
$$;

-- Retrait d'un membre : sa fiche et son historique financier sont conservés.
create or replace function public.remove_group_member(p_member_id uuid, p_reason text)
returns public.group_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.group_members;
begin
  perform private.assert_active_user();
  select * into v_member from public.group_members where id = p_member_id for update;
  if v_member.id is null or not private.is_group_manager(v_member.group_id) then
    raise exception 'Membre introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_member.role = 'manager' then
    raise exception 'Le responsable du groupe ne peut pas être retiré.';
  end if;
  if v_member.status = 'removed' then
    return v_member;
  end if;
  if exists (
    select 1 from public.cycle_participants p
    join public.cycles c on c.id = p.cycle_id
    where p.member_id = p_member_id and c.status in ('preparing', 'active')
  ) then
    raise exception 'Ce membre participe à un cycle en cours : il ne peut pas être retiré maintenant.';
  end if;

  -- Retire le membre des cycles encore en brouillon.
  delete from public.cycle_participants p
  using public.cycles c
  where c.id = p.cycle_id and p.member_id = p_member_id and c.status = 'draft';

  update public.group_members
  set status = 'removed', removed_at = now(), removal_reason = nullif(btrim(coalesce(p_reason, '')), '')
  where id = p_member_id
  returning * into v_member;
  return v_member;
end;
$$;

-- Archivage d'un groupe (aucun cycle ouvert).
create or replace function public.archive_group(p_group_id uuid)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.groups;
begin
  perform private.assert_active_user();
  select * into v_group from public.groups where id = p_group_id for update;
  if v_group.id is null or v_group.owner_id <> auth.uid() then
    raise exception 'Groupe introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_group.status = 'archived' then
    return v_group;
  end if;
  if exists (
    select 1 from public.cycles c
    where c.group_id = p_group_id and c.status in ('draft', 'preparing', 'active')
  ) then
    raise exception 'Terminez ou annulez le cycle en cours avant d''archiver le groupe.';
  end if;

  update public.groups set status = 'archived', archived_at = now()
  where id = p_group_id returning * into v_group;
  return v_group;
end;
$$;

-- Suspension / réactivation d'un compte par un administrateur (motif obligatoire).
create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status public.account_status,
  p_reason text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  perform private.assert_active_user();
  if not private.is_platform_admin() then
    raise exception 'Action réservée aux administrateurs.' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Un administrateur ne peut pas modifier le statut de son propre compte.';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Merci d''indiquer le motif (au moins 5 caractères).';
  end if;

  update public.profiles
  set account_status = p_status,
      suspended_at = case when p_status = 'suspended' then now() end,
      suspension_reason = case when p_status = 'suspended' then btrim(p_reason) end
  where id = p_user_id
  returning * into v_profile;
  if v_profile.id is null then
    raise exception 'Utilisateur introuvable.';
  end if;

  perform private.log_event(null, 'profiles', p_user_id, 'admin_set_account_status',
    jsonb_build_object('status', p_status, 'reason', btrim(p_reason)));
  return v_profile;
end;
$$;
