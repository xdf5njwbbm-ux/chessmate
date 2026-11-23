-- =====================================================================
-- Russian Chess Academy — server functions
-- Every client-callable function re-checks the caller with require_uid().
-- Functions marked "internal" are not executable through the API; the
-- ones marked "service" are called only by edge functions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------
create or replace function public.config_int(k text, fallback int) returns int
language sql stable
set search_path = ''
as $$ select coalesce((select (value #>> '{}')::int from public.app_config where key = k), fallback) $$;

create or replace function public.placement_games() returns int
language sql stable
set search_path = ''
as $$ select public.config_int('placement_games', 5) $$;

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- Plan features for a user. While the paywall is off, everyone is on
-- Premium ("early access").
create or replace function public.entitlements(u uuid) returns jsonb
language plpgsql stable
set search_path = ''
as $$
declare
  paywall boolean := coalesce((select (value #>> '{}')::boolean from public.app_config where key = 'paywall_enabled'), false);
  v_plan text := 'free';
begin
  if not paywall then
    v_plan := 'premium';
  else
    select s.plan_id into v_plan from public.subscriptions s
    where s.user_id = u and s.status in ('active','trialing')
      and (s.current_period_end is null or s.current_period_end > now());
    v_plan := coalesce(v_plan, 'free');
  end if;
  return coalesce((select p.features from public.plans p where p.id = v_plan), '{}'::jsonb)
         || jsonb_build_object('plan', v_plan, 'early_access', not paywall);
end
$$;

create or replace function public.level_allowed(u uuid, lvl text) returns boolean
language sql stable
set search_path = ''
as $$ select coalesce(public.entitlements(u) -> 'levels' ? lvl, false) $$;

create or replace function public.require_profile(u uuid) returns public.profiles
language plpgsql stable
set search_path = ''
as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = u;
  if not found then
    raise exception 'Finish setting up your account first.' using errcode = '22023';
  end if;
  return p;
end
$$;

create or replace function public.touch_streak(u uuid) returns void
language plpgsql
set search_path = ''
as $$
declare d date := public.local_day(u);
begin
  update public.profiles p set
    streak_current = case when p.last_active_day = d - 1 then p.streak_current + 1 else 1 end,
    streak_best = greatest(p.streak_best, case when p.last_active_day = d - 1 then p.streak_current + 1 else 1 end),
    last_active_day = d
  where p.id = u and (p.last_active_day is null or p.last_active_day <> d);
end
$$;

create or replace function public.log_activity(u uuid, k text, ok boolean, r text) returns void
language plpgsql
set search_path = ''
as $$
begin
  if k = 'game' then
    insert into public.activity (user_id, day, kind, correct, ref)
    values (u, public.local_day(u), k, ok, r)
    on conflict (user_id, ref) where kind = 'game' do nothing;
  else
    insert into public.activity (user_id, day, kind, correct, ref) values (u, public.local_day(u), k, ok, r);
    perform public.touch_streak(u);
  end if;
end
$$;

create or replace function public.rating_status(games int) returns text
language sql stable
set search_path = ''
as $$
  select case when games >= 20 then 'established'
              when games >= public.placement_games() then 'provisional'
              else 'unrated' end
$$;

-- Awards every achievement the user now qualifies for; returns new ones.
create or replace function public.check_achievements(u uuid) returns text[]
language plpgsql
set search_path = ''
as $$
declare
  n_place int := public.placement_games();
  lessons int; words int; reviews int; speech int; streak int; games int; wins int; rated_wins int;
  placed boolean; best int; tutor int; passed text[];
  earned text[] := '{}';
  out text[];
begin
  select count(*) into lessons from public.lesson_progress where user_id = u and completed_at is not null;
  select count(*) into words from public.srs_items where user_id = u and kind = 'word';
  select count(*) into reviews from public.activity where user_id = u and kind = 'review';
  select count(*) into speech from public.speech_attempts where user_id = u;
  select coalesce(streak_best, 0) into streak from public.profiles where id = u;
  select count(*) into games from public.activity where user_id = u and kind = 'game';
  select count(*) filter (where (g.result = '1-0' and g.white_id = u) or (g.result = '0-1' and g.black_id = u)),
         count(*) filter (where g.rated and ((g.result = '1-0' and g.white_id = u) or (g.result = '0-1' and g.black_id = u)))
    into wins, rated_wins
    from public.games g where g.status = 'finished' and u in (g.white_id, g.black_id);
  select exists (select 1 from public.ratings r where r.user_id = u and r.games >= n_place) into placed;
  select max(coalesce(r.peak, r.rating)) into best from public.ratings r where r.user_id = u and r.games >= n_place;
  select count(*) into tutor from public.activity where user_id = u and kind = 'tutor';
  select coalesce(array_agg(distinct t.level), '{}') into passed
    from public.test_attempts a join public.tests t on t.id = a.test_id
    where a.user_id = u and a.passed and t.level is not null;

  if lessons >= 1 then earned := array_append(earned, 'first_lesson'); end if;
  if lessons >= 10 then earned := array_append(earned, 'lessons_10'); end if;
  if lessons >= 30 then earned := array_append(earned, 'lessons_30'); end if;
  if words >= 50 then earned := array_append(earned, 'words_50'); end if;
  if words >= 250 then earned := array_append(earned, 'words_250'); end if;
  if words >= 500 then earned := array_append(earned, 'words_500'); end if;
  if reviews >= 100 then earned := array_append(earned, 'reviews_100'); end if;
  if reviews >= 1000 then earned := array_append(earned, 'reviews_1000'); end if;
  if streak >= 3 then earned := array_append(earned, 'streak_3'); end if;
  if streak >= 7 then earned := array_append(earned, 'streak_7'); end if;
  if streak >= 30 then earned := array_append(earned, 'streak_30'); end if;
  if speech >= 25 then earned := array_append(earned, 'speaker_25'); end if;
  if speech >= 250 then earned := array_append(earned, 'speaker_250'); end if;
  if tutor >= 20 then earned := array_append(earned, 'conversation_20'); end if;
  if 'A1' = any(passed) then earned := array_append(earned, 'level_a1'); end if;
  if 'A2' = any(passed) then earned := array_append(earned, 'level_a2'); end if;
  if 'B1' = any(passed) then earned := array_append(earned, 'level_b1'); end if;
  if 'B2' = any(passed) then earned := array_append(earned, 'level_b2'); end if;
  if games >= 1 then earned := array_append(earned, 'first_game'); end if;
  if games >= 50 then earned := array_append(earned, 'games_50'); end if;
  if games >= 250 then earned := array_append(earned, 'games_250'); end if;
  if wins >= 1 then earned := array_append(earned, 'first_win'); end if;
  if rated_wins >= 1 then earned := array_append(earned, 'first_rated_win'); end if;
  if placed then earned := array_append(earned, 'placed'); end if;
  if best >= 800 then earned := array_append(earned, 'rating_800'); end if;
  if best >= 1000 then earned := array_append(earned, 'rating_1000'); end if;
  if best >= 1200 then earned := array_append(earned, 'rating_1200'); end if;
  if best >= 1400 then earned := array_append(earned, 'rating_1400'); end if;
  if best >= 1600 then earned := array_append(earned, 'rating_1600'); end if;
  if best >= 1800 then earned := array_append(earned, 'rating_1800'); end if;
  if best >= 2000 then earned := array_append(earned, 'rating_2000'); end if;
  if best >= 2200 then earned := array_append(earned, 'rating_2200'); end if;

  with ins as (
    insert into public.user_achievements (user_id, achievement_id)
    select u, e from unnest(earned) e
    where exists (select 1 from public.achievements a where a.id = e)
    on conflict do nothing
    returning achievement_id
  )
  select coalesce(array_agg(achievement_id), '{}') into out from ins;
  return out;
end
$$;

create or replace function public.mini_player(viewer uuid, target uuid, p_pool text) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'username', p.username,
    'display_name', p.display_name,
    'ru_level', p.ru_level,
    'online', p.show_online and p.last_seen > now() - interval '3 minutes',
    'rating', case when coalesce(r.games, 0) >= public.placement_games() then r.rating end,
    'rating_status', public.rating_status(coalesce(r.games, 0)),
    'placement_left', greatest(0, public.placement_games() - coalesce(r.games, 0))
  )
  from public.profiles p
  left join public.ratings r on r.user_id = p.id and r.pool = p_pool
  where p.id = target
$$;

create or replace function public.game_summary(viewer uuid, g public.games) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'time_control', g.time_control,
    'pool', g.pool,
    'rated', g.rated,
    'opponent_kind', g.opponent_kind,
    'ai_elo', g.ai_elo,
    'status', g.status,
    'result', g.result,
    'termination', g.termination,
    'my_color', case when g.white_id = viewer then 'white' else 'black' end,
    'turn', split_part(g.fen, ' ', 2),
    'ply', cardinality(g.moves),
    'white_ms', g.white_ms,
    'black_ms', g.black_ms,
    'turn_started_at', g.turn_started_at,
    'updated_at', g.updated_at,
    'finished_at', g.finished_at,
    'created_at', g.created_at,
    'my_delta', case when g.white_id = viewer then g.white_delta else g.black_delta end,
    'my_rating', case when g.white_id = viewer then g.white_rating else g.black_rating end,
    'my_status', case when g.white_id = viewer then g.white_status else g.black_status end,
    'opponent_rating', case when g.white_id = viewer then g.black_rating else g.white_rating end,
    'opponent', case when g.opponent_kind = 'human'
      then public.mini_player(viewer, case when g.white_id = viewer then g.black_id else g.white_id end, g.pool) end
  )
$$;

create or replace function public.create_game(w uuid, b uuid, tc text, p_rated boolean, p_rc boolean, prev uuid, chal uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  t public.time_controls;
  g uuid;
begin
  select * into t from public.time_controls where id = tc;
  if not found or t.ai_only then
    raise exception 'Unknown time control.' using errcode = '22023';
  end if;
  insert into public.games (white_id, black_id, opponent_kind, time_control, pool, rated, russian_chat,
                            initial_ms, increment_ms, per_move, white_ms, black_ms, rematch_of, challenge_id)
  values (w, b, 'human', tc, t.pool, p_rated, p_rc, t.initial_ms, t.increment_ms, t.per_move,
          t.initial_ms, t.initial_ms, prev, chal)
  returning id into g;
  return g;
end
$$;

create or replace function public.active_game_between(a uuid, b uuid) returns uuid
language sql stable
set search_path = ''
as $$
  select id from public.games
  where status = 'active' and opponent_kind = 'human'
    and ((white_id = a and black_id = b) or (white_id = b and black_id = a))
  limit 1
$$;

-- ---------------------------------------------------------------------
-- Elo
--  Placement (first N games, N = app_config.placement_games, default 5):
--    performance rating with one virtual draw against 1200:
--    R = (1200 + Σ opponent ratings + 400 × (W − L)) / (games + 1)
--  After placement: R' = R + K × (S − E), E = 1 / (1 + 10^((Ropp − R)/400))
--    K = 40 until 20 games (provisional), 20 afterwards, 10 at 2400+.
--  Ratings never drop below 100.
-- ---------------------------------------------------------------------
create or replace function public.elo_next(r int, games int, opp_sum bigint, score_sum numeric,
                                           opp int, s numeric, n_place int) returns int
language plpgsql immutable
set search_path = ''
as $$
declare
  k int;
  played int;
  e numeric;
begin
  if games < n_place then
    played := games + 1;
    return greatest(100, least(3000, round(
      (1200 + opp_sum + opp + 400 * (2 * (score_sum + s) - played))::numeric / (played + 1))))::int;
  end if;
  k := case when games < 20 then 40 when r >= 2400 then 10 else 20 end;
  e := 1 / (1 + power(10::numeric, (opp - r)::numeric / 400));
  return greatest(100, round(r + k * (s - e)))::int;
end
$$;

-- service: applies the rating change of a finished rated game exactly once
create or replace function public.apply_game_ratings(p_game uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.games;
  n int := public.placement_games();
  rw public.ratings;
  rb public.ratings;
  sw numeric;
  nw int;
  nb int;
begin
  select * into g from public.games where id = p_game for update;
  if not found or not g.rated or g.rating_applied or g.status <> 'finished' or g.result is null
     or g.white_id is null or g.black_id is null or g.pool not in ('bullet','blitz','rapid','daily') then
    return;
  end if;

  insert into public.ratings (user_id, pool) values (g.white_id, g.pool), (g.black_id, g.pool) on conflict do nothing;
  perform 1 from public.ratings where pool = g.pool and user_id in (g.white_id, g.black_id) order by user_id for update;
  select * into rw from public.ratings where user_id = g.white_id and pool = g.pool;
  select * into rb from public.ratings where user_id = g.black_id and pool = g.pool;

  sw := case g.result when '1-0' then 1 when '0-1' then 0 else 0.5 end;
  nw := public.elo_next(rw.rating, rw.games, rw.opp_sum, rw.score_sum, rb.rating, sw, n);
  nb := public.elo_next(rb.rating, rb.games, rb.opp_sum, rb.score_sum, rw.rating, 1 - sw, n);

  update public.ratings set
    rating = nw,
    games = games + 1,
    wins = wins + (sw = 1)::int,
    losses = losses + (sw = 0)::int,
    draws = draws + (sw = 0.5)::int,
    opp_sum = opp_sum + case when rw.games < n then rb.rating else 0 end,
    score_sum = score_sum + case when rw.games < n then sw else 0 end,
    peak = case when rw.games + 1 >= n then greatest(coalesce(peak, 0), nw) else peak end,
    updated_at = now()
  where user_id = g.white_id and pool = g.pool;

  update public.ratings set
    rating = nb,
    games = games + 1,
    wins = wins + (sw = 0)::int,
    losses = losses + (sw = 1)::int,
    draws = draws + (sw = 0.5)::int,
    opp_sum = opp_sum + case when rb.games < n then rw.rating else 0 end,
    score_sum = score_sum + case when rb.games < n then 1 - sw else 0 end,
    peak = case when rb.games + 1 >= n then greatest(coalesce(peak, 0), nb) else peak end,
    updated_at = now()
  where user_id = g.black_id and pool = g.pool;

  update public.games set
    white_rating = rw.rating, black_rating = rb.rating,
    white_delta = nw - rw.rating, black_delta = nb - rb.rating,
    white_status = public.rating_status(rw.games + 1), black_status = public.rating_status(rb.games + 1),
    rating_applied = true
  where id = g.id;

  insert into public.rating_history (user_id, pool, game_id, rating_before, rating_after, status_after, opponent_id, opponent_rating, score)
  values (g.white_id, g.pool, g.id, rw.rating, nw, public.rating_status(rw.games + 1), g.black_id, rb.rating, sw),
         (g.black_id, g.pool, g.id, rb.rating, nb, public.rating_status(rb.games + 1), g.white_id, rw.rating, 1 - sw);
end
$$;

-- service: everything that happens once a game is over
create or replace function public.finalize_game(p_game uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  g public.games;
  u uuid;
begin
  select * into g from public.games where id = p_game;
  if not found or g.status <> 'finished' then
    return;
  end if;
  perform public.apply_game_ratings(p_game);
  foreach u in array array[g.white_id, g.black_id] loop
    if u is not null and exists (select 1 from public.profiles where id = u) then
      perform public.log_activity(u, 'game',
        (g.result = '1-0' and g.white_id = u) or (g.result = '0-1' and g.black_id = u), g.id::text);
      perform public.check_achievements(u);
    end if;
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- Presence & account
-- ---------------------------------------------------------------------
create or replace function public.heartbeat() returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.profiles set last_seen = now()
  where id = public.require_uid() and last_seen < now() - interval '20 seconds';
end
$$;

create or replace function public.server_now() returns timestamptz
language sql stable
set search_path = ''
as $$ select now() $$;

create or replace function public.username_available(p_username text) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare v text := lower(btrim(coalesce(p_username, '')));
begin
  perform public.require_uid();
  return v ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = v and id <> public.app_uid());
end
$$;

create or replace function public.set_ru_level(p_level text) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_level not in ('A1','A2','B1','B2') then
    raise exception 'Unknown level.' using errcode = '22023';
  end if;
  update public.profiles set ru_level = p_level where id = public.require_uid();
end
$$;

create or replace function public.my_plan() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  return jsonb_build_object(
    'entitlements', public.entitlements(v_uid),
    'subscription', (select to_jsonb(s) - 'provider_customer_id' - 'provider_subscription_id'
                     from public.subscriptions s where s.user_id = v_uid),
    'plans', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'tagline', p.tagline,
                         'features', p.features, 'price_cents', p.price_cents, 'currency', p.currency,
                         'billing_interval', p.billing_interval) order by p.sort)
                       from public.plans p where p.active), '[]'::jsonb)
  );
end
$$;

-- ---------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------
create or replace function public.dashboard() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  p public.profiles;
  today date;
  n int := public.placement_games();
  lvl_total int; lvl_done int; all_total int; all_done int; lvl_test boolean;
  next_lesson jsonb;
begin
  p := public.require_profile(v_uid);
  today := public.local_day(v_uid);

  select count(*), count(lp.completed_at) into lvl_total, lvl_done
  from public.lessons l
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_uid
  where l.level = p.ru_level;
  select count(*), count(lp.completed_at) into all_total, all_done
  from public.lessons l
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_uid;
  select exists (select 1 from public.test_attempts a where a.user_id = v_uid and a.test_id = p.ru_level and a.passed) into lvl_test;

  select jsonb_build_object('id', l.id, 'title', l.title, 'title_ru', l.title_ru, 'level', l.level,
                            'category_id', l.category_id, 'summary', l.summary)
    into next_lesson
  from public.lessons l
  left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_uid
  where l.level = p.ru_level and lp.completed_at is null
  order by l.sort
  limit 1;

  return jsonb_build_object(
    'profile', jsonb_build_object('display_name', p.display_name, 'username', p.username, 'ru_level', p.ru_level),
    'entitlements', public.entitlements(v_uid),
    'russian', jsonb_build_object(
      'level', p.ru_level,
      'level_lessons_total', lvl_total,
      'level_lessons_done', lvl_done,
      'level_test_passed', lvl_test,
      'level_progress', case when lvl_total = 0 then 0 else round(100.0 * (lvl_done + lvl_test::int) / (lvl_total + 1)) end,
      'overall_progress', case when all_total = 0 then 0 else round(100.0 * all_done / all_total) end,
      'lessons_completed', all_done,
      'lessons_total', all_total,
      'words', (select count(*) from public.srs_items s where s.user_id = v_uid and s.kind = 'word'),
      'mastered', (select count(*) from public.srs_items s where s.user_id = v_uid and s.kind = 'word' and s.interval_days >= 21),
      'phrases', (select count(*) from public.saved_phrases sp where sp.user_id = v_uid),
      'due_reviews', (select count(*) from public.srs_items s where s.user_id = v_uid and s.due_at <= now()),
      'streak', case when p.last_active_day >= today - 1 then p.streak_current else 0 end,
      'streak_best', p.streak_best,
      'active_today', p.last_active_day = today,
      'listening', (select jsonb_build_object('correct', count(*) filter (where a.correct), 'total', count(*))
                    from public.activity a where a.user_id = v_uid and a.kind = 'listening'),
      'speaking', (select jsonb_build_object('attempts', count(*), 'passed', count(*) filter (where sa.passed),
                                             'avg_score', round(avg(sa.pron_score)))
                   from public.speech_attempts sa where sa.user_id = v_uid),
      'next_lesson', next_lesson,
      'certified', coalesce((select jsonb_agg(distinct t.level) from public.test_attempts a join public.tests t on t.id = a.test_id
                             where a.user_id = v_uid and a.passed and t.level is not null), '[]'::jsonb)
    ),
    'chess', jsonb_build_object(
      'ratings', coalesce((select jsonb_agg(jsonb_build_object(
                    'pool', r.pool,
                    'rating', case when r.games >= n then r.rating end,
                    'status', public.rating_status(r.games),
                    'games', r.games, 'wins', r.wins, 'losses', r.losses, 'draws', r.draws,
                    'peak', r.peak,
                    'placement_left', greatest(0, n - r.games)) order by r.games desc)
                  from public.ratings r where r.user_id = v_uid), '[]'::jsonb),
      'totals', (select jsonb_build_object(
                   'games', count(*),
                   'wins', count(*) filter (where (g.result = '1-0' and g.white_id = v_uid) or (g.result = '0-1' and g.black_id = v_uid)),
                   'losses', count(*) filter (where (g.result = '0-1' and g.white_id = v_uid) or (g.result = '1-0' and g.black_id = v_uid)),
                   'draws', count(*) filter (where g.result = '1/2-1/2'),
                   'vs_ai', count(*) filter (where g.opponent_kind = 'ai'))
                 from public.games g where g.status = 'finished' and v_uid in (g.white_id, g.black_id)),
      'recent', coalesce((select jsonb_agg(public.game_summary(v_uid, g) order by g.finished_at desc)
                 from (select * from public.games g2 where g2.status = 'finished' and v_uid in (g2.white_id, g2.black_id)
                       order by g2.finished_at desc limit 5) g), '[]'::jsonb),
      'active', (select count(*) from public.games g where g.status = 'active' and v_uid in (g.white_id, g.black_id))
    ),
    'objectives', jsonb_build_object(
      'lesson', (select count(*) from public.activity a where a.user_id = v_uid and a.day = today and a.kind = 'lesson' and a.correct),
      'game', (select count(*) from public.activity a where a.user_id = v_uid and a.day = today and a.kind = 'game'),
      'words', (select count(*) from public.srs_items s where s.user_id = v_uid and s.kind = 'word'
                  and (s.created_at at time zone p.timezone)::date = today),
      'words_goal', p.daily_goal_words,
      'sentences', (select count(*) from public.activity a where a.user_id = v_uid and a.day = today
                      and a.kind in ('speaking','listening','phrase','tutor'))
    ),
    'achievements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'tier', a.tier,
                                'description', a.description, 'earned_at', ua.earned_at) order by ua.earned_at desc)
                              from (select * from public.user_achievements x where x.user_id = v_uid
                                    order by x.earned_at desc limit 4) ua
                              join public.achievements a on a.id = ua.achievement_id), '[]'::jsonb),
    'achievement_count', (select count(*) from public.user_achievements x where x.user_id = v_uid)
  );
