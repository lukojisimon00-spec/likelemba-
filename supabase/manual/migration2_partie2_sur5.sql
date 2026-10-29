-- LIKELEMBA — Migration 2, PARTIE 2 SUR 5 (copie manuelle, à exécuter dans l'ordre 1 → 5)
-- Source : supabase/migrations/20261028000200_business_rules.sql, lignes 203 à 380
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

