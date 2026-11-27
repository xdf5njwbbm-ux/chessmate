-- =====================================================================
-- AI Voice Practice — a real-time spoken Russian tutor.
--
-- voice_profiles  one row per learner: speaking level (A1–C1, separate from
--                 the course level and only raised by evaluated speaking),
--                 call settings and long-term memory (facts, known words,
--                 grammar met, common mistakes, hard words, topics).
-- voice_calls     one row per call: transcript, the tutor's spoken
--                 corrections and the post-call report.
--
-- Clients read their own rows. Every write goes through `voice_home` /
-- `voice_settings` (security definer) or the `voice` edge function with the
-- service role (`voice_finish`).
-- =====================================================================

create table if not exists public.voice_profiles (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  level          text not null default 'A1' check (level in ('A1','A2','B1','B2','C1')),
  level_progress int not null default 0 check (level_progress between 0 and 100),
  mode           text not null default 'beginner' check (mode in ('beginner','natural','immersion')),
  tutor          text not null default 'anya' check (tutor in ('anya','misha')),
  show_english   boolean not null default true,
  show_translit  boolean not null default true,
  slow           boolean not null default false,
  current_lesson int not null default 1 check (current_lesson between 1 and 20),
  memory         jsonb not null default '{}',
  lessons        jsonb not null default '{}',
  history        jsonb not null default '[]',
  calls          int not null default 0,
  seconds        int not null default 0,
  sentences      int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.voice_calls (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'active' check (status in ('active','ended')),
  mode         text not null check (mode in ('beginner','natural','immersion')),
  level        text not null check (level in ('A1','A2','B1','B2','C1')),
  lesson       int check (lesson between 1 and 20),
  review_of    uuid references public.voice_calls(id) on delete set null,
  tutor        text not null default 'anya',
  rtc_call_id  text,
  connections  int not null default 1,
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at     timestamptz,
  duration_s   int not null default 0 check (duration_s >= 0),
  sentences    int not null default 0,
  transcript   jsonb not null default '[]',
  feedback     jsonb not null default '[]',
  report       jsonb,
  created_at   timestamptz not null default now()
);
create index if not exists voice_calls_user_idx on public.voice_calls (user_id, started_at desc);
create index if not exists voice_calls_review_idx on public.voice_calls (review_of);

alter table public.voice_profiles enable row level security;
alter table public.voice_calls enable row level security;
revoke all on public.voice_profiles, public.voice_calls from anon, authenticated;
grant select on public.voice_profiles, public.voice_calls to authenticated;

drop policy if exists "own voice profile: read" on public.voice_profiles;
create policy "own voice profile: read" on public.voice_profiles for select to authenticated
  using (user_id = (select public.app_uid()));
drop policy if exists "own voice calls: read" on public.voice_calls;
create policy "own voice calls: read" on public.voice_calls for select to authenticated
  using (user_id = (select public.app_uid()));

insert into public.app_config (key, value) values ('voice_daily_minutes', '60'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- Lobby: creates the voice profile on first visit and returns everything
-- the AI Voice Practice screen needs.
-- ---------------------------------------------------------------------
create or replace function public.voice_home() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  p public.profiles := public.require_profile(v_uid);
  vp public.voice_profiles;
  today_s int;
begin
  insert into public.voice_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into vp from public.voice_profiles where user_id = v_uid;
  select coalesce(sum(case when c.status = 'ended' then c.duration_s
                           else greatest(0, extract(epoch from (c.last_seen_at - c.started_at))::int) end), 0)
    into today_s
    from public.voice_calls c
   where c.user_id = v_uid and c.started_at > now() - interval '24 hours';
  return jsonb_build_object(
    'profile', to_jsonb(vp) - 'user_id',
    'course', jsonb_build_object('level', p.ru_level, 'forms', p.ru_forms, 'name', p.display_name),
    'usage', jsonb_build_object('seconds_24h', today_s, 'limit_s', public.config_int('voice_daily_minutes', 60) * 60),
    'calls', coalesce((
      select jsonb_agg(x order by x.started_at desc) from (
        select c.id, c.status, c.mode, c.level, c.lesson, c.review_of, c.started_at, c.duration_s, c.sentences,
               c.report is not null as has_report,
               c.report -> 'scores' as scores,
               c.report ->> 'summary' as summary,
               jsonb_array_length(c.transcript) as turns
          from public.voice_calls c
         where c.user_id = v_uid
         order by c.started_at desc
         limit 15
      ) x), '[]'::jsonb)
  );
end
$$;

-- ---------------------------------------------------------------------
-- Call settings the learner can change.
-- ---------------------------------------------------------------------
create or replace function public.voice_settings(p jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  vp public.voice_profiles;
begin
  perform public.require_profile(v_uid);
  insert into public.voice_profiles (user_id) values (v_uid) on conflict (user_id) do nothing;
  if p ? 'mode' and (p ->> 'mode') not in ('beginner','natural','immersion') then
    raise exception 'Unknown mode.' using errcode = '22023';
  end if;
  if p ? 'tutor' and (p ->> 'tutor') not in ('anya','misha') then
    raise exception 'Unknown tutor.' using errcode = '22023';
  end if;
  if p ? 'current_lesson' and ((p ->> 'current_lesson')::int not between 1 and 20) then
    raise exception 'Unknown lesson.' using errcode = '22023';
  end if;
  update public.voice_profiles set
    mode           = coalesce(p ->> 'mode', mode),
    tutor          = coalesce(p ->> 'tutor', tutor),
    show_english   = coalesce((p ->> 'show_english')::boolean, show_english),
    show_translit  = coalesce((p ->> 'show_translit')::boolean, show_translit),
    slow           = coalesce((p ->> 'slow')::boolean, slow),
    current_lesson = coalesce((p ->> 'current_lesson')::int, current_lesson),
    updated_at     = now()
  where user_id = v_uid
  returning * into vp;
  return to_jsonb(vp) - 'user_id';
end
$$;

-- ---------------------------------------------------------------------
-- Service: saves a finished call and its effects in one transaction.
-- Applied once per call (a second call only refreshes the report).
--   p.duration_s, p.sentences, p.transcript, p.feedback, p.report
--   p.profile  {level, level_progress, current_lesson, memory, lessons, history}
--   p.activity number of spoken sentences to count toward today's goals (≤ 20)
--   p.phrases  [{ru, en}] corrected sentences to add to Review (≤ 8)
--   p.words    [ru] words met in the call, matched against the course vocabulary (≤ 30)
-- ---------------------------------------------------------------------
create or replace function public.voice_finish(u uuid, p_call uuid, p jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.voice_calls;
  n int;
  i int;
  lim int;
  ph jsonb;
  v_id bigint;
begin
  select * into c from public.voice_calls where id = p_call and user_id = u for update;
  if not found then
    raise exception 'Call not found.' using errcode = '22023';
  end if;

  if c.status = 'ended' then
    update public.voice_calls set report = coalesce(p -> 'report', report) where id = p_call;
    return jsonb_build_object('first', false);
  end if;

  update public.voice_calls set
    status     = 'ended',
    ended_at   = now(),
    duration_s = greatest(0, least(14400, coalesce((p ->> 'duration_s')::int, 0))),
    sentences  = greatest(0, coalesce((p ->> 'sentences')::int, 0)),
    transcript = coalesce(p -> 'transcript', transcript),
    feedback   = coalesce(p -> 'feedback', feedback),
    report     = p -> 'report'
  where id = p_call;

  update public.voice_profiles vp set
    level          = coalesce(p #>> '{profile,level}', vp.level),
    level_progress = greatest(0, least(100, coalesce((p #>> '{profile,level_progress}')::int, vp.level_progress))),
    current_lesson = greatest(1, least(20, coalesce((p #>> '{profile,current_lesson}')::int, vp.current_lesson))),
    memory         = coalesce(p #> '{profile,memory}', vp.memory),
    lessons        = coalesce(p #> '{profile,lessons}', vp.lessons),
    history        = coalesce(p #> '{profile,history}', vp.history),
    calls          = vp.calls + 1,
    seconds        = vp.seconds + greatest(0, least(14400, coalesce((p ->> 'duration_s')::int, 0))),
    sentences      = vp.sentences + greatest(0, coalesce((p ->> 'sentences')::int, 0)),
    updated_at     = now()
  where vp.user_id = u;

  -- spoken sentences count toward today's objectives and the streak
  n := greatest(0, least(20, coalesce((p ->> 'activity')::int, 0)));
  for i in 1..n loop
    perform public.log_activity(u, 'tutor', true, 'voice:' || p_call::text);
  end loop;

  -- corrected sentences go into Review (within the plan's saved-phrase limit)
  lim := (public.entitlements(u) ->> 'saved_phrases')::int;
  for ph in select * from jsonb_array_elements(coalesce(p -> 'phrases', '[]'::jsonb)) limit 8 loop
    continue when coalesce(btrim(ph ->> 'ru'), '') = '' or char_length(ph ->> 'ru') > 300;
    if lim is not null and not exists (select 1 from public.saved_phrases where user_id = u and ru = btrim(ph ->> 'ru'))
       and (select count(*) from public.saved_phrases where user_id = u) >= lim then
      exit;
    end if;
    insert into public.saved_phrases (user_id, ru, en, source)
    values (u, btrim(ph ->> 'ru'), left(btrim(coalesce(ph ->> 'en', '')), 300), 'tutor')
    on conflict (user_id, ru) do update set en = coalesce(nullif(excluded.en, ''), public.saved_phrases.en)
    returning id into v_id;
    insert into public.srs_items (user_id, kind, item_id) values (u, 'phrase', v_id::text) on conflict do nothing;
  end loop;

  -- words from the call that are in the course vocabulary join spaced review
  insert into public.srs_items (user_id, kind, item_id)
  select distinct u, 'word', v.id
    from public.vocab v
   where lower(v.ru) in (select lower(replace(x, chr(769), '')) from jsonb_array_elements_text(coalesce(p -> 'words', '[]'::jsonb)) x limit 30)
     and public.level_allowed(u, v.level)
  on conflict do nothing;

  perform public.check_achievements(u);
  return jsonb_build_object('first', true);
end
$$;

revoke execute on function public.voice_finish(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.voice_finish(uuid, uuid, jsonb) to service_role;
revoke execute on function public.voice_home(), public.voice_settings(jsonb) from public, anon;
grant execute on function public.voice_home(), public.voice_settings(jsonb) to authenticated;