end
$$;

-- ---------------------------------------------------------------------
-- Curriculum
-- ---------------------------------------------------------------------
create or replace function public.curriculum() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  ent jsonb := public.entitlements(v_uid);
begin
  return jsonb_build_object(
    'current_level', (select ru_level from public.profiles where id = v_uid),
    'entitlements', ent,
    'categories', (select jsonb_agg(to_jsonb(c) order by c.sort) from public.lesson_categories c),
    'levels', (select jsonb_agg(jsonb_build_object(
        'code', lv.code, 'name', lv.name, 'description', lv.description,
        'locked', not (ent -> 'levels' ? lv.code),
        'lessons', coalesce((select jsonb_agg(jsonb_build_object(
              'id', l.id, 'title', l.title, 'title_ru', l.title_ru, 'summary', l.summary,
              'category_id', l.category_id, 'sort', l.sort, 'line_count', l.line_count, 'vocab_count', l.vocab_count,
              'completed', lp.completed_at is not null, 'best_score', lp.best_score, 'attempts', coalesce(lp.attempts, 0))
            order by l.sort)
          from public.lessons l
          left join public.lesson_progress lp on lp.lesson_id = l.id and lp.user_id = v_uid
          where l.level = lv.code), '[]'::jsonb),
        'test', (select jsonb_build_object('id', t.id, 'title', t.title, 'summary', t.summary, 'pass_pct', t.pass_pct,
                   'passed', exists (select 1 from public.test_attempts a where a.user_id = v_uid and a.test_id = t.id and a.passed),
                   'best_pct', (select max(round(100.0 * a.score / nullif(a.total, 0))) from public.test_attempts a
                                where a.user_id = v_uid and a.test_id = t.id))
                 from public.tests t where t.level = lv.code))
      order by lv.sort) from public.levels lv)
  );
