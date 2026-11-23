-- =====================================================================
-- Chessmate — server functions
-- Every public function re-checks the caller with require_uid() and only
-- returns safe, derived fields about other people (age, rounded distance,
-- compatibility). Birthdates and coordinates never leave the database.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------
create or replace function public.require_uid() returns uuid
language plpgsql stable
set search_path = ''
as $$
declare v uuid := public.app_uid();
begin
  if v is null then
    raise exception 'Please sign in.' using errcode = '28000';
  end if;
  return v;
end
$$;

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

create or replace function public.option_index(options jsonb, v text) returns int
language sql immutable
set search_path = ''
as $$
  select (o.ord - 1)::int
  from jsonb_array_elements(options) with ordinality as o(val, ord)
  where o.val ->> 'v' = v
  limit 1
$$;

create or replace function public.active_game_between(a uuid, b uuid) returns uuid
language sql stable
set search_path = ''
as $$
  select id from public.games
  where status = 'active'
    and ((white_id = a and black_id = b) or (white_id = b and black_id = a))
  limit 1
$$;

-- Compatibility (0–99). Chess skill / Elo is deliberately NOT an input.
--   personality 40% · shared interests 20% · dating intentions 20%
--   communication style 10% · chess playing style 10%
create or replace function public.compat_score(a uuid, b uuid) returns int
language plpgsql stable
set search_path = ''
as $$
declare
  pa public.profiles;
  pb public.profiles;
  r record;
  sim numeric;
  n int; i int; j int;
  inter int; minlen int;
  s_pers numeric := 0;  w_pers numeric := 0;
  s_comm numeric := 0;  w_comm numeric := 0;
  s_chess numeric := 0; w_chess numeric := 0;
  total numeric := 0;   total_w numeric := 0;
  intent numeric;
begin
  select * into pa from public.profiles where id = a;
  select * into pb from public.profiles where id = b;
  if pa.id is null or pb.id is null then
    return null;
  end if;

  for r in
    select q.kind, q.ordinal, q.dimension, q.weight, q.options, x.answer as aa, y.answer as ab
    from public.questions q
    join public.answers x on x.question_id = q.id and x.user_id = a
    join public.answers y on y.question_id = q.id and y.user_id = b
  loop
    if r.kind = 'multi' then
      select count(*) into inter from unnest(r.aa) as t(v) where t.v = any(r.ab);
      minlen := least(cardinality(r.aa), cardinality(r.ab));
      sim := case when minlen = 0 then 0 else least(1, inter::numeric / minlen) end;
    elsif r.ordinal then
      n := jsonb_array_length(r.options);
      i := public.option_index(r.options, r.aa[1]);
      j := public.option_index(r.options, r.ab[1]);
      sim := 1 - abs(i - j)::numeric / greatest(n - 1, 1);
    else
      sim := case
        when r.aa[1] = r.ab[1] then 1
        when r.dimension = 'chess_style' then 0.5
        else 0.25
      end;
    end if;

    if r.dimension = 'personality' then
      s_pers := s_pers + sim * r.weight;  w_pers := w_pers + r.weight;
    elsif r.dimension = 'communication' then
      s_comm := s_comm + sim * r.weight;  w_comm := w_comm + r.weight;
    else
      s_chess := s_chess + sim * r.weight; w_chess := w_chess + r.weight;
    end if;
  end loop;

  if w_pers  > 0 then total := total + 0.40 * s_pers  / w_pers;  total_w := total_w + 0.40; end if;
  if w_comm  > 0 then total := total + 0.10 * s_comm  / w_comm;  total_w := total_w + 0.10; end if;
  if w_chess > 0 then total := total + 0.10 * s_chess / w_chess; total_w := total_w + 0.10; end if;

  if cardinality(pa.interests) > 0 and cardinality(pb.interests) > 0 then
    select count(*) into inter from unnest(pa.interests) as t(v) where t.v = any(pb.interests);
    minlen := least(cardinality(pa.interests), cardinality(pb.interests));
    total := total + 0.20 * least(1, inter::numeric * 1.6 / minlen);
    total_w := total_w + 0.20;
  end if;

  if pa.intentions is not null and pb.intentions is not null then
    intent := case
      when pa.intentions = pb.intentions then 1
      when 'unsure' in (pa.intentions, pb.intentions) then 0.6
      when array[pa.intentions, pb.intentions] <@ array['casual','friendship'] then 0.4
      when array[pa.intentions, pb.intentions] <@ array['serious','friendship'] then 0.3
      else 0.15
    end;
    total := total + 0.20 * intent;
    total_w := total_w + 0.20;
  end if;

  if total_w = 0 then
    return 50;
  end if;
  return greatest(1, least(99, round(100 * total / total_w)))::int;
