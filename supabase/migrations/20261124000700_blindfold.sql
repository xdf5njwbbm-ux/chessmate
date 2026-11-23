-- Russian Chess Academy — professional blindfold chess.
-- * Online blindfold games are rated in their own pool ("blindfold"), so the
--   blindfold Elo starts unrated and is completely separate from bullet, blitz,
--   rapid and daily. Games against Stockfish never affect any rating.
-- * blindfold_results keeps per-game training stats for both kinds of game
--   (accuracy, response time, mistakes, reveals, level).

alter table public.games add column blindfold boolean not null default false;
alter table public.seeks add column blindfold boolean not null default false;
alter table public.challenges add column blindfold boolean not null default false;

alter table public.games drop constraint games_pool_check;
alter table public.games add constraint games_pool_check
  check (pool in ('bullet','blitz','rapid','daily','untimed','blindfold'));
alter table public.games add constraint games_blindfold_pool_check
  check (opponent_kind = 'ai' or (blindfold = (pool = 'blindfold')));
alter table public.ratings drop constraint ratings_pool_check;
alter table public.ratings add constraint ratings_pool_check
  check (pool in ('bullet','blitz','rapid','daily','blindfold'));

create table public.blindfold_results (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles(id) on delete cascade,
  game_id          uuid references public.games(id) on delete set null,
  client_ref       uuid not null,
  opponent_kind    text not null check (opponent_kind in ('human','ai')),
  ai_elo           int check (ai_elo between 100 and 3200),
  level            text not null check (level in ('beginner','intermediate','advanced','expert','master')),
  color            text not null check (color in ('white','black')),
  result           text not null check (result in ('win','loss','draw')),
  my_moves         int not null check (my_moves between 0 and 500),
  accuracy         numeric check (accuracy between 0 and 100),
  avg_response_ms  int check (avg_response_ms between 0 and 86400000),
  mistakes         int not null default 0 check (mistakes between 0 and 500),
  blunders         int not null default 0 check (blunders between 0 and 500),
  reveals          int not null default 0 check (reveals between 0 and 10000),
  reveal_ms        bigint not null default 0 check (reveal_ms >= 0),
  longest_blind_streak int not null default 0 check (longest_blind_streak between 0 and 500),
  created_at       timestamptz not null default now(),
  unique (user_id, client_ref)
);
create index blindfold_results_user_idx on public.blindfold_results (user_id, created_at desc);
create index blindfold_results_game_idx on public.blindfold_results (game_id);
alter table public.blindfold_results enable row level security;
create policy "own blindfold results: read" on public.blindfold_results for select to authenticated
  using (user_id = (select public.app_uid()));

drop function public.create_game(uuid, uuid, text, boolean, boolean, uuid, uuid);
create or replace function public.create_game(w uuid, b uuid, tc text, p_rated boolean, p_rc boolean, prev uuid, chal uuid,
                                              p_blind boolean default false)
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
  if coalesce(p_blind, false) and t.pool = 'daily' then
    raise exception 'Blindfold games need a live time control.' using errcode = '22023';
  end if;
  insert into public.games (white_id, black_id, opponent_kind, time_control, pool, blindfold, rated, russian_chat,
                            initial_ms, increment_ms, per_move, white_ms, black_ms, rematch_of, challenge_id)
  values (w, b, 'human', tc, case when coalesce(p_blind, false) then 'blindfold' else t.pool end, coalesce(p_blind, false), p_rated, p_rc, t.initial_ms, t.increment_ms, t.per_move,
          t.initial_ms, t.initial_ms, prev, chal)
  returning id into g;
  return g;
end
$$;

create or replace function public.game_summary(viewer uuid, g public.games) returns jsonb
language sql stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', g.id,
    'time_control', g.time_control,
    'pool', g.pool,
    'blindfold', g.blindfold,
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
     or g.white_id is null or g.black_id is null or g.pool not in ('bullet','blitz','rapid','daily','blindfold') then
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