end
$$;

create or replace function public.get_lesson(p_id text) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  l public.lessons;
begin
  select * into l from public.lessons where id = p_id;
  if not found then
    raise exception 'Lesson not found.' using errcode = '22023';
  end if;
  if not public.level_allowed(v_uid, l.level) then
    raise exception 'This lesson is part of Premium.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'id', l.id, 'level', l.level, 'category_id', l.category_id, 'title', l.title, 'title_ru', l.title_ru,
    'summary', l.summary, 'content', l.content,
    'vocab', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'ru', v.ru, 'stressed', v.stressed, 'en', v.en,
                          'pos', v.pos, 'note', v.note) order by v.id)
                       from public.vocab v where v.lesson_id = l.id), '[]'::jsonb),
    'progress', (select to_jsonb(lp) - 'user_id' from public.lesson_progress lp where lp.user_id = v_uid and lp.lesson_id = l.id),
    'next_id', (select n.id from public.lessons n where n.level = l.level and n.sort > l.sort order by n.sort limit 1)
  );
end
$$;

create or replace function public.complete_lesson(p_id text, p_score int) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  l public.lessons;
  was_done boolean;
  done boolean := coalesce(p_score, 0) >= 60;
  added int := 0;
  best int;
begin
  perform public.require_profile(v_uid);
  select * into l from public.lessons where id = p_id;
  if not found then
    raise exception 'Lesson not found.' using errcode = '22023';
  end if;
  if not public.level_allowed(v_uid, l.level) then
    raise exception 'This lesson is part of Premium.' using errcode = '42501';
  end if;
  p_score := greatest(0, least(100, coalesce(p_score, 0)));

  select completed_at is not null into was_done from public.lesson_progress where user_id = v_uid and lesson_id = p_id;
  insert into public.lesson_progress (user_id, lesson_id, attempts, best_score, completed_at, updated_at)
  values (v_uid, p_id, 1, p_score, case when done then now() end, now())
  on conflict (user_id, lesson_id) do update set
    attempts = public.lesson_progress.attempts + 1,
    best_score = greatest(public.lesson_progress.best_score, excluded.best_score),
    completed_at = coalesce(public.lesson_progress.completed_at, excluded.completed_at),
    updated_at = now()
  returning best_score into best;

  if done then
    with ins as (
      insert into public.srs_items (user_id, kind, item_id)
      select v_uid, 'word', v.id from public.vocab v where v.lesson_id = p_id
      on conflict do nothing
      returning 1
    ) select count(*) into added from ins;
  end if;

  perform public.log_activity(v_uid, 'lesson', done, p_id);
  return jsonb_build_object(
    'completed', done,
    'first_completion', done and not coalesce(was_done, false),
    'best_score', best,
    'words_added', added,
    'new_achievements', public.check_achievements(v_uid)
  );
end
$$;

-- ---------------------------------------------------------------------
-- Tests (graded on the server; answers never reach the client before
-- submission)
-- ---------------------------------------------------------------------
create or replace function public.get_test(p_id text) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  t public.tests;
begin
  select * into t from public.tests where id = p_id;
  if not found then
    raise exception 'Test not found.' using errcode = '22023';
  end if;
  if t.level is not null and not public.level_allowed(v_uid, t.level) then
    raise exception 'This test is part of Premium.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'id', t.id, 'level', t.level, 'title', t.title, 'summary', t.summary, 'pass_pct', t.pass_pct,
    'items', (select jsonb_agg(jsonb_build_object('id', i.id, 'level', i.level, 'kind', i.kind, 'prompt', i.prompt,
                                                  'ru', i.ru, 'options', i.options) order by i.sort)
              from public.test_items i where i.test_id = t.id)
  );
end
$$;