end
$$;

create or replace function public.profile_card(viewer uuid, p public.profiles, me public.profiles) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'first_name', p.first_name,
    'age', public.age_years(p.birthdate),
    'city', p.city,
    'distance_km', case
        when viewer <> p.id and p.show_distance and me.lat is not null and p.lat is not null
        then greatest(1, round(public.distance_km(me.lat, me.lng, p.lat, p.lng)))::int
      end,
    'photos', to_jsonb(p.photos),
    'bio', p.bio,
    'intentions', p.intentions,
    'elo', p.elo,
    'experience', p.experience,
    'formats', to_jsonb(p.formats),
    'interests', to_jsonb(p.interests),
    'rating', p.app_rating,
    'rated_games', p.rated_games,
    'online', p.show_online and p.last_seen > now() - interval '3 minutes',
    'play_style', (select a.answer[1] from public.answers a where a.user_id = p.id and a.question_id = 'c_style'),
    'opening', (select a.answer[1] from public.answers a where a.user_id = p.id and a.question_id = 'c_opening'),
    'compat', case when viewer <> p.id then public.compat_score(viewer, p.id) end,
    'shared_interests', case when viewer <> p.id
        then (select coalesce(jsonb_agg(t.x), '[]'::jsonb) from unnest(p.interests) as t(x) where t.x = any(me.interests))
        else '[]'::jsonb end
  )
$$;

create or replace function public.mini_card(viewer uuid, target uuid) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'first_name', p.first_name,
    'age', public.age_years(p.birthdate),
    'photo', p.photos[1],
    'elo', p.elo,
    'rating', p.app_rating,
    'experience', p.experience,
    'online', p.show_online and p.last_seen > now() - interval '3 minutes'
  )
  from public.profiles p
  where p.id = target
$$;

create or replace function public.user_stats(u uuid) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'games',  count(*),
    'wins',   count(*) filter (where (g.result = '1-0' and g.white_id = u) or (g.result = '0-1' and g.black_id = u)),
    'losses', count(*) filter (where (g.result = '0-1' and g.white_id = u) or (g.result = '1-0' and g.black_id = u)),
    'draws',  count(*) filter (where g.result = '1/2-1/2')
  )
  from public.games g
  where g.status = 'finished' and u in (g.white_id, g.black_id)
$$;

create or replace function public.relationship(viewer uuid, target uuid) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'matched', exists (select 1 from public.matches m
                       where m.user_a = least(viewer, target) and m.user_b = greatest(viewer, target)),
    'incoming_challenge', (select c.id from public.challenges c
                           where c.from_id = target and c.to_id = viewer and c.status = 'pending'
                             and c.created_at > now() - interval '24 hours' limit 1),
    'outgoing_challenge', (select c.id from public.challenges c
                           where c.from_id = viewer and c.to_id = target and c.status = 'pending'
                             and c.created_at > now() - interval '24 hours' limit 1),
    'active_game', public.active_game_between(viewer, target),
    'games_played', (select count(*) from public.games g
                     where g.status = 'finished'
                       and ((g.white_id = viewer and g.black_id = target) or (g.white_id = target and g.black_id = viewer))),
    'my_like', (select l.liked from public.likes l where l.from_id = viewer and l.to_id = target)
  )
$$;