drop function public.find_match(text, boolean, boolean);
create or replace function public.find_match(p_time_control text, p_rated boolean, p_russian_chat boolean default false,
                                             p_blindfold boolean default false)
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
  p_blindfold := coalesce(p_blindfold, false);
  if p_blindfold and t.pool = 'daily' then
    raise exception 'Blindfold games need a live time control.' using errcode = '22023';
  end if;

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
  if found and (mine.time_control <> p_time_control or mine.rated <> p_rated or mine.blindfold <> p_blindfold) then
    delete from public.seeks where user_id = v_uid;
    mine := null;
  end if;
  if mine.user_id is not null then
    waited := extract(epoch from now() - mine.created_at);
  end if;

  my_rating := coalesce((select rating from public.ratings where user_id = v_uid
                          and pool = case when p_blindfold then 'blindfold' else t.pool end), 1200);
  win := least(1000, 150 + 50 * floor(waited / 5)::int);

  select s.* into other from public.seeks s
  where s.user_id <> v_uid and s.game_id is null
    and s.time_control = p_time_control and s.rated = p_rated and s.blindfold = p_blindfold
    and s.pinged_at > now() - interval '15 seconds'
    and not public.is_blocked(v_uid, s.user_id)
    and abs(s.rating - my_rating) <= greatest(win, least(1000, 150 + 50 * floor(extract(epoch from now() - s.created_at) / 5)::int))
  order by abs(s.rating - my_rating), s.created_at
  limit 1;

  if other.user_id is not null then
    if random() < 0.5 then
      g := public.create_game(v_uid, other.user_id, p_time_control, p_rated, coalesce(p_russian_chat, false) and other.russian_chat, null, null, p_blindfold);
    else
      g := public.create_game(other.user_id, v_uid, p_time_control, p_rated, coalesce(p_russian_chat, false) and other.russian_chat, null, null, p_blindfold);
    end if;
    update public.seeks set game_id = g where user_id = other.user_id;
    delete from public.seeks where user_id = v_uid;
    return jsonb_build_object('status', 'matched', 'game_id', g);
  end if;

  insert into public.seeks (user_id, time_control, rated, russian_chat, rating, blindfold)
  values (v_uid, p_time_control, p_rated, coalesce(p_russian_chat, false), my_rating, p_blindfold)
  on conflict (user_id) do update set pinged_at = now(), russian_chat = excluded.russian_chat, rating = excluded.rating;

  return jsonb_build_object(
    'status', 'waiting',
    'waited_s', floor(waited),
    'window', win,
    'rating', my_rating,
    'searching', (select count(*) from public.seeks s where s.time_control = p_time_control and s.blindfold = p_blindfold and s.game_id is null
                    and s.pinged_at > now() - interval '15 seconds')
  );
end
$$;

create or replace function public.check_blindfold_tc(tc text, p_blind boolean) returns boolean
language plpgsql stable
set search_path = ''
as $$
begin
  if coalesce(p_blind, false) and (select pool from public.time_controls where id = tc) = 'daily' then
    raise exception 'Blindfold games need a live time control.' using errcode = '22023';
  end if;
  return coalesce(p_blind, false);
end
$$;

drop function public.send_challenge(text, text, boolean, boolean, text);
create or replace function public.send_challenge(p_username text, p_time_control text, p_rated boolean,
                                                 p_russian_chat boolean default false, p_color text default 'random',
                                                 p_blindfold boolean default false)
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
  insert into public.challenges (from_id, to_id, time_control, rated, russian_chat, color, blindfold)
  values (v_uid, target, p_time_control, coalesce(p_rated, false), coalesce(p_russian_chat, false),
          case when p_color in ('white','black') then p_color else 'random' end, public.check_blindfold_tc(p_time_control, p_blindfold))
  returning id into v_id;
  return v_id;
end
$$;

drop function public.create_invite(text, boolean, boolean, text);
create or replace function public.create_invite(p_time_control text, p_rated boolean,
                                                p_russian_chat boolean default false, p_color text default 'random',
                                                p_blindfold boolean default false)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  code text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
