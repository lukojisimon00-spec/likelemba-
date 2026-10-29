-- LIKELEMBA — Migration 2, PARTIE 3 SUR 5 (copie manuelle, à exécuter dans l'ordre 1 → 5)
-- Source : supabase/migrations/20261028000200_business_rules.sql, lignes 381 à 535
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

