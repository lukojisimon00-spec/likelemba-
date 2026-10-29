-- LIKELEMBA — Installation complète en une commande (projet Supabase NEUF uniquement)
-- À coller dans Supabase > SQL Editor, puis « Run ».
-- Télécharge les 3 migrations depuis GitHub (commit figé), vérifie leur empreinte md5,
-- puis les exécute. Refuse de s'exécuter si le projet n'est pas vide.
-- Si une migration change, mettre à jour le commit et les empreintes (md5sum).

create extension if not exists http with schema extensions;

do $$
declare
  base text := 'https://raw.githubusercontent.com/lukojisimon00-spec/likelemba-/d6cc9c4ffd3cf6ec77b831ec62a75753add7cb9c/supabase/migrations/';
  fichiers text[] := array['20261028000100_core_schema.sql','20261028000200_business_rules.sql','20261028000300_rls_policies.sql'];
  empreintes text[] := array['f34930c8545a9c490aa4e847ef95c105','897501fbdd9b69c48a6424f790a0c480','ed3c12fb5f747a1ab1b9a9d4e23990dc'];
  contenus text[] := '{}';
  r extensions.http_response;
begin
  if to_regnamespace('private') is not null or to_regtype('public.currency_code') is not null then
    raise exception 'Ce projet n''est pas vide : utilisez un projet neuf. Rien n''a été exécuté.';
  end if;
  for i in 1..3 loop
    select * into r from extensions.http_get(base || fichiers[i]);
    if r.status <> 200 then
      raise exception 'Téléchargement impossible de % (code %)', fichiers[i], r.status;
    end if;
    if md5(r.content) <> empreintes[i] then
      raise exception 'Fichier % incomplet ou différent : rien n''a été exécuté', fichiers[i];
    end if;
    contenus := contenus || r.content;
  end loop;
  for i in 1..3 loop
    execute contenus[i];
  end loop;
end $$;