create or replace function public.submit_test(p_id text, p_answers jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  t public.tests;
  p public.profiles;
  has_profile boolean;
  total int;
  score int;
  passed boolean;
  results jsonb;
  per_level jsonb;
  rec text := 'A1';
  lv text;
  acc numeric;
  lvl_after text;
  next_lvl text;
begin
  select * into t from public.tests where id = p_id;
  if not found then
    raise exception 'Test not found.' using errcode = '22023';
  end if;
  if t.level is not null and not public.level_allowed(v_uid, t.level) then
    raise exception 'This test is part of Premium.' using errcode = '42501';
  end if;
  select * into p from public.profiles where id = v_uid;
  has_profile := found;
  if t.id <> 'placement' and not has_profile then
    raise exception 'Finish setting up your account first.' using errcode = '22023';
  end if;
  p_answers := coalesce(p_answers, '{}'::jsonb);

  select count(*), count(*) filter (where (p_answers ->> i.id)::int = i.answer),
         jsonb_agg(jsonb_build_object('id', i.id, 'answer', i.answer, 'chosen', (p_answers ->> i.id)::int,
                                      'correct', (p_answers ->> i.id)::int = i.answer) order by i.sort)
    into total, score, results
  from public.test_items i where i.test_id = t.id;

  if t.id = 'placement' then
    select jsonb_object_agg(x.level, x.acc) into per_level from (
      select i.level, round(avg(case when (p_answers ->> i.id)::int = i.answer then 1 else 0 end), 2) as acc
      from public.test_items i where i.test_id = t.id group by i.level) x;
    -- start at the first level you haven't mastered (70%+)
    rec := 'A1';
    foreach lv in array array['A1','A2','B1','B2'] loop
      acc := coalesce((per_level ->> lv)::numeric, 0);
      rec := lv;
      exit when acc < 0.7;
    end loop;
    if has_profile then
      insert into public.test_attempts (user_id, test_id, score, total, passed, level_before, level_after)
      values (v_uid, t.id, score, total, true, p.ru_level, rec);
      update public.profiles set ru_level = rec where id = v_uid;
      perform public.log_activity(v_uid, 'test', true, t.id);
    end if;
    return jsonb_build_object('score', score, 'total', total, 'recommended', rec, 'per_level', per_level, 'results', results);
  end if;

  passed := total > 0 and score * 100 >= t.pass_pct * total;
  lvl_after := p.ru_level;
  next_lvl := case t.level when 'A1' then 'A2' when 'A2' then 'B1' when 'B1' then 'B2' end;
  if passed and p.ru_level = t.level and next_lvl is not null then
    lvl_after := next_lvl;
    update public.profiles set ru_level = next_lvl where id = v_uid;
  end if;
  insert into public.test_attempts (user_id, test_id, score, total, passed, level_before, level_after)
  values (v_uid, t.id, score, total, passed, p.ru_level, lvl_after);
  perform public.log_activity(v_uid, 'test', passed, t.id);
  return jsonb_build_object('score', score, 'total', total, 'passed', passed, 'pass_pct', t.pass_pct,
                            'level_before', p.ru_level, 'level_after', lvl_after, 'results', results,
                            'new_achievements', public.check_achievements(v_uid));
end
$$;

-- ---------------------------------------------------------------------
-- Spaced repetition, vocabulary and saved phrases
-- ---------------------------------------------------------------------
create or replace function public.review_queue(p_limit int default 20) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  p public.profiles;
begin
  p := public.require_profile(v_uid);
  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  return jsonb_build_object(
    'due_total', (select count(*) from public.srs_items s where s.user_id = v_uid and s.due_at <= now()),
    'items', coalesce((select jsonb_agg(x.item order by x.due_at) from (
        select s.due_at, jsonb_build_object(
          'kind', s.kind, 'item_id', s.item_id, 'reps', s.reps, 'lapses', s.lapses,
          'ru', coalesce(v.ru, sp.ru), 'stressed', coalesce(v.stressed, sp.ru), 'en', coalesce(v.en, sp.en),
          'pos', coalesce(v.pos, 'phrase'), 'note', coalesce(v.note, '')) as item
        from public.srs_items s
        left join public.vocab v on s.kind = 'word' and v.id = s.item_id
        left join public.saved_phrases sp on s.kind = 'phrase' and sp.id::text = s.item_id and sp.user_id = v_uid
        where s.user_id = v_uid and s.due_at <= now() and coalesce(v.ru, sp.ru) is not null
        order by s.due_at
        limit p_limit) x), '[]'::jsonb),
    'distractors', coalesce((select jsonb_agg(jsonb_build_object('ru', d.ru, 'en', d.en, 'pos', d.pos)) from (
        select v.ru, v.en, v.pos from public.vocab v
        where v.level <= p.ru_level
        order by random() limit 60) d), '[]'::jsonb)
  );
end
$$;

create or replace function public.record_review(p_kind text, p_item text, p_grade int) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  it public.srs_items;
  lim int := (public.entitlements(v_uid) ->> 'daily_reviews')::int;
  n_reps int;
  ivl real;
  ez real;
begin
  if p_grade not between 0 and 3 then
    raise exception 'Invalid grade.' using errcode = '22023';
  end if;
  select * into it from public.srs_items where user_id = v_uid and kind = p_kind and item_id = p_item for update;
  if not found then
    raise exception 'That item isn''t in your review deck.' using errcode = '22023';
  end if;
  if lim is not null and (select count(*) from public.activity a where a.user_id = v_uid
                           and a.day = public.local_day(v_uid) and a.kind = 'review') >= lim then
    raise exception 'You''ve reached today''s free review limit. Premium removes the limit.' using errcode = '42501';
  end if;

  ez := it.ease;
  if p_grade = 0 then
    n_reps := 0;
    ivl := 0;
    ez := greatest(1.3, ez - 0.2);
  else
    n_reps := it.reps + 1;
    ivl := case
      when n_reps = 1 then case p_grade when 3 then 3 else 1 end
      when n_reps = 2 then case p_grade when 1 then 2 when 2 then 3 else 6 end
      else greatest(1, it.interval_days * case p_grade when 1 then 1.2 when 2 then ez else ez * 1.3 end)
    end;
    ez := case p_grade when 1 then greatest(1.3, ez - 0.15) when 3 then ez + 0.15 else ez end;
  end if;

  update public.srs_items set
    reps = n_reps,
    lapses = lapses + (p_grade = 0)::int,
    correct = correct + (p_grade > 0)::int,
    incorrect = incorrect + (p_grade = 0)::int,
    ease = ez,
    interval_days = ivl,
    due_at = case when p_grade = 0 then now() + interval '10 minutes' else now() + make_interval(secs => ivl * 86400) end,
    last_reviewed_at = now()
  where user_id = v_uid and kind = p_kind and item_id = p_item;

  perform public.log_activity(v_uid, 'review', p_grade > 0, p_kind || ':' || p_item);
  return jsonb_build_object('interval_days', ivl, 'new_achievements', public.check_achievements(v_uid));
end
$$;

create or replace function public.add_words(p_ids text[]) returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  added int;
begin
  perform public.require_profile(v_uid);
  with ins as (
    insert into public.srs_items (user_id, kind, item_id)
    select v_uid, 'word', v.id from public.vocab v
    where v.id = any(coalesce(p_ids, '{}')) and public.level_allowed(v_uid, v.level)
    on conflict do nothing
    returning 1
  ) select count(*) into added from ins;
  return added;
end
$$;

create or replace function public.save_phrase(p_ru text, p_en text, p_source text default 'game') returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  lim int := (public.entitlements(v_uid) ->> 'saved_phrases')::int;
  v_id bigint;
begin
  perform public.require_profile(v_uid);
  p_ru := btrim(coalesce(p_ru, ''));
  if p_ru = '' or char_length(p_ru) > 300 then
    raise exception 'That phrase can''t be saved.' using errcode = '22023';
  end if;
  if p_source not in ('game','lesson','chat','practice','tutor') then
    p_source := 'game';
  end if;
  if lim is not null and not exists (select 1 from public.saved_phrases where user_id = v_uid and ru = p_ru)
     and (select count(*) from public.saved_phrases where user_id = v_uid) >= lim then
    raise exception 'Free accounts can save % phrases. Premium removes the limit.', lim using errcode = '42501';
  end if;
  insert into public.saved_phrases (user_id, ru, en, source)
  values (v_uid, p_ru, left(btrim(coalesce(p_en, '')), 300), p_source)
  on conflict (user_id, ru) do update set en = coalesce(nullif(excluded.en, ''), public.saved_phrases.en)
  returning id into v_id;
  insert into public.srs_items (user_id, kind, item_id) values (v_uid, 'phrase', v_id::text) on conflict do nothing;
  return v_id;
end
$$;

create or replace function public.delete_phrase(p_id bigint) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  delete from public.srs_items where user_id = v_uid and kind = 'phrase' and item_id = p_id::text;
  delete from public.saved_phrases where user_id = v_uid and id = p_id;
end
$$;

create or replace function public.my_vocabulary() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  return jsonb_build_object(
    'words', coalesce((select jsonb_agg(jsonb_build_object(
        'id', v.id, 'ru', v.ru, 'stressed', v.stressed, 'en', v.en, 'pos', v.pos, 'note', v.note, 'level', v.level,
        'lesson_id', v.lesson_id, 'lesson_title', l.title, 'tags', v.tags,
        'reps', s.reps, 'lapses', s.lapses, 'correct', s.correct, 'incorrect', s.incorrect,
        'interval_days', s.interval_days, 'due_at', s.due_at, 'added_at', s.created_at) order by s.created_at desc)
      from public.srs_items s
      join public.vocab v on v.id = s.item_id
      left join public.lessons l on l.id = v.lesson_id
      where s.user_id = v_uid and s.kind = 'word'), '[]'::jsonb),
    'phrases', coalesce((select jsonb_agg(jsonb_build_object(
        'id', sp.id, 'ru', sp.ru, 'en', sp.en, 'source', sp.source, 'created_at', sp.created_at,
        'reps', s.reps, 'lapses', s.lapses, 'interval_days', s.interval_days, 'due_at', s.due_at) order by sp.created_at desc)
      from public.saved_phrases sp
      left join public.srs_items s on s.user_id = v_uid and s.kind = 'phrase' and s.item_id = sp.id::text
      where sp.user_id = v_uid), '[]'::jsonb)
  );
end
$$;

-- Words the learner is struggling with or that are due: shown again
-- during chess games.
create or replace function public.focus_words() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  return coalesce((select jsonb_agg(x.j) from (
    select jsonb_build_object('id', v.id, 'ru', v.ru, 'stressed', v.stressed, 'en', v.en, 'tags', v.tags,
                              'lapses', s.lapses, 'due', s.due_at <= now()) as j
    from public.srs_items s join public.vocab v on v.id = s.item_id
    where s.user_id = v_uid and s.kind = 'word' and (s.lapses > 0 or s.due_at <= now())
    order by s.lapses desc, s.due_at
    limit 25) x), '[]'::jsonb);
end
$$;

create or replace function public.record_practice(p_kind text, p_correct boolean, p_ref text default null) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  perform public.require_profile(v_uid);
  if p_kind not in ('listening','speaking','phrase') then
    raise exception 'Unknown practice type.' using errcode = '22023';
  end if;
  if (select count(*) from public.activity where user_id = v_uid and created_at > now() - interval '1 minute') > 120 then
    raise exception 'Slow down a little.' using errcode = '22023';
  end if;
  perform public.log_activity(v_uid, p_kind, p_correct, left(p_ref, 200));
  return jsonb_build_object('new_achievements', public.check_achievements(v_uid));
end
$$;

-- ---------------------------------------------------------------------
-- Pronunciation
-- ---------------------------------------------------------------------
-- Attempts checked by the device's speech recognizer (no score). Azure-
-- scored attempts are written by the `speech` edge function.
create or replace function public.record_speech_attempt(p_text text, p_ref text, p_recognized text, p_words jsonb,
                                                        p_passed boolean, p_duration_ms int) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  perform public.require_profile(v_uid);
  if (select count(*) from public.speech_attempts where user_id = v_uid and created_at > now() - interval '1 hour') >= 600 then
    raise exception 'You''ve practiced a lot this hour. Take a short break.' using errcode = '22023';
  end if;
  insert into public.speech_attempts (user_id, text, ref, provider, recognized, words, passed, duration_ms)
  values (v_uid, left(btrim(p_text), 400), left(p_ref, 200), 'browser', left(coalesce(p_recognized, ''), 400),
          coalesce(p_words, '[]'::jsonb), coalesce(p_passed, false), greatest(0, least(120000, coalesce(p_duration_ms, 0))));
  perform public.log_activity(v_uid, 'speaking', coalesce(p_passed, false), left(p_ref, 200));
  return jsonb_build_object('new_achievements', public.check_achievements(v_uid));
end
$$;

-- service: Azure-scored attempts
create or replace function public.record_scored_attempt(u uuid, p_text text, p_ref text, p_recognized text,
  p_pron numeric, p_acc numeric, p_flu numeric, p_comp numeric, p_pros numeric, p_words jsonb, p_duration_ms int)
returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare v_id bigint;
begin
  insert into public.speech_attempts (user_id, text, ref, provider, recognized, pron_score, accuracy, fluency,
                                      completeness, prosody, words, passed, duration_ms)
  values (u, left(btrim(p_text), 400), left(p_ref, 200), 'azure', left(coalesce(p_recognized, ''), 400),
          p_pron, p_acc, p_flu, p_comp, p_pros, coalesce(p_words, '[]'::jsonb), coalesce(p_pron, 0) >= 70,
          greatest(0, least(120000, coalesce(p_duration_ms, 0))))
  returning id into v_id;
  perform public.log_activity(u, 'speaking', coalesce(p_pron, 0) >= 70, left(p_ref, 200));
  perform public.check_achievements(u);
  return v_id;
end
$$;

create or replace function public.pronunciation_overview() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  return jsonb_build_object(
    'milestones', coalesce((select jsonb_agg(jsonb_build_object(
        'id', m.id, 'level', m.level, 'title', m.title, 'summary', m.summary, 'focus', m.focus,
        'pass_count', m.pass_count, 'item_count', jsonb_array_length(m.items), 'items', m.items,
        'passed_items', coalesce((select jsonb_agg(distinct split_part(sa.ref, ':', 3)::int)
                                  from public.speech_attempts sa
                                  where sa.user_id = v_uid and sa.passed and sa.ref like 'pm:' || m.id || ':%'), '[]'::jsonb),
        'locked', not public.level_allowed(v_uid, m.level)) order by m.level, m.sort)
      from public.pron_milestones m), '[]'::jsonb),
    'stats', (select jsonb_build_object(
        'attempts', count(*),
        'words_practiced', count(distinct sa.text) filter (where sa.text !~ '\s'),
        'sentences_spoken', count(*) filter (where sa.text ~ '\s'),
        'passed', count(*) filter (where sa.passed),
        'speaking_seconds', coalesce(sum(sa.duration_ms), 0) / 1000,
        'avg_score', round(avg(sa.pron_score)),
        'avg_score_7d', round(avg(sa.pron_score) filter (where sa.created_at > now() - interval '7 days')),
        'scored', count(sa.pron_score))
      from public.speech_attempts sa where sa.user_id = v_uid),
    'trend', coalesce((select jsonb_agg(jsonb_build_object('day', d.day, 'attempts', d.n, 'passed', d.ok, 'avg_score', d.s) order by d.day)
      from (select (sa.created_at at time zone coalesce((select timezone from public.profiles where id = v_uid), 'UTC'))::date as day,
                   count(*) as n, count(*) filter (where sa.passed) as ok, round(avg(sa.pron_score)) as s
            from public.speech_attempts sa
            where sa.user_id = v_uid and sa.created_at > now() - interval '30 days'
            group by 1) d), '[]'::jsonb),
    'difficult_words', coalesce((select jsonb_agg(jsonb_build_object('text', w.text, 'fails', w.fails, 'tries', w.tries) order by w.fails desc, w.tries desc)
      from (select sa.text, count(*) filter (where not sa.passed) as fails, count(*) as tries
            from public.speech_attempts sa where sa.user_id = v_uid
            group by sa.text having count(*) filter (where not sa.passed) > 0
            order by 2 desc, 3 desc limit 10) w), '[]'::jsonb),
    'difficult_sounds', coalesce((select jsonb_agg(jsonb_build_object('sound', s.sound, 'fails', s.fails) order by s.fails desc)
      from (select snd.sound, count(*) as fails
            from public.speech_attempts sa
            cross join lateral unnest(array['ы','щ','ж','ц','ч','ш','ь','р','х']) as snd(sound)
            where sa.user_id = v_uid and not sa.passed and position(snd.sound in lower(sa.text)) > 0
            group by snd.sound order by 2 desc limit 6) s), '[]'::jsonb),
    'listening', (select jsonb_build_object('correct', count(*) filter (where a.correct), 'total', count(*))
                  from public.activity a where a.user_id = v_uid and a.kind = 'listening')
  );
end
$$;

-- ---------------------------------------------------------------------
-- Conversations (AI tutor and guided scenarios)
-- ---------------------------------------------------------------------
create or replace function public.scenarios() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'level', s.level, 'category_id', s.category_id, 'title', s.title, 'title_ru', s.title_ru,
      'description', s.description, 'tutor_role', s.tutor_role, 'steps', jsonb_array_length(s.script),
      'locked', not public.level_allowed(v_uid, s.level)) order by s.level, s.sort)
    from public.conversation_scenarios s), '[]'::jsonb);
