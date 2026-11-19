-- =============================================================================
-- LIKELEMBA — Migration 4 : part du « maman likelemba » et frais par tour
-- -----------------------------------------------------------------------------
-- Décision du propriétaire (19 novembre 2026) :
--   * À chaque tour, la cagnotte = cotisation × nombre de participants.
--   * Le responsable du groupe (« maman likelemba ») garde une part fixe par
--     tour, fixée par lui dans la devise du groupe (ex. 10 USD).
--   * Le bénéficiaire du tour reçoit : cagnotte − part du maman likelemba.
--     Exemple : 10 membres × 10 USD = 100 USD → maman likelemba 10 USD,
--     bénéficiaire 90 USD.
--   * LIKELEMBA prend 1 USD par tour, sur la part du maman likelemba,
--     uniquement quand un versement est effectué. Rien n'est prélevé sur la
--     part du bénéficiaire.
--   * Les frais restent en USD (aucune conversion automatique, même pour un
--     groupe en CDF) et restent simulés.
--   * Le nombre maximal de membres passe de 100 à 500.
--
-- Remplace l'ancien modèle « 1 USD par groupe et par cycle, réglé avant le
-- démarrage ». Les éventuelles lignes de frais de l'ancien modèle sont
-- conservées telles quelles (historique) : leur payout_id est vide.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Paramètre de la plateforme
-- -----------------------------------------------------------------------------
update public.platform_settings
set description = 'Frais LIKELEMBA par tour (à chaque versement), en USD, pris sur la part du maman likelemba. Jamais converti automatiquement en CDF.'
where key = 'service_fee_amount_usd';

-- -----------------------------------------------------------------------------
-- 2. Groupes : part du maman likelemba, limite de membres
-- -----------------------------------------------------------------------------
alter table public.groups
  add column organizer_commission numeric(14, 2) not null default 0
    check (organizer_commission >= 0);

comment on column public.groups.organizer_commission is
  'Part gardée par le responsable (maman likelemba) à chaque tour, dans la devise du groupe. Les frais LIKELEMBA (1 USD par tour) sont pris sur cette part.';

alter table public.groups drop constraint groups_max_members_check;
alter table public.groups
  add constraint groups_max_members_check check (max_members between 2 and 500);

grant insert (organizer_commission) on public.groups to authenticated;
grant update (organizer_commission) on public.groups to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Cycles : la part est copiée du groupe et figée pour tout le cycle
-- -----------------------------------------------------------------------------
alter table public.cycles
  add column organizer_commission numeric(14, 2) not null default 0
    check (organizer_commission >= 0);

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
    new.organizer_commission := v_group.organizer_commission;
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
  -- Montants figés une fois le cycle préparé (aucun droit client sur ces colonnes de toute façon).
  if old.status <> 'draft'
     and (new.contribution_amount is distinct from old.contribution_amount
          or new.organizer_commission is distinct from old.organizer_commission) then
    raise exception 'Les montants d''un cycle sont figés après sa préparation.';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Versements : détail cagnotte / part du maman likelemba / montant versé
-- -----------------------------------------------------------------------------
alter table public.payout_orders
  add column gross_amount numeric(14, 2) check (gross_amount > 0),
  add column organizer_commission numeric(14, 2) check (organizer_commission >= 0),
  add constraint payout_orders_breakdown_consistency check (
    (gross_amount is null and organizer_commission is null)
    or (gross_amount is not null and organizer_commission is not null
        and amount = gross_amount - organizer_commission)
  );

comment on column public.payout_orders.amount is
  'Montant reçu par le bénéficiaire = gross_amount − organizer_commission.';
comment on column public.payout_orders.gross_amount is
  'Cagnotte du tour = cotisation × nombre de participants. Vide pour les versements de l''ancien modèle.';

-- -----------------------------------------------------------------------------
-- 5. Frais LIKELEMBA : un par versement effectué
-- -----------------------------------------------------------------------------
alter table public.service_fees drop constraint service_fees_cycle_id_key;
alter table public.service_fees
  add column payout_id uuid unique references public.payout_orders (id) on delete restrict;

create index service_fees_cycle_id_idx on public.service_fees (cycle_id);

comment on table public.service_fees is
  'Frais LIKELEMBA : 1 USD par tour versé, pris sur la part du maman likelemba. Lignes sans payout_id = ancien modèle (par cycle), conservées pour l''historique.';

