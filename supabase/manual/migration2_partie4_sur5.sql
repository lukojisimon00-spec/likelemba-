-- LIKELEMBA — Migration 2, PARTIE 4 SUR 5 (copie manuelle, à exécuter dans l'ordre 1 → 5)
-- Source : supabase/migrations/20261028000200_business_rules.sql, lignes 536 à 725
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