end
$$;

create or replace function public.get_scenario(p_id text) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  s public.conversation_scenarios;
begin
  select * into s from public.conversation_scenarios where id = p_id;
  if not found then
    raise exception 'Scenario not found.' using errcode = '22023';
  end if;
  if not public.level_allowed(v_uid, s.level) then
    raise exception 'This conversation is part of Premium.' using errcode = '42501';
  end if;
  return to_jsonb(s);
end
$$;

create or replace function public.start_conversation(p_scenario text, p_level text, p_mode text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  v_id uuid;
begin
  perform public.require_profile(v_uid);
  if p_level not in ('A1','A2','B1','B2') or p_mode not in ('ai','guided') then
    raise exception 'Invalid conversation settings.' using errcode = '22023';
  end if;
  if not public.level_allowed(v_uid, p_level) then
    raise exception 'This level is part of Premium.' using errcode = '42501';
  end if;
  if p_mode = 'ai' and not coalesce((public.entitlements(v_uid) ->> 'ai_tutor')::boolean, false) then
    raise exception 'The AI tutor is part of Premium.' using errcode = '42501';
  end if;
  if p_scenario is not null and not exists (select 1 from public.conversation_scenarios where id = p_scenario) then
    raise exception 'Scenario not found.' using errcode = '22023';
  end if;
  if (select count(*) from public.tutor_conversations where user_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'You''ve started a lot of conversations this hour. Try again soon.' using errcode = '22023';
  end if;
  insert into public.tutor_conversations (user_id, scenario_id, level, mode)
  values (v_uid, p_scenario, p_level, p_mode) returning id into v_id;
  return v_id;
end
$$;

-- guided mode: the app logs each turn (AI-mode turns are written by the tutor edge function)
create or replace function public.log_conversation_turn(p_conversation uuid, p_role text, p_ru text, p_en text, p_correction jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  c public.tutor_conversations;
begin
  select * into c from public.tutor_conversations where id = p_conversation and user_id = v_uid for update;
  if not found or c.mode <> 'guided' then
    raise exception 'Conversation not found.' using errcode = '22023';
  end if;
  if p_role not in ('tutor','user') or c.turns >= 200 then
    raise exception 'This conversation can''t take more messages.' using errcode = '22023';
  end if;
  insert into public.tutor_messages (conversation_id, role, ru, en, correction)
  values (c.id, p_role, left(btrim(coalesce(p_ru, '')), 1000), left(coalesce(p_en, ''), 1000), p_correction);
  update public.tutor_conversations set turns = turns + 1, updated_at = now() where id = c.id;
  if p_role = 'user' then
    perform public.log_activity(v_uid, 'tutor', true, c.id::text);
  end if;
end
$$;

-- service: AI-mode turns
create or replace function public.tutor_log(u uuid, p_conversation uuid, p_role text, p_ru text, p_en text, p_correction jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.tutor_messages (conversation_id, role, ru, en, correction)
  values (p_conversation, p_role, left(p_ru, 2000), left(coalesce(p_en, ''), 2000), p_correction);
  update public.tutor_conversations set turns = turns + 1, updated_at = now() where id = p_conversation;
  if p_role = 'user' then
    perform public.log_activity(u, 'tutor', true, p_conversation::text);
    perform public.check_achievements(u);
  end if;
end
$$;

create or replace function public.conversations() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'scenario_id', c.scenario_id, 'title', s.title,
      'level', c.level, 'mode', c.mode, 'turns', c.turns, 'updated_at', c.updated_at) order by c.updated_at desc)
    from (select * from public.tutor_conversations x where x.user_id = v_uid order by x.updated_at desc limit 20) c
    left join public.conversation_scenarios s on s.id = c.scenario_id), '[]'::jsonb);
end
$$;

