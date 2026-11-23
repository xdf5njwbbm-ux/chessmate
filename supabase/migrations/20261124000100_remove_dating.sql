-- =====================================================================
-- Russian Chess Academy — remove the former dating product.
-- Safe on a fresh project (everything is "if exists") and on a project
-- that still has the old Chessmate dating schema. Login accounts in
-- auth.users are kept; everything else in public is rebuilt.
-- =====================================================================

-- Old storage policies for dating photos. The bucket itself must be
-- emptied and deleted from the Storage dashboard (Supabase does not allow
-- deleting storage objects with SQL).
drop policy if exists "photos: members can view" on storage.objects;
drop policy if exists "photos: upload to own folder" on storage.objects;
drop policy if exists "photos: update own" on storage.objects;
drop policy if exists "photos: delete own" on storage.objects;

-- Tables of the old product (dating profiles, questionnaire, likes, matches,
-- and the old chess tables, which are recreated with the new design).
drop table if exists public.likes cascade;
drop table if exists public.matches cascade;
drop table if exists public.answers cascade;
drop table if exists public.questions cascade;
drop table if exists public.reports cascade;
drop table if exists public.blocks cascade;
drop table if exists public.challenges cascade;
drop table if exists public.games cascade;
drop table if exists public.profiles cascade;

-- Every function the old product defined in public (extension-owned
-- functions are left alone).
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end $$;
