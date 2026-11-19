-- =============================================================================
-- LIKELEMBA — Migration 6 : ordre des tours en une opération + bilan par membre
-- -----------------------------------------------------------------------------
-- 1. set_cycle_order : remplace les participants d'un cycle en brouillon par
--    une liste ordonnée de membres (tour 1 = premier de la liste). Atomique :
--    l'interface n'a jamais d'ordre à moitié enregistré.
-- 2. cycle_member_summary : pour chaque participant d'un cycle, combien de
--    cotisations sont dues à ce jour, payées, en retard, et s'il a déjà reçu
--    la cagnotte. Fonction SECURITY INVOKER : les règles RLS s'appliquent,
--    un utilisateur ne voit que les cycles de ses groupes.
-- =============================================================================

create or replace function public.set_cycle_order(p_cycle_id uuid, p_member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles;
  v_count integer := coalesce(array_length(p_member_ids, 1), 0);
begin
  perform private.assert_active_user();
  select * into v_cycle from public.cycles where id = p_cycle_id for update;
  if v_cycle.id is null or not private.is_group_manager(v_cycle.group_id) then
    raise exception 'Cycle introuvable ou accès refusé.' using errcode = '42501';
  end if;
  if v_cycle.status <> 'draft' then
    raise exception 'L''ordre des tours ne se modifie que lorsque le cycle est en brouillon.';
  end if;
  if v_count < 2 then
    raise exception 'Un cycle doit compter au moins 2 participants.';
  end if;
  if (select count(distinct m) from unnest(p_member_ids) m) <> v_count then
    raise exception 'Un membre ne peut apparaître qu''une fois dans l''ordre des tours.';
  end if;
  if (
    select count(*) from public.group_members gm
    where gm.id = any (p_member_ids) and gm.group_id = v_cycle.group_id and gm.status = 'active'
  ) <> v_count then
    raise exception 'Tous les participants doivent être des membres actifs de ce groupe.';
  end if;

  delete from public.cycle_participants where cycle_id = p_cycle_id;
  insert into public.cycle_participants (cycle_id, member_id, payout_position)
  select p_cycle_id, m.member_id, m.position::integer
  from unnest(p_member_ids) with ordinality as m(member_id, position);
end;
$$;

create or replace function public.cycle_member_summary(p_cycle_id uuid, p_today date)
returns table (
  participant_id  uuid,
  member_id       uuid,
  full_name       text,
  phone           text,
  payout_position integer,
  due_count       integer,
  paid_count      integer,
  late_count      integer,
  payout_status   public.payout_status,
  payout_paid_at  timestamptz,
  payout_due_date date
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    m.id,
    m.full_name,
    m.phone::text,
    p.payout_position,
    (select count(*)::integer from public.contribution_schedules s
      where s.cycle_id = p.cycle_id and s.due_date <= p_today),
    (select count(*)::integer from public.contributions c
      where c.participant_id = p.id and c.status = 'confirmed'),
    (select count(*)::integer from public.contribution_schedules s
      where s.cycle_id = p.cycle_id and s.due_date < p_today
        and not exists (
          select 1 from public.contributions c
          where c.schedule_id = s.id and c.participant_id = p.id and c.status = 'confirmed'
        )),
    po.status,
    po.paid_at,
    s2.due_date
  from public.cycle_participants p
  join public.group_members m on m.id = p.member_id
  left join public.payout_orders po on po.participant_id = p.id
  left join public.contribution_schedules s2 on s2.id = po.schedule_id
  where p.cycle_id = p_cycle_id
  order by p.payout_position;
$$;

revoke all on function public.set_cycle_order(uuid, uuid[]) from public, anon;
revoke all on function public.cycle_member_summary(uuid, date) from public, anon;
grant execute on function public.set_cycle_order(uuid, uuid[]) to authenticated;
grant execute on function public.cycle_member_summary(uuid, date) to authenticated;
