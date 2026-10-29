-- =============================================================================
-- LIKELEMBA — Vérification de l'installation (LECTURE SEULE)
-- -----------------------------------------------------------------------------
-- À coller dans Supabase > SQL Editor APRÈS les 3 migrations, puis « Run ».
-- Ce script ne modifie rien : il ne fait que lire la configuration.
-- Résultat attendu : toutes les lignes avec ok = ✅
-- =============================================================================

with tables_attendues(nom) as (
  values ('profiles'), ('platform_admins'), ('platform_settings'), ('groups'),
         ('group_members'), ('cycles'), ('cycle_participants'), ('contribution_schedules'),
         ('contributions'), ('payout_orders'), ('service_fees'), ('payment_destinations'),
         ('audit_logs')
),
etat as (
  select t.nom,
         c.oid is not null as existe,
         coalesce(c.relrowsecurity, false) as rls,
         (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = t.nom) as politiques,
         c.oid is not null and has_table_privilege('anon', c.oid, 'SELECT') as anon_lit
  from tables_attendues t
  left join pg_class c on c.relname = t.nom
    and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
)
select 'Table ' || nom as verification,
       case when not existe then 'absente'
            else 'RLS ' || case when rls then 'activé' else 'DÉSACTIVÉ' end
                 || ', ' || politiques || ' politique(s)'
                 || case when anon_lit then ', LISIBLE PAR ANON' else '' end
       end as resultat,
       case when existe and rls and politiques > 0 and not anon_lit then '✅' else '❌' end as ok
from etat

union all
select 'Création automatique du profil à l''inscription',
       case when count(*) > 0 then 'déclencheur présent' else 'déclencheur absent' end,
       case when count(*) > 0 then '✅' else '❌' end
from pg_trigger
where tgname = 'on_auth_user_created' and tgrelid = 'auth.users'::regclass

union all
select 'Paiements en mode simulation',
       coalesce((select value #>> '{}' from public.platform_settings where key = 'payments_mode'), 'paramètre absent'),
       case when (select value #>> '{}' from public.platform_settings where key = 'payments_mode') = 'simulation'
            then '✅' else '❌' end

union all
select 'Frais LIKELEMBA par cycle (USD)',
       coalesce((select value #>> '{}' from public.platform_settings where key = 'service_fee_amount_usd'), 'paramètre absent'),
       case when (select (value #>> '{}')::numeric from public.platform_settings where key = 'service_fee_amount_usd') = 1
            then '✅' else '❌' end

union all
select 'Verrou « simulation uniquement » sur les cotisations',
       case when count(*) > 0 then 'contrainte présente' else 'contrainte absente' end,
       case when count(*) > 0 then '✅' else '❌' end
from pg_constraint
where conname = 'contributions_simulation_only'

union all
select 'Fonctions métier non exécutables par un visiteur (anon)',
       case when bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))
            then 'au moins une fonction est ouverte à anon' else 'aucune' end,
       case when bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')) then '❌' else '✅' end
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  -- on ignore les fonctions installées par des extensions
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')

union all
select 'Schéma « private » non exposé par l''API',
       case when current_setting('pgrst.db_schemas', true) like '%private%'
            then 'EXPOSÉ' else 'non exposé' end,
       case when coalesce(current_setting('pgrst.db_schemas', true), '') like '%private%' then '❌' else '✅' end;