create or replace function public.game_summary(viewer uuid, g public.games) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'time_control', g.time_control,
    'mode', g.mode,
    'status', g.status,
    'result', g.result,
    'termination', g.termination,
    'my_color', case when g.white_id = viewer then 'white' else 'black' end,
    'turn', split_part(g.fen, ' ', 2),
    'white_ms', g.white_ms,
    'black_ms', g.black_ms,
    'turn_started_at', g.turn_started_at,
    'ply', cardinality(g.moves),
    'updated_at', g.updated_at,
    'finished_at', g.finished_at,
    'my_delta', case when g.white_id = viewer then g.white_delta else g.black_delta end,
    'opponent', public.mini_card(viewer, case when g.white_id = viewer then g.black_id else g.white_id end)
  )
$$;

create or replace function public.create_game(w uuid, b uuid, tc text, md text, prev uuid, chal uuid) returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_ms bigint := public.tc_initial_ms(tc);
  g uuid;
begin
  insert into public.games (white_id, black_id, time_control, mode, initial_ms, per_move,
                            white_ms, black_ms, white_rating, black_rating, rematch_of, challenge_id)
  values (w, b, tc, md, v_ms, tc = 'correspondence', v_ms, v_ms,
          (select app_rating from public.profiles where id = w),
          (select app_rating from public.profiles where id = b),
          prev, chal)
  returning id into g;
  return g;
end
$$;

-- ---------------------------------------------------------------------
-- Presence & time
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

-- ---------------------------------------------------------------------
-- Discovery
-- filters: max_distance_km, age_min, age_max, elo_min, elo_max,
--          experience[], intentions[], min_compat, sort ('compat'|'elo'|'active')
-- ---------------------------------------------------------------------
create or replace function public.discover(filters jsonb default '{}'::jsonb, p_limit int default 20, p_offset int default 0)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  me public.profiles;
  f_dist int;
  f_age_min int;
  f_age_max int;
  f_elo_min int;
  f_elo_max int;
  f_min_compat int;
  f_exp text[];
  f_int text[];
  f_sort text;
  my_r int;
begin
  select * into me from public.profiles where id = v_uid;
  if not found or not me.onboarding_complete then
    raise exception 'Finish setting up your profile first.' using errcode = '22023';
  end if;

  filters := coalesce(filters, '{}'::jsonb);
  f_dist := coalesce((filters ->> 'max_distance_km')::int, me.max_distance_km);
  f_age_min := greatest(coalesce((filters ->> 'age_min')::int, me.age_min), 18);
  f_age_max := coalesce((filters ->> 'age_max')::int, me.age_max);
  f_elo_min := (filters ->> 'elo_min')::int;
  f_elo_max := (filters ->> 'elo_max')::int;
  f_min_compat := coalesce((filters ->> 'min_compat')::int, 0);
  if jsonb_typeof(filters -> 'experience') = 'array' and jsonb_array_length(filters -> 'experience') > 0 then
    f_exp := array(select jsonb_array_elements_text(filters -> 'experience'));
  end if;
  if jsonb_typeof(filters -> 'intentions') = 'array' and jsonb_array_length(filters -> 'intentions') > 0 then
    f_int := array(select jsonb_array_elements_text(filters -> 'intentions'));
  end if;
  f_sort := coalesce(filters ->> 'sort', 'compat');
  p_limit := least(greatest(coalesce(p_limit, 20), 1), 50);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  my_r := coalesce(me.elo, me.app_rating);

  return coalesce((
    with cands as (
      select p.id, p.last_seen, coalesce(p.elo, p.app_rating) as r
      from public.profiles p
      where p.id <> v_uid
        and p.onboarding_complete
        and p.discoverable
        and p.gender = any(me.interested_in)
        and me.gender = any(p.interested_in)
        and public.age_years(p.birthdate) between f_age_min and f_age_max
        and public.age_years(me.birthdate) between p.age_min and p.age_max
        and not public.is_blocked(v_uid, p.id)
        and (me.lat is null or p.lat is null
             or public.distance_km(me.lat, me.lng, p.lat, p.lng) <= f_dist)
        and (f_elo_min is null or coalesce(p.elo, p.app_rating) >= f_elo_min)
        and (f_elo_max is null or coalesce(p.elo, p.app_rating) <= f_elo_max)
        and (f_exp is null or p.experience = any(f_exp))
        and (f_int is null or p.intentions = any(f_int))
    ),
    scored as (
      select c.*, public.compat_score(v_uid, c.id) as compat from cands c
    ),
    page as (
      select s.id,
             row_number() over (order by
               case when f_sort = 'elo' then abs(s.r - my_r) end asc nulls last,
               case when f_sort = 'active' then s.last_seen end desc nulls last,
               s.compat desc nulls last,
               s.id) as rn
      from scored s
      where coalesce(s.compat, 0) >= f_min_compat
      order by rn
      limit p_limit offset p_offset
    )
    select jsonb_agg(public.profile_card(v_uid, p, me) order by pg.rn)
    from page pg
    join public.profiles p on p.id = pg.id
  ), '[]'::jsonb);