-- ---------------------------------------------------------------------
-- Matchmaking
-- ---------------------------------------------------------------------
create or replace function public.find_match(p_time_control text, p_rated boolean, p_russian_chat boolean default false)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  t public.time_controls;
  mine public.seeks;
  other public.seeks;
  my_rating int;
  waited numeric := 0;
  win int;
  g uuid;
begin
  perform public.require_profile(v_uid);
  select * into t from public.time_controls where id = p_time_control;
  if not found or t.ai_only then
    raise exception 'Unknown time control.' using errcode = '22023';
  end if;
  p_rated := coalesce(p_rated, false);

  -- someone already paired with us
  select game_id into g from public.seeks where user_id = v_uid and game_id is not null;
  if g is not null then
    delete from public.seeks where user_id = v_uid;
    return jsonb_build_object('status', 'matched', 'game_id', g);
  end if;

  if t.pool <> 'daily' then
    select id into g from public.games
    where status = 'active' and opponent_kind = 'human' and pool <> 'daily' and v_uid in (white_id, black_id)
    limit 1;
    if g is not null then
      delete from public.seeks where user_id = v_uid;
      return jsonb_build_object('status', 'in_game', 'game_id', g);
    end if;
  end if;

  -- one matchmaker at a time keeps pairing simple and race-free
  perform pg_advisory_xact_lock(hashtext('academy-matchmaking'));
  delete from public.seeks where game_id is null and pinged_at < now() - interval '45 seconds';

  select * into mine from public.seeks where user_id = v_uid;
  if found and mine.game_id is not null then
    delete from public.seeks where user_id = v_uid;
    return jsonb_build_object('status', 'matched', 'game_id', mine.game_id);
  end if;
  if found and (mine.time_control <> p_time_control or mine.rated <> p_rated) then
    delete from public.seeks where user_id = v_uid;
    mine := null;
  end if;
  if mine.user_id is not null then
    waited := extract(epoch from now() - mine.created_at);
  end if;

  my_rating := coalesce((select rating from public.ratings where user_id = v_uid and pool = t.pool), 1200);
  win := least(1000, 150 + 50 * floor(waited / 5)::int);

  select s.* into other from public.seeks s
  where s.user_id <> v_uid and s.game_id is null
    and s.time_control = p_time_control and s.rated = p_rated
    and s.pinged_at > now() - interval '15 seconds'
    and not public.is_blocked(v_uid, s.user_id)
    and abs(s.rating - my_rating) <= greatest(win, least(1000, 150 + 50 * floor(extract(epoch from now() - s.created_at) / 5)::int))
  order by abs(s.rating - my_rating), s.created_at
  limit 1;

  if other.user_id is not null then
    if random() < 0.5 then
      g := public.create_game(v_uid, other.user_id, p_time_control, p_rated, coalesce(p_russian_chat, false) and other.russian_chat, null, null);
    else
      g := public.create_game(other.user_id, v_uid, p_time_control, p_rated, coalesce(p_russian_chat, false) and other.russian_chat, null, null);
    end if;
    update public.seeks set game_id = g where user_id = other.user_id;
    delete from public.seeks where user_id = v_uid;
    return jsonb_build_object('status', 'matched', 'game_id', g);
  end if;

  insert into public.seeks (user_id, time_control, rated, russian_chat, rating)
  values (v_uid, p_time_control, p_rated, coalesce(p_russian_chat, false), my_rating)
  on conflict (user_id) do update set pinged_at = now(), russian_chat = excluded.russian_chat, rating = excluded.rating;

  return jsonb_build_object(
    'status', 'waiting',
    'waited_s', floor(waited),
    'window', win,
    'rating', my_rating,
    'searching', (select count(*) from public.seeks s where s.time_control = p_time_control and s.game_id is null
                    and s.pinged_at > now() - interval '15 seconds')
  );
end
$$;

create or replace function public.cancel_seek() returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  g uuid;
begin
  perform pg_advisory_xact_lock(hashtext('academy-matchmaking'));
  delete from public.seeks where user_id = v_uid returning game_id into g;
  return jsonb_build_object('game_id', g);
end
$$;

-- ---------------------------------------------------------------------
-- Challenges and invite links
-- ---------------------------------------------------------------------
create or replace function public.search_players(p_query text) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  q text := lower(btrim(coalesce(p_query, '')));
begin
  if char_length(q) < 2 then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(public.mini_player(v_uid, p.id, 'rapid') order by p.username)
    from (select x.id, x.username from public.profiles x
          where x.id <> v_uid and (x.username like replace(replace(q, '%', ''), '_', '\_') || '%'
                                   or lower(x.display_name) like '%' || replace(q, '%', '') || '%')
            and not public.is_blocked(v_uid, x.id)
          order by x.username limit 10) p), '[]'::jsonb);
end
$$;

create or replace function public.check_new_challenge(v_uid uuid, p_time_control text, p_rated boolean) returns public.time_controls
language plpgsql stable
set search_path = ''
as $$
declare t public.time_controls;
begin
  perform public.require_profile(v_uid);
  select * into t from public.time_controls where id = p_time_control;
  if not found or t.ai_only then
    raise exception 'Unknown time control.' using errcode = '22023';
  end if;
  if (select count(*) from public.challenges where from_id = v_uid and status = 'pending' and expires_at > now()) >= 10 then
    raise exception 'You have 10 open challenges. Wait for some replies first.' using errcode = '22023';
  end if;
  if (select count(*) from public.challenges where from_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'You''re sending challenges too quickly. Try again later.' using errcode = '22023';
  end if;
  return t;
end
$$;

create or replace function public.send_challenge(p_username text, p_time_control text, p_rated boolean,
                                                 p_russian_chat boolean default false, p_color text default 'random')
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  target uuid;
  v_id uuid;
begin
  perform public.check_new_challenge(v_uid, p_time_control, p_rated);
  select id into target from public.profiles where username = lower(btrim(coalesce(p_username, '')));
  if target is null or public.is_blocked(v_uid, target) then
    raise exception 'Player not found.' using errcode = '22023';
  end if;
  if target = v_uid then
    raise exception 'You can''t challenge yourself.' using errcode = '22023';
  end if;
  update public.challenges set status = 'expired'
  where status = 'pending' and expires_at <= now() and from_id in (v_uid, target) and to_id in (v_uid, target);
  if exists (select 1 from public.challenges where status = 'pending' and from_id in (v_uid, target) and to_id in (v_uid, target)) then
    raise exception 'There''s already an open challenge between you two.' using errcode = '22023';
  end if;
  insert into public.challenges (from_id, to_id, time_control, rated, russian_chat, color)
  values (v_uid, target, p_time_control, coalesce(p_rated, false), coalesce(p_russian_chat, false),
          case when p_color in ('white','black') then p_color else 'random' end)
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.create_invite(p_time_control text, p_rated boolean,
                                                p_russian_chat boolean default false, p_color text default 'random')
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
begin
  perform public.check_new_challenge(v_uid, p_time_control, p_rated);
  insert into public.challenges (from_id, to_id, invite_code, time_control, rated, russian_chat, color)
  values (v_uid, null, code, p_time_control, coalesce(p_rated, false), coalesce(p_russian_chat, false),
          case when p_color in ('white','black') then p_color else 'random' end);
  return code;
end
$$;

create or replace function public.invite_info(p_code text) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  c public.challenges;
begin
  select * into c from public.challenges where invite_code = upper(btrim(coalesce(p_code, '')));
  if not found or public.is_blocked(v_uid, c.from_id) then
    return null;
  end if;
  return jsonb_build_object(
    'id', c.id, 'time_control', c.time_control, 'rated', c.rated, 'russian_chat', c.russian_chat, 'color', c.color,
    'status', case when c.status = 'pending' and c.expires_at <= now() then 'expired' else c.status end,
    'game_id', case when v_uid in (c.from_id, c.to_id) then c.game_id end,
    'mine', c.from_id = v_uid,
    'from', public.mini_player(v_uid, c.from_id, (select pool from public.time_controls where id = c.time_control))
  );
end
$$;

create or replace function public.start_from_challenge(c public.challenges, accepter uuid) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  g uuid;
  white_is_from boolean := case c.color when 'white' then true when 'black' then false else random() < 0.5 end;
begin
  if public.is_blocked(c.from_id, accepter) then
    raise exception 'This player isn''t available.' using errcode = '22023';
  end if;
  if public.active_game_between(c.from_id, accepter) is not null then
    raise exception 'You already have a game in progress with them.' using errcode = '22023';
  end if;
  if white_is_from then
    g := public.create_game(c.from_id, accepter, c.time_control, c.rated, c.russian_chat, null, c.id);
  else
    g := public.create_game(accepter, c.from_id, c.time_control, c.rated, c.russian_chat, null, c.id);
  end if;
  update public.challenges set status = 'accepted', responded_at = now(), game_id = g, to_id = accepter where id = c.id;
  return g;
end
$$;

create or replace function public.accept_invite(p_code text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  c public.challenges;
begin
  perform public.require_profile(v_uid);
  select * into c from public.challenges where invite_code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then
    raise exception 'This invite link isn''t valid.' using errcode = '22023';
  end if;
  if c.from_id = v_uid then
    raise exception 'Share this link with a friend. You can''t accept your own invite.' using errcode = '22023';
  end if;
  if c.status <> 'pending' or c.expires_at <= now() then
    raise exception 'This invite has already been used or has expired.' using errcode = '22023';
  end if;
  return public.start_from_challenge(c, v_uid);
end
$$;

create or replace function public.respond_challenge(p_id uuid, p_accept boolean) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  c public.challenges;
begin
  select * into c from public.challenges where id = p_id for update;
  if not found or c.to_id is distinct from v_uid then
    raise exception 'Challenge not found.' using errcode = '22023';
  end if;
  if c.status <> 'pending' then
    raise exception 'This challenge is no longer open.' using errcode = '22023';
  end if;
  if c.expires_at <= now() then
    update public.challenges set status = 'expired' where id = c.id;
    raise exception 'This challenge has expired.' using errcode = '22023';
  end if;
  if not p_accept then
    update public.challenges set status = 'declined', responded_at = now() where id = c.id;
    return null;
  end if;
  return public.start_from_challenge(c, v_uid);
end
$$;

create or replace function public.cancel_challenge(p_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.challenges set status = 'cancelled', responded_at = now()
  where id = p_id and from_id = public.require_uid() and status = 'pending';
end
$$;

create or replace function public.inbox() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  return jsonb_build_object(
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'time_control', c.time_control, 'rated', c.rated,
               'russian_chat', c.russian_chat, 'color', c.color, 'created_at', c.created_at,
               'user', public.mini_player(v_uid, c.from_id, t.pool)) order by c.created_at desc)
      from public.challenges c join public.time_controls t on t.id = c.time_control
      where c.to_id = v_uid and c.status = 'pending' and c.expires_at > now()
        and not public.is_blocked(v_uid, c.from_id)), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'time_control', c.time_control, 'rated', c.rated,
               'russian_chat', c.russian_chat, 'color', c.color, 'created_at', c.created_at, 'invite_code', c.invite_code,
               'user', case when c.to_id is not null then public.mini_player(v_uid, c.to_id, t.pool) end)
             order by c.created_at desc)
      from public.challenges c join public.time_controls t on t.id = c.time_control
      where c.from_id = v_uid and c.status = 'pending' and c.expires_at > now()), '[]'::jsonb),
    'active', coalesce((
      select jsonb_agg(public.game_summary(v_uid, g) order by g.updated_at desc)
      from public.games g
      where g.status = 'active' and g.opponent_kind = 'human' and v_uid in (g.white_id, g.black_id)), '[]'::jsonb)
  );
