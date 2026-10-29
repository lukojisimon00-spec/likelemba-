-- LIKELEMBA — Migration 2, PARTIE 5 SUR 5 (copie manuelle, à exécuter dans l'ordre 1 → 5)
-- Source : supabase/migrations/20261028000200_business_rules.sql, lignes 726 à 1014
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