end
$$;

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------
create or replace function public.get_profile(p_user uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  me public.profiles;
  p public.profiles;
  rel jsonb;
  ans jsonb;
  shared jsonb := '[]'::jsonb;
begin
  select * into me from public.profiles where id = v_uid;
  select * into p from public.profiles where id = p_user;
  if p.id is null then
    return null;
  end if;

  if p.id <> v_uid then
    if not p.onboarding_complete or public.is_blocked(v_uid, p.id) then
      return null;
    end if;
    rel := public.relationship(v_uid, p.id);
    if not p.discoverable and not (
         (rel ->> 'matched')::boolean
      or (rel ->> 'games_played')::int > 0
      or rel ->> 'active_game' is not null
      or rel ->> 'incoming_challenge' is not null
      or rel ->> 'outgoing_challenge' is not null) then
      return null;
    end if;
    select coalesce(jsonb_agg(x.question_id), '[]'::jsonb) into shared
    from public.answers x
    join public.answers y on y.question_id = x.question_id and y.user_id = v_uid
    where x.user_id = p.id and x.answer && y.answer;
  end if;

  select coalesce(jsonb_object_agg(a.question_id, to_jsonb(a.answer)), '{}'::jsonb) into ans
  from public.answers a where a.user_id = p.id;

  return public.profile_card(v_uid, p, me) || jsonb_build_object(
    'answers', ans,
    'shared_answers', shared,
    'stats', public.user_stats(p.id),
    'relationship', rel,
    'is_me', p.id = v_uid
  );
end
$$;

-- ---------------------------------------------------------------------
-- Challenges
-- ---------------------------------------------------------------------
create or replace function public.send_challenge(p_to uuid, p_time_control text, p_mode text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  me public.profiles;
  p public.profiles;
  v_id uuid;
begin
  if p_time_control not in ('blitz3','blitz5','rapid10','rapid15','correspondence') then
    raise exception 'Unknown time control.' using errcode = '22023';
  end if;
  if p_mode not in ('casual','competitive') then
    raise exception 'Unknown game mode.' using errcode = '22023';
  end if;

  select * into me from public.profiles where id = v_uid;
  if not found or not me.onboarding_complete then
    raise exception 'Finish setting up your profile first.' using errcode = '22023';
  end if;
  if p_to = v_uid then
    raise exception 'You can''t challenge yourself.' using errcode = '22023';
  end if;

  select * into p from public.profiles where id = p_to;
  if not found or not p.onboarding_complete or public.is_blocked(v_uid, p_to) then
    raise exception 'This player isn''t available.' using errcode = '22023';
  end if;
  -- unless already matched, both people's dating preferences must fit each other
  if not exists (select 1 from public.matches m where m.user_a = least(v_uid, p_to) and m.user_b = greatest(v_uid, p_to)) then
    if not p.discoverable
       or not (p.gender = any(me.interested_in) and me.gender = any(p.interested_in))
       or public.age_years(p.birthdate) not between me.age_min and me.age_max
       or public.age_years(me.birthdate) not between p.age_min and p.age_max then
      raise exception 'This player isn''t available.' using errcode = '22023';
    end if;
  end if;

  update public.challenges set status = 'expired'
  where status = 'pending' and created_at < now() - interval '24 hours'
    and least(from_id, to_id) = least(v_uid, p_to) and greatest(from_id, to_id) = greatest(v_uid, p_to);

  if exists (select 1 from public.challenges
             where status = 'pending'
               and least(from_id, to_id) = least(v_uid, p_to) and greatest(from_id, to_id) = greatest(v_uid, p_to)) then
    raise exception 'There''s already an open challenge between you two.' using errcode = '22023';
  end if;
  if public.active_game_between(v_uid, p_to) is not null then
    raise exception 'You already have a game in progress with them.' using errcode = '22023';
  end if;
  if (select count(*) from public.challenges
      where from_id = v_uid and status = 'pending' and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'You have 10 open challenges. Wait for some replies first.' using errcode = '22023';
  end if;
  if (select count(*) from public.challenges
      where from_id = v_uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'You''re sending challenges too quickly. Try again later.' using errcode = '22023';
  end if;

  insert into public.challenges (from_id, to_id, time_control, mode)
  values (v_uid, p_to, p_time_control, p_mode)
  returning id into v_id;
  return v_id;
end
$$;

create or replace function public.respond_challenge(p_id uuid, p_accept boolean) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  c public.challenges;
  g uuid;
begin
  select * into c from public.challenges where id = p_id for update;
  if not found or c.to_id <> v_uid then
    raise exception 'Challenge not found.' using errcode = '22023';
  end if;
  if c.status <> 'pending' then
    raise exception 'This challenge is no longer open.' using errcode = '22023';
  end if;
  if c.created_at < now() - interval '24 hours' then
    raise exception 'This challenge has expired.' using errcode = '22023';
  end if;

  if not p_accept then
    update public.challenges set status = 'declined', responded_at = now() where id = c.id;
    return null;
  end if;

  if public.is_blocked(c.from_id, c.to_id) then
    raise exception 'This player isn''t available.' using errcode = '22023';
  end if;
  if public.active_game_between(c.from_id, c.to_id) is not null then
    raise exception 'You already have a game in progress with them.' using errcode = '22023';
  end if;

  if random() < 0.5 then
    g := public.create_game(c.from_id, c.to_id, c.time_control, c.mode, null, c.id);
  else
    g := public.create_game(c.to_id, c.from_id, c.time_control, c.mode, null, c.id);
  end if;

  update public.challenges set status = 'accepted', responded_at = now(), game_id = g where id = c.id;
  return g;
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

-- ---------------------------------------------------------------------
-- Games inbox
-- ---------------------------------------------------------------------
create or replace function public.inbox() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  return jsonb_build_object(
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'time_control', c.time_control, 'mode', c.mode, 'created_at', c.created_at,
               'user', public.mini_card(v_uid, c.from_id),
               'compat', public.compat_score(v_uid, c.from_id))
             order by c.created_at desc)
      from public.challenges c
      where c.to_id = v_uid and c.status = 'pending'
        and c.created_at > now() - interval '24 hours'
        and not public.is_blocked(v_uid, c.from_id)), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'time_control', c.time_control, 'mode', c.mode, 'created_at', c.created_at,
               'user', public.mini_card(v_uid, c.to_id))
             order by c.created_at desc)
      from public.challenges c
      where c.from_id = v_uid and c.status = 'pending'
        and c.created_at > now() - interval '24 hours'), '[]'::jsonb),
    'active', coalesce((
      select jsonb_agg(public.game_summary(v_uid, g) order by g.updated_at desc)
      from public.games g
      where g.status = 'active' and v_uid in (g.white_id, g.black_id)), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(public.game_summary(v_uid, g) order by coalesce(g.finished_at, g.updated_at) desc)
      from public.games g
      where g.id in (
        select g2.id from public.games g2
        where g2.status in ('finished','aborted') and v_uid in (g2.white_id, g2.black_id)
        order by coalesce(g2.finished_at, g2.updated_at) desc
        limit 20)), '[]'::jsonb)
  );