end
$$;

-- ---------------------------------------------------------------------
-- Games
-- ---------------------------------------------------------------------
create or replace function public.game_players(p_game uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  g public.games;
begin
  select * into g from public.games where id = p_game;
  if not found or (g.white_id is distinct from v_uid and g.black_id is distinct from v_uid) then
    raise exception 'Game not found.' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'white', case when g.white_id is not null then public.mini_player(v_uid, g.white_id, g.pool) end,
    'black', case when g.black_id is not null then public.mini_player(v_uid, g.black_id, g.pool) end
  );
end
$$;

create or replace function public.rematch(p_game uuid, p_action text) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  g public.games;
  other uuid;
  ng uuid;
begin
  select * into g from public.games where id = p_game for update;
  if not found or (g.white_id is distinct from v_uid and g.black_id is distinct from v_uid) or g.opponent_kind <> 'human' then
    raise exception 'Game not found.' using errcode = '22023';
  end if;
  if g.status = 'active' then
    raise exception 'The game is still in progress.' using errcode = '22023';
  end if;
  if g.next_game_id is not null then
    return jsonb_build_object('status', 'started', 'game_id', g.next_game_id);
  end if;
  other := case when g.white_id = v_uid then g.black_id else g.white_id end;
  if other is null or public.is_blocked(v_uid, other) then
    raise exception 'This player isn''t available.' using errcode = '22023';
  end if;
  if p_action = 'offer' and g.rematch_offer_from = other then
    p_action := 'accept';
  end if;
  if p_action = 'offer' then
    if public.active_game_between(v_uid, other) is not null then
      raise exception 'You already have a game in progress with them.' using errcode = '22023';
    end if;
    update public.games set rematch_offer_from = v_uid, version = version + 1, updated_at = now() where id = g.id;
    return jsonb_build_object('status', 'offered');
  elsif p_action = 'accept' then
    if g.rematch_offer_from is distinct from other then
      raise exception 'There''s no rematch offer to accept.' using errcode = '22023';
    end if;
    if public.active_game_between(v_uid, other) is not null then
      raise exception 'You already have a game in progress with them.' using errcode = '22023';
    end if;
    ng := public.create_game(g.black_id, g.white_id, g.time_control, g.rated, g.russian_chat, g.id, null);
    update public.games set next_game_id = ng, rematch_offer_from = null, version = version + 1, updated_at = now()
    where id = g.id;
    return jsonb_build_object('status', 'started', 'game_id', ng);
  elsif p_action in ('decline', 'cancel') then
    update public.games set rematch_offer_from = null, version = version + 1, updated_at = now()
    where id = g.id and rematch_offer_from is not null
      and ((p_action = 'decline' and rematch_offer_from = other) or (p_action = 'cancel' and rematch_offer_from = v_uid));
    return jsonb_build_object('status', p_action || 'd');
  end if;
  raise exception 'Unknown action.' using errcode = '22023';
end
$$;

create or replace function public.send_game_message(p_game uuid, p_body text) returns bigint
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  g public.games;
  other uuid;
  body text := btrim(coalesce(p_body, ''));
  v_id bigint;
begin
  select * into g from public.games where id = p_game;
  if not found or (g.white_id is distinct from v_uid and g.black_id is distinct from v_uid) or g.opponent_kind <> 'human' then
    raise exception 'Game not found.' using errcode = '22023';
  end if;
  other := case when g.white_id = v_uid then g.black_id else g.white_id end;
  if other is null or public.is_blocked(v_uid, other) then
    raise exception 'Chat isn''t available in this game.' using errcode = '22023';
  end if;
  if g.status <> 'active' and coalesce(g.finished_at, g.updated_at) < now() - interval '30 minutes' then
    raise exception 'Chat closes 30 minutes after the game ends.' using errcode = '22023';
  end if;
  if body = '' or char_length(body) > 300 then
    raise exception 'Messages can be up to 300 characters.' using errcode = '22023';
  end if;
  if (select count(*) from public.game_messages where game_id = g.id and user_id = v_uid
      and created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'You''re sending messages too quickly.' using errcode = '22023';
  end if;
  -- Russian-only chat: Latin letters are allowed only inside chess notation (e4, Nf3, O-O)
  if g.russian_chat and regexp_replace(body, '([KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?[+#]?|O-O-O|O-O)', '', 'g') ~ '[A-Za-z]' then
    raise exception 'This game uses Russian-only chat. Please write in Cyrillic.' using errcode = '22023';
  end if;
  insert into public.game_messages (game_id, user_id, body) values (g.id, v_uid, body) returning id into v_id;
  return v_id;
end
$$;

create or replace function public.my_games(p_filter text default 'all', p_limit int default 30, p_offset int default 0)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  p_limit := least(greatest(coalesce(p_limit, 30), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  return jsonb_build_object(
    'total', (select count(*) from public.games g where g.status in ('finished','aborted') and v_uid in (g.white_id, g.black_id)
                and (p_filter = 'all' or (p_filter = 'rated' and g.rated) or (p_filter = 'casual' and not g.rated and g.opponent_kind = 'human')
                     or (p_filter = 'ai' and g.opponent_kind = 'ai'))),
    'games', coalesce((select jsonb_agg(public.game_summary(v_uid, g) order by coalesce(g.finished_at, g.updated_at) desc)
      from (select * from public.games g2 where g2.status in ('finished','aborted') and v_uid in (g2.white_id, g2.black_id)
              and (p_filter = 'all' or (p_filter = 'rated' and g2.rated) or (p_filter = 'casual' and not g2.rated and g2.opponent_kind = 'human')
                   or (p_filter = 'ai' and g2.opponent_kind = 'ai'))
            order by coalesce(g2.finished_at, g2.updated_at) desc
            limit p_limit offset p_offset) g), '[]'::jsonb)
  );
end
$$;

create or replace function public.chess_stats() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  n int := public.placement_games();
  adv boolean := coalesce((public.entitlements(v_uid) ->> 'advanced_stats')::boolean, false);
begin
  return jsonb_build_object(
    'advanced', adv,
    'pools', coalesce((select jsonb_agg(jsonb_build_object(
        'pool', r.pool, 'rating', case when r.games >= n then r.rating end, 'status', public.rating_status(r.games),
        'games', r.games, 'wins', r.wins, 'losses', r.losses, 'draws', r.draws, 'peak', r.peak,
        'placement_left', greatest(0, n - r.games),
        'history', coalesce((select jsonb_agg(jsonb_build_object('t', h.created_at, 'r', h.rating_after, 'status', h.status_after,
                                 'opp', h.opponent_rating, 's', h.score, 'game_id', h.game_id) order by h.id)
                            from (select * from public.rating_history x where x.user_id = v_uid and x.pool = r.pool
                                  order by x.id desc limit 200) h), '[]'::jsonb))
        order by r.games desc)
      from public.ratings r where r.user_id = v_uid), '[]'::jsonb),
    'totals', (select jsonb_build_object(
        'games', count(*),
        'wins', count(*) filter (where (g.result = '1-0' and g.white_id = v_uid) or (g.result = '0-1' and g.black_id = v_uid)),
        'losses', count(*) filter (where (g.result = '0-1' and g.white_id = v_uid) or (g.result = '1-0' and g.black_id = v_uid)),
        'draws', count(*) filter (where g.result = '1/2-1/2'),
        'rated', count(*) filter (where g.rated),
        'vs_ai', count(*) filter (where g.opponent_kind = 'ai'),
        'vs_ai_wins', count(*) filter (where g.opponent_kind = 'ai' and ((g.result = '1-0' and g.white_id = v_uid) or (g.result = '0-1' and g.black_id = v_uid))),
        'as_white', count(*) filter (where g.white_id = v_uid),
        'as_white_wins', count(*) filter (where g.white_id = v_uid and g.result = '1-0'),
        'as_black', count(*) filter (where g.black_id = v_uid),
        'as_black_wins', count(*) filter (where g.black_id = v_uid and g.result = '0-1'))
      from public.games g where g.status = 'finished' and v_uid in (g.white_id, g.black_id)),
    'terminations', case when adv then coalesce((select jsonb_object_agg(x.termination, x.n) from (
        select g.termination, count(*) as n from public.games g
        where g.status = 'finished' and v_uid in (g.white_id, g.black_id) group by g.termination) x), '{}'::jsonb) end,
    'by_opponent', case when adv then coalesce((select jsonb_agg(jsonb_build_object('band', x.band, 'games', x.n, 'score', x.s) order by x.band)
      from (select (h.opponent_rating / 200) * 200 as band, count(*) as n, round(avg(h.score) * 100) as s
            from public.rating_history h where h.user_id = v_uid group by 1) x), '[]'::jsonb) end
  );
end
$$;

create or replace function public.leaderboard(p_pool text, p_limit int default 50) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  n int := public.placement_games();
  mine public.ratings;
begin
  if p_pool not in ('bullet','blitz','rapid','daily') then
    raise exception 'Unknown pool.' using errcode = '22023';
  end if;
  p_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  select * into mine from public.ratings where user_id = v_uid and pool = p_pool;
  return jsonb_build_object(
    'pool', p_pool,
    'rows', coalesce((select jsonb_agg(x.j order by x.rk) from (
        select rank() over (order by r.rating desc) as rk,
               jsonb_build_object('rank', rank() over (order by r.rating desc), 'id', p.id, 'username', p.username,
                 'display_name', p.display_name, 'ru_level', p.ru_level, 'rating', r.rating, 'peak', r.peak,
                 'games', r.games, 'status', public.rating_status(r.games),
                 'online', p.show_online and p.last_seen > now() - interval '3 minutes', 'me', p.id = v_uid) as j
        from public.ratings r join public.profiles p on p.id = r.user_id
        where r.pool = p_pool and r.games >= n
        order by r.rating desc
        limit p_limit) x), '[]'::jsonb),
    'players', (select count(*) from public.ratings r where r.pool = p_pool and r.games >= n),
    'me', case when mine.user_id is null then null else jsonb_build_object(
        'rating', case when mine.games >= n then mine.rating end,
        'status', public.rating_status(mine.games),
        'placement_left', greatest(0, n - mine.games),
        'rank', case when mine.games >= n then
          (select count(*) + 1 from public.ratings r where r.pool = p_pool and r.games >= n and r.rating > mine.rating) end) end
  );
end
$$;

create or replace function public.public_profile(p_username text) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  p public.profiles;
  n int := public.placement_games();
begin
  select * into p from public.profiles where username = lower(btrim(coalesce(p_username, '')));
  if not found or (p.id <> v_uid and public.is_blocked(v_uid, p.id)) then
    return null;
  end if;
  return jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name, 'ru_level', p.ru_level,
    'joined', p.created_at, 'is_me', p.id = v_uid,
    'online', p.show_online and p.last_seen > now() - interval '3 minutes',
    'certified', coalesce((select jsonb_agg(distinct t.level) from public.test_attempts a join public.tests t on t.id = a.test_id
                           where a.user_id = p.id and a.passed and t.level is not null), '[]'::jsonb),
    'ratings', coalesce((select jsonb_agg(jsonb_build_object('pool', r.pool,
                 'rating', case when r.games >= n then r.rating end, 'status', public.rating_status(r.games),
                 'games', r.games, 'wins', r.wins, 'losses', r.losses, 'draws', r.draws, 'peak', r.peak,
                 'placement_left', greatest(0, n - r.games)) order by r.games desc)
               from public.ratings r where r.user_id = p.id), '[]'::jsonb),
    'stats', (select jsonb_build_object('games', count(*),
                'wins', count(*) filter (where (g.result = '1-0' and g.white_id = p.id) or (g.result = '0-1' and g.black_id = p.id)),
                'losses', count(*) filter (where (g.result = '0-1' and g.white_id = p.id) or (g.result = '1-0' and g.black_id = p.id)),
                'draws', count(*) filter (where g.result = '1/2-1/2'))
              from public.games g where g.status = 'finished' and g.opponent_kind = 'human' and p.id in (g.white_id, g.black_id)),
    'achievements', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'tier', a.tier,
                       'category', a.category, 'description', a.description, 'earned_at', ua.earned_at) order by a.sort)
                     from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
                     where ua.user_id = p.id), '[]'::jsonb),
    'lessons_completed', (select count(*) from public.lesson_progress lp where lp.user_id = p.id and lp.completed_at is not null),
    'active_game', case when p.id <> v_uid then public.active_game_between(v_uid, p.id) end
  );