begin
  perform public.check_new_challenge(v_uid, p_time_control, p_rated);
  insert into public.challenges (from_id, to_id, invite_code, time_control, rated, russian_chat, color, blindfold)
  values (v_uid, null, code, p_time_control, coalesce(p_rated, false), coalesce(p_russian_chat, false),
          case when p_color in ('white','black') then p_color else 'random' end,
          public.check_blindfold_tc(p_time_control, p_blindfold));
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
    'id', c.id, 'time_control', c.time_control, 'rated', c.rated, 'blindfold', c.blindfold, 'russian_chat', c.russian_chat, 'color', c.color,
    'status', case when c.status = 'pending' and c.expires_at <= now() then 'expired' else c.status end,
    'game_id', case when v_uid in (c.from_id, c.to_id) then c.game_id end,
    'mine', c.from_id = v_uid,
    'from', public.mini_player(v_uid, c.from_id, case when c.blindfold then 'blindfold' else (select pool from public.time_controls where id = c.time_control) end)
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
    g := public.create_game(c.from_id, accepter, c.time_control, c.rated, c.russian_chat, null, c.id, c.blindfold);
  else
    g := public.create_game(accepter, c.from_id, c.time_control, c.rated, c.russian_chat, null, c.id, c.blindfold);
  end if;
  update public.challenges set status = 'accepted', responded_at = now(), game_id = g, to_id = accepter where id = c.id;
  return g;
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
      select jsonb_agg(jsonb_build_object('id', c.id, 'time_control', c.time_control, 'rated', c.rated, 'blindfold', c.blindfold,
               'russian_chat', c.russian_chat, 'color', c.color, 'created_at', c.created_at,
               'user', public.mini_player(v_uid, c.from_id, case when c.blindfold then 'blindfold' else t.pool end)) order by c.created_at desc)
      from public.challenges c join public.time_controls t on t.id = c.time_control
      where c.to_id = v_uid and c.status = 'pending' and c.expires_at > now()
        and not public.is_blocked(v_uid, c.from_id)), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'time_control', c.time_control, 'rated', c.rated, 'blindfold', c.blindfold,
               'russian_chat', c.russian_chat, 'color', c.color, 'created_at', c.created_at, 'invite_code', c.invite_code,
               'user', case when c.to_id is not null then public.mini_player(v_uid, c.to_id, case when c.blindfold then 'blindfold' else t.pool end) end)
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
    ng := public.create_game(g.black_id, g.white_id, g.time_control, g.rated, g.russian_chat, g.id, null, g.blindfold);
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

create or replace function public.leaderboard(p_pool text, p_limit int default 50) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  n int := public.placement_games();
  mine public.ratings;
begin
  if p_pool not in ('bullet','blitz','rapid','daily','blindfold') then
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

-- ---------------------------------------------------------------------
-- Blindfold training results
-- ---------------------------------------------------------------------
create or replace function public.record_blindfold(p jsonb) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  g public.games;
  ref uuid;
  v_kind text;
  v_color text;
  v_result text;
  v_id bigint;
  num numeric;
begin
  perform public.require_profile(v_uid);
  begin
    ref := (p ->> 'client_ref')::uuid;
  exception when others then
    raise exception 'Bad request.' using errcode = '22023';
  end;
  if ref is null then
    raise exception 'Bad request.' using errcode = '22023';
  end if;
  if (select count(*) from public.blindfold_results where user_id = v_uid and created_at > now() - interval '1 hour') >= 120 then
    raise exception 'Too many results this hour. Try again later.' using errcode = '22023';
  end if;

  -- a saved game is the source of truth for kind, color and result
  if p ? 'game_id' and nullif(p ->> 'game_id', '') is not null then
    select * into g from public.games where id = (p ->> 'game_id')::uuid;
    if not found or v_uid not in (g.white_id, g.black_id) or g.status <> 'finished'
       or not (g.opponent_kind = 'ai' or g.blindfold) then
      raise exception 'Game not found.' using errcode = '22023';
    end if;
    v_kind := g.opponent_kind;
    v_color := case when g.white_id = v_uid then 'white' else 'black' end;
    v_result := case when g.result = '1/2-1/2' then 'draw'
                     when (g.result = '1-0') = (v_color = 'white') then 'win' else 'loss' end;
  else
    v_kind := 'ai';
    v_color := case when p ->> 'color' = 'black' then 'black' else 'white' end;
    v_result := p ->> 'result';
  end if;
  if v_result is null or v_result not in ('win','loss','draw')
     or coalesce(p ->> 'level', '') not in ('beginner','intermediate','advanced','expert','master') then
    raise exception 'Bad request.' using errcode = '22023';
  end if;

  num := nullif(p ->> 'accuracy', '')::numeric;
  insert into public.blindfold_results (user_id, game_id, client_ref, opponent_kind, ai_elo, level, color, result, my_moves,
                                        accuracy, avg_response_ms, mistakes, blunders, reveals, reveal_ms, longest_blind_streak)
  values (v_uid, g.id, ref, v_kind,
          case when v_kind = 'ai' then coalesce(g.ai_elo, least(3200, greatest(100, nullif(p ->> 'ai_elo', '')::int))) end,
          p ->> 'level', v_color, v_result,
          least(500, greatest(0, coalesce((p ->> 'my_moves')::int, 0))),
          case when num is null then null else round(least(100, greatest(0, num)), 1) end,
          least(86400000, greatest(0, nullif(p ->> 'avg_response_ms', '')::int)),
          least(500, greatest(0, coalesce((p ->> 'mistakes')::int, 0))),
          least(500, greatest(0, coalesce((p ->> 'blunders')::int, 0))),
          least(10000, greatest(0, coalesce((p ->> 'reveals')::int, 0))),
          greatest(0, coalesce((p ->> 'reveal_ms')::bigint, 0)),
          least(500, greatest(0, coalesce((p ->> 'longest_blind_streak')::int, 0))))
  on conflict (user_id, client_ref) do nothing
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'new_achievements', to_jsonb(public.check_achievements(v_uid)));
end
$$;