end
$$;

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
    'white', public.mini_card(v_uid, g.white_id),
    'black', public.mini_card(v_uid, g.black_id)
  );
end
$$;

-- ---------------------------------------------------------------------
-- After the game: likes, matches, rematches
-- ---------------------------------------------------------------------
create or replace function public.like_game(p_game uuid, p_liked boolean) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  g public.games;
  other uuid;
begin
  select * into g from public.games where id = p_game;
  if not found or (g.white_id is distinct from v_uid and g.black_id is distinct from v_uid) then
    raise exception 'Game not found.' using errcode = '22023';
  end if;
  if g.status <> 'finished' then
    raise exception 'You can decide once the game is over.' using errcode = '22023';
  end if;
  other := case when g.white_id = v_uid then g.black_id else g.white_id end;
  if other is null or not exists (select 1 from public.profiles where id = other)
     or public.is_blocked(v_uid, other) then
    raise exception 'This player isn''t available.' using errcode = '22023';
  end if;

  insert into public.likes (from_id, to_id, game_id, liked)
  values (v_uid, other, g.id, p_liked)
  on conflict (from_id, to_id) do update
    set liked = excluded.liked, game_id = excluded.game_id, created_at = now();

  if p_liked and exists (select 1 from public.likes where from_id = other and to_id = v_uid and liked) then
    insert into public.matches (user_a, user_b, game_id)
    values (least(v_uid, other), greatest(v_uid, other), g.id)
    on conflict do nothing;
  end if;

  return jsonb_build_object(
    'liked', p_liked,
    'matched', exists (select 1 from public.matches
                       where user_a = least(v_uid, other) and user_b = greatest(v_uid, other))
  );