end
$$;

-- ---------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------
create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  if p_user = v_uid then
    raise exception 'You can''t block yourself.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'Player not found.' using errcode = '22023';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user) on conflict do nothing;
  update public.challenges set status = 'cancelled', responded_at = now()
  where status = 'pending' and ((from_id = v_uid and to_id = p_user) or (from_id = p_user and to_id = v_uid));
  update public.games
  set status = 'aborted', termination = 'abort', finished_at = now(), draw_offer_from = null,
      rematch_offer_from = null, version = version + 1, updated_at = now()
  where status = 'active' and ((white_id = v_uid and black_id = p_user) or (white_id = p_user and black_id = v_uid));
  update public.games set rematch_offer_from = null, version = version + 1, updated_at = now()
  where rematch_offer_from is not null and status <> 'active'
    and ((white_id = v_uid and black_id = p_user) or (white_id = p_user and black_id = v_uid));
end
$$;

create or replace function public.unblock_user(p_user uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from public.blocks where blocker_id = public.require_uid() and blocked_id = p_user;
end
$$;

create or replace function public.blocked_users() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.blocked_id, 'username', p.username,
                     'display_name', coalesce(p.display_name, 'Former member'), 'created_at', b.created_at)
                   order by b.created_at desc)
    from public.blocks b left join public.profiles p on p.id = b.blocked_id
    where b.blocker_id = v_uid), '[]'::jsonb);
end
$$;

create or replace function public.report_user(p_user uuid, p_reason text, p_details text default '',
                                              p_game uuid default null, p_block boolean default false)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  if p_user = v_uid then
    raise exception 'You can''t report yourself.' using errcode = '22023';
  end if;
  if p_reason not in ('cheating','harassment','inappropriate','spam','other') then
    raise exception 'Choose a reason.' using errcode = '22023';
  end if;
  if (select count(*) from public.reports where reporter_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You''ve sent a lot of reports today. Our team will review them.' using errcode = '22023';
  end if;
  insert into public.reports (reporter_id, reported_id, game_id, reason, details)
  values (v_uid, p_user, case when exists (select 1 from public.games where id = p_game) then p_game end,
          p_reason, left(coalesce(p_details, ''), 1000));
  if p_block then
    perform public.block_user(p_user);
  end if;
end
$$;

create or replace function public.delete_account() returns void
language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := public.require_uid();
begin
  update public.games
  set status = 'aborted', termination = 'abort', finished_at = now(), draw_offer_from = null,
      rematch_offer_from = null, version = version + 1, updated_at = now()
  where status = 'active' and v_uid in (white_id, black_id);
  delete from auth.users where id = v_uid;   -- cascades to the profile and all learning data
end
$$;

-- ---------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------
revoke execute on function
  public.config_int(text, int), public.placement_games(), public.is_blocked(uuid, uuid), public.entitlements(uuid),
  public.level_allowed(uuid, text), public.require_profile(uuid), public.touch_streak(uuid),
  public.log_activity(uuid, text, boolean, text), public.rating_status(int), public.check_achievements(uuid),
  public.mini_player(uuid, uuid, text), public.game_summary(uuid, public.games),
  public.create_game(uuid, uuid, text, boolean, boolean, uuid, uuid), public.active_game_between(uuid, uuid),
  public.elo_next(int, int, bigint, numeric, int, numeric, int), public.apply_game_ratings(uuid), public.finalize_game(uuid),
  public.record_scored_attempt(uuid, text, text, text, numeric, numeric, numeric, numeric, numeric, jsonb, int),
  public.tutor_log(uuid, uuid, text, text, text, jsonb),
  public.check_new_challenge(uuid, text, boolean), public.start_from_challenge(public.challenges, uuid)
from public, anon, authenticated;

grant execute on function
  public.apply_game_ratings(uuid), public.finalize_game(uuid),
  public.record_scored_attempt(uuid, text, text, text, numeric, numeric, numeric, numeric, numeric, jsonb, int),
  public.tutor_log(uuid, uuid, text, text, text, jsonb), public.entitlements(uuid)
to service_role;

do $$
declare
  fns text[] := array[
    'heartbeat()', 'server_now()', 'username_available(text)', 'set_ru_level(text)', 'my_plan()', 'dashboard()',
    'curriculum()', 'get_lesson(text)', 'complete_lesson(text, int)', 'get_test(text)', 'submit_test(text, jsonb)',
    'review_queue(int)', 'record_review(text, text, int)', 'add_words(text[])', 'save_phrase(text, text, text)',
    'delete_phrase(bigint)', 'my_vocabulary()', 'focus_words()', 'record_practice(text, boolean, text)',
    'record_speech_attempt(text, text, text, jsonb, boolean, int)', 'pronunciation_overview()',
    'scenarios()', 'get_scenario(text)', 'start_conversation(text, text, text)',
    'log_conversation_turn(uuid, text, text, text, jsonb)', 'conversations()',
    'find_match(text, boolean, boolean)', 'cancel_seek()', 'search_players(text)',
    'send_challenge(text, text, boolean, boolean, text)', 'create_invite(text, boolean, boolean, text)',
    'invite_info(text)', 'accept_invite(text)', 'respond_challenge(uuid, boolean)', 'cancel_challenge(uuid)',
    'inbox()', 'game_players(uuid)', 'rematch(uuid, text)', 'send_game_message(uuid, text)',
    'my_games(text, int, int)', 'chess_stats()', 'leaderboard(text, int)', 'public_profile(text)',
    'block_user(uuid)', 'unblock_user(uuid)', 'blocked_users()',
    'report_user(uuid, text, text, uuid, boolean)', 'delete_account()'];
  f text;
begin
  foreach f in array fns loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