create or replace function public.blindfold_stats() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_uid();
  n int := public.placement_games();
  r public.ratings;
begin
  select * into r from public.ratings where user_id = v_uid and pool = 'blindfold';
  return jsonb_build_object(
    'rating', case when r.user_id is null then null else jsonb_build_object(
        'rating', case when r.games >= n then r.rating end,
        'status', public.rating_status(r.games),
        'games', r.games, 'wins', r.wins, 'losses', r.losses, 'draws', r.draws,
        'peak', case when r.games >= n then r.peak end,
        'placement_left', greatest(0, n - r.games)) end,
    'totals', (select jsonb_build_object(
        'games', count(*),
        'wins', count(*) filter (where b.result = 'win'),
        'losses', count(*) filter (where b.result = 'loss'),
        'draws', count(*) filter (where b.result = 'draw'),
        'accuracy', round(avg(b.accuracy), 1),
        'avg_response_ms', round(avg(b.avg_response_ms)),
        'mistakes', coalesce(sum(b.mistakes), 0),
        'blunders', coalesce(sum(b.blunders), 0),
        'reveals', coalesce(sum(b.reveals), 0),
        'no_reveal_games', count(*) filter (where b.reveals = 0),
        'longest_no_reveal_game', coalesce(max(b.my_moves) filter (where b.reveals = 0), 0),
        'longest_blind_streak', coalesce(max(b.longest_blind_streak), 0))
      from public.blindfold_results b where b.user_id = v_uid),
    'by_level', coalesce((select jsonb_agg(jsonb_build_object('level', x.level, 'games', x.games, 'wins', x.wins,
                                                              'accuracy', x.acc) order by x.ord)
      from (select b.level, count(*) as games, count(*) filter (where b.result = 'win') as wins, round(avg(b.accuracy), 1) as acc,
                   array_position(array['beginner','intermediate','advanced','expert','master'], b.level) as ord
            from public.blindfold_results b where b.user_id = v_uid group by b.level) x), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'game_id', b.game_id, 'opponent_kind', b.opponent_kind,
                                 'ai_elo', b.ai_elo, 'level', b.level, 'color', b.color, 'result', b.result, 'moves', b.my_moves,
                                 'accuracy', b.accuracy, 'avg_response_ms', b.avg_response_ms, 'mistakes', b.mistakes,
                                 'reveals', b.reveals, 'created_at', b.created_at) order by b.created_at desc)
      from (select * from public.blindfold_results x where x.user_id = v_uid order by x.created_at desc limit 20) b), '[]'::jsonb)
  );
end
$$;

-- ---------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------
revoke execute on function
  public.create_game(uuid, uuid, text, boolean, boolean, uuid, uuid, boolean), public.check_blindfold_tc(text, boolean)
from public, anon, authenticated;

do $$
declare
  fns text[] := array[
    'find_match(text, boolean, boolean, boolean)',
    'send_challenge(text, text, boolean, boolean, text, boolean)',
    'create_invite(text, boolean, boolean, text, boolean)',
    'record_blindfold(jsonb)', 'blindfold_stats()'];
  f text;
begin
  foreach f in array fns loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