end
$$;

create or replace function public.like_status(p_game uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  g public.games;
  other uuid;
begin
  select * into g from public.games where id = p_game;
  if not found or (g.white_id is distinct from v_uid and g.black_id is distinct from v_uid) then
    raise exception 'Game not found.' using errcode = '22023';
  end if;
  other := case when g.white_id = v_uid then g.black_id else g.white_id end;
  return jsonb_build_object(
    'liked', (select liked from public.likes where from_id = v_uid and to_id = other),
    'matched', exists (select 1 from public.matches
                       where user_a = least(v_uid, other) and user_b = greatest(v_uid, other)),
    'available', other is not null and exists (select 1 from public.profiles where id = other)
                 and not public.is_blocked(v_uid, other)
  );
end
$$;

create or replace function public.matches_list() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'user', public.mini_card(v_uid, o.other),
             'created_at', o.created_at,
             'game_id', o.game_id,
             'compat', public.compat_score(v_uid, o.other))
           order by o.created_at desc)
    from (
      select case when m.user_a = v_uid then m.user_b else m.user_a end as other, m.created_at, m.game_id
      from public.matches m
      where v_uid in (m.user_a, m.user_b)
    ) o
    where not public.is_blocked(v_uid, o.other)
  ), '[]'::jsonb);
end
$$;

create or replace function public.unmatch(p_user uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  delete from public.matches where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user);
  update public.likes set liked = false where from_id = v_uid and to_id = p_user;
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
  if not found or (g.white_id is distinct from v_uid and g.black_id is distinct from v_uid) then
    raise exception 'Game not found.' using errcode = '22023';
  end if;
  if g.status = 'active' then
    raise exception 'The game is still in progress.' using errcode = '22023';
  end if;
  if g.next_game_id is not null then
    return jsonb_build_object('status', 'started', 'game_id', g.next_game_id);
  end if;

  other := case when g.white_id = v_uid then g.black_id else g.white_id end;
  if other is null or not exists (select 1 from public.profiles where id = other)
     or public.is_blocked(v_uid, other) then
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
    ng := public.create_game(g.black_id, g.white_id, g.time_control, g.mode, g.id, null);
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