-- -----------------------------------------------------------------------------
-- 6. Préparation : vérifie la part du maman likelemba, ne crée plus de frais
-- -----------------------------------------------------------------------------
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

  -- Part du maman likelemba : obligatoire, inférieure à la cagnotte et, en USD,
  -- au moins égale aux frais LIKELEMBA qui sont pris dessus.
  select coalesce((value #>> '{}')::numeric, 1.00) into v_fee
  from public.platform_settings where key = 'service_fee_amount_usd';
  v_fee := coalesce(v_fee, 1.00);

  if v_cycle.organizer_commission <= 0 then
    raise exception 'Indiquez la part du maman likelemba par tour avant de préparer le cycle.';
  end if;
  if v_cycle.organizer_commission >= v_cycle.contribution_amount * v_count then
    raise exception 'La part du maman likelemba (%) doit être inférieure à la cagnotte du tour (%).',
      v_cycle.organizer_commission, v_cycle.contribution_amount * v_count;
  end if;
  if v_cycle.currency = 'USD' and v_cycle.organizer_commission < v_fee then
    raise exception 'La part du maman likelemba doit être d''au moins % USD : les frais LIKELEMBA sont pris dessus.', v_fee;
  end if;

  update public.cycles
  set status = 'preparing',
      prepared_at = now(),
      planned_end_date = private.round_due_date(v_cycle.start_date, v_cycle.frequency, v_count)
  where id = p_cycle_id
  returning * into v_cycle;

  return v_cycle;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Retour en brouillon : plus de frais à vérifier
-- -----------------------------------------------------------------------------
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

  -- Ancien modèle : des frais « par cycle » encore dus sont annulés.
  update public.service_fees set status = 'cancelled'
  where cycle_id = p_cycle_id and payout_id is null and status = 'due';

  update public.cycles
  set status = 'draft', prepared_at = null, planned_end_date = null
  where id = p_cycle_id
  returning * into v_cycle;
  return v_cycle;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Démarrage : plus de frais préalables ; versement = cagnotte − part
-- -----------------------------------------------------------------------------
create or replace function public.start_cycle(p_cycle_id uuid)
returns public.cycles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles;
  v_count integer;
  v_gross numeric(14, 2);
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

  select count(*) into v_count from public.cycle_participants where cycle_id = p_cycle_id;
  v_gross := v_cycle.contribution_amount * v_count;
  if v_cycle.organizer_commission <= 0 or v_cycle.organizer_commission >= v_gross then
    raise exception 'La part du maman likelemba de ce cycle est invalide.';
  end if;

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

    -- Le bénéficiaire reçoit la cagnotte moins la part du maman likelemba.
    insert into public.payout_orders
      (cycle_id, schedule_id, participant_id, gross_amount, organizer_commission, amount, currency, destination_id)
    values (
      p_cycle_id,
      v_sched.id,
      v_part.id,
      v_gross,
      v_cycle.organizer_commission,
      v_gross - v_cycle.organizer_commission,
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

-- -----------------------------------------------------------------------------
-- 9. Versement : crée les frais LIKELEMBA du tour (1 USD, à régler)
-- -----------------------------------------------------------------------------
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
  v_fee      numeric(14, 2);
begin
  perform private.assert_active_user();
  select * into v_payout from public.payout_orders where id = p_payout_id for update;
  select * into v_cycle from public.cycles where id = v_payout.cycle_id;
  if v_payout.id is null or not private.can_handle_money(v_cycle.group_id) then
    raise exception 'Versement introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_payout.status = 'paid' then
    return v_payout; -- déjà versé : aucune double opération, aucuns frais en double
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

  -- Frais LIKELEMBA du tour, pris sur la part du maman likelemba (jamais sur le versement).
  if v_payout.gross_amount is not null then
    select (value #>> '{}')::numeric into v_fee
    from public.platform_settings where key = 'service_fee_amount_usd';
    insert into public.service_fees (group_id, cycle_id, payout_id, amount, currency, status)
    values (v_cycle.group_id, v_cycle.id, v_payout.id, coalesce(v_fee, 1.00), 'USD', 'due')
    on conflict (payout_id) do nothing;
  end if;

  return v_payout;
end;
$$;

-- -----------------------------------------------------------------------------
-- 10. Règlement simulé des frais : désormais par ligne de frais
-- -----------------------------------------------------------------------------
drop function public.pay_service_fee_simulated(uuid);

create function public.pay_service_fee_simulated(p_fee_id uuid)
returns public.service_fees
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fee public.service_fees;
begin
  perform private.assert_active_user();
  select * into v_fee from public.service_fees where id = p_fee_id for update;
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

revoke all on function public.pay_service_fee_simulated(uuid) from public, anon;
grant execute on function public.pay_service_fee_simulated(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 11. Annulation : les frais des tours déjà versés restent dus
-- -----------------------------------------------------------------------------
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
  -- Seuls les frais de l'ancien modèle (sans versement) sont annulés.
  update public.service_fees set status = 'cancelled'
  where cycle_id = p_cycle_id and payout_id is null and status = 'due';
  update public.cycles
  set status = 'cancelled', cancelled_at = now(), cancellation_reason = btrim(p_reason)
  where id = p_cycle_id returning * into v_cycle;
  return v_cycle;
end;
$$;
