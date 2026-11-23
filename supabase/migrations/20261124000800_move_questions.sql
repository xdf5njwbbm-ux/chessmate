-- A random pool of lesson material (sentences, fill-in-the-gap drills and
-- vocabulary) at the learner's level and the level below. The game screens
-- turn it into a different quick question after every move.
create or replace function public.move_questions() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  lvl text;
  lvls text[];
begin
  select ru_level into lvl from public.profiles where id = v_uid;
  lvls := case coalesce(lvl, 'A1')
            when 'A1' then array['A1']
            when 'A2' then array['A1','A2']
            when 'B1' then array['A2','B1']
            else array['B1','B2'] end;
  return jsonb_build_object(
    'levels', to_jsonb(lvls),
    'lines', coalesce((select jsonb_agg(x.j) from (
        select jsonb_build_object('ru', ln ->> 'ru', 'ruF', ln ->> 'ruF', 'en', ln ->> 'en', 'level', l.level, 'lesson', l.title) as j
        from public.lessons l
        cross join lateral jsonb_array_elements(l.content -> 'sections') s
        cross join lateral jsonb_array_elements(s -> 'lines') ln
        where l.level = any(lvls) and s ->> 'type' = 'lines'
          and coalesce(ln ->> 'ru', '') <> '' and coalesce(ln ->> 'en', '') <> ''
          and length(ln ->> 'ru') between 4 and 80
        order by random() limit 120) x), '[]'::jsonb),
    'drills', coalesce((select jsonb_agg(x.j) from (
        select jsonb_build_object('q', d ->> 'q', 'answer', d ->> 'answer', 'options', d -> 'options', 'en', d ->> 'en', 'level', l.level) as j
        from public.lessons l
        cross join lateral jsonb_array_elements(coalesce(l.content -> 'drills', '[]'::jsonb)) d
        where l.level = any(lvls) and jsonb_array_length(coalesce(d -> 'options', '[]'::jsonb)) >= 2
        order by random() limit 60) x), '[]'::jsonb),
    'vocab', coalesce((select jsonb_agg(x.j) from (
        select jsonb_build_object('id', v.id, 'ru', v.ru, 'stressed', v.stressed, 'en', v.en, 'level', v.level) as j
        from public.vocab v
        where v.level = any(lvls)
        order by random() limit 120) x), '[]'::jsonb)
  );
end
$$;

revoke execute on function public.move_questions() from public, anon;
grant execute on function public.move_questions() to authenticated;