-- ---------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------
create or replace function public.block_user(p_user uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if p_user = v_uid then
    raise exception 'You can''t block yourself.' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'User not found.' using errcode = '22023';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (v_uid, p_user) on conflict do nothing;
  update public.challenges set status = 'cancelled', responded_at = now()
  where status = 'pending'
    and least(from_id, to_id) = least(v_uid, p_user) and greatest(from_id, to_id) = greatest(v_uid, p_user);
  delete from public.matches where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user);
  update public.games
  set status = 'aborted', termination = 'abort', finished_at = now(), draw_offer_from = null,
      rematch_offer_from = null, version = version + 1, updated_at = now()
  where status = 'active'
    and ((white_id = v_uid and black_id = p_user) or (white_id = p_user and black_id = v_uid));
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
declare
  v_uid uuid := public.require_uid();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', b.blocked_id,
             'first_name', coalesce(p.first_name, 'Former member'),
             'photo', p.photos[1],
             'created_at', b.created_at)
           order by b.created_at desc)
    from public.blocks b
    left join public.profiles p on p.id = b.blocked_id
    where b.blocker_id = v_uid
  ), '[]'::jsonb);
end
$$;

create or replace function public.report_user(p_user uuid, p_reason text, p_details text default '',
                                              p_game uuid default null, p_block boolean default false)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  if p_user = v_uid then
    raise exception 'You can''t report yourself.' using errcode = '22023';
  end if;
  if (select count(*) from public.reports where reporter_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'You''ve sent a lot of reports today. Our team will review them.' using errcode = '22023';
  end if;
  insert into public.reports (reporter_id, reported_id, game_id, reason, details)
  values (v_uid, p_user, p_game, p_reason, left(coalesce(p_details, ''), 1000));
  if p_block then
    perform public.block_user(p_user);
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Account deletion (the app removes the user's photos from storage first)
-- ---------------------------------------------------------------------
create or replace function public.delete_account() returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
begin
  update public.games
  set status = 'aborted', termination = 'abort', finished_at = now(), draw_offer_from = null,
      rematch_offer_from = null, version = version + 1, updated_at = now()
  where status = 'active' and v_uid in (white_id, black_id);
  delete from auth.users where id = v_uid;   -- cascades to profile, answers, likes, matches, challenges, blocks
end
$$;

-- ---------------------------------------------------------------------
-- Privileges: internal helpers are not callable from the API
-- ---------------------------------------------------------------------
revoke execute on function
  public.require_uid(),
  public.is_blocked(uuid, uuid),
  public.option_index(jsonb, text),
  public.active_game_between(uuid, uuid),
  public.compat_score(uuid, uuid),
  public.profile_card(uuid, public.profiles, public.profiles),
  public.mini_card(uuid, uuid),
  public.user_stats(uuid),
  public.relationship(uuid, uuid),
  public.game_summary(uuid, public.games),
  public.create_game(uuid, uuid, text, text, uuid, uuid)
from public, anon, authenticated;

revoke execute on function
  public.heartbeat(),
  public.server_now(),
  public.discover(jsonb, int, int),
  public.get_profile(uuid),
  public.send_challenge(uuid, text, text),
  public.respond_challenge(uuid, boolean),
  public.cancel_challenge(uuid),
  public.inbox(),
  public.game_players(uuid),
  public.like_game(uuid, boolean),
  public.like_status(uuid),
  public.matches_list(),
  public.unmatch(uuid),
  public.rematch(uuid, text),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.blocked_users(),
  public.report_user(uuid, text, text, uuid, boolean),
  public.delete_account()
from public, anon;

grant execute on function
  public.heartbeat(),
  public.server_now(),
  public.discover(jsonb, int, int),
  public.get_profile(uuid),
  public.send_challenge(uuid, text, text),
  public.respond_challenge(uuid, boolean),
  public.cancel_challenge(uuid),
  public.inbox(),
  public.game_players(uuid),
  public.like_game(uuid, boolean),
  public.like_status(uuid),
  public.matches_list(),
  public.unmatch(uuid),
  public.rematch(uuid, text),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.blocked_users(),
  public.report_user(uuid, text, text, uuid, boolean),
  public.delete_account()
to authenticated;
