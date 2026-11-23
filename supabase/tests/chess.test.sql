-- Chess server tests. Runs against a local Postgres with the Supabase stubs
-- (see README → Testing). Every block raises on failure.
\set ON_ERROR_STOP on
begin;
create temp table t_users (name text primary key, id uuid);
insert into auth.users (email) values ('a@t.test'),('b@t.test'),('c@t.test');
insert into t_users select split_part(email,'@',1), id from auth.users where email like '%@t.test';
grant select on t_users to authenticated;

create or replace function pg_temp.as_user(n text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from t_users where name = n), 'role', 'authenticated')::text, true);
end $$;

-- profiles
select pg_temp.as_user('a'); set local role authenticated;
insert into public.profiles (id, username, display_name) values ((select id from t_users where name='a'), 'Alice_1', 'Alice');
reset role;
select pg_temp.as_user('b'); set local role authenticated;
insert into public.profiles (id, username, display_name) values ((select id from t_users where name='b'), 'boris', 'Boris');
reset role;
select pg_temp.as_user('c'); set local role authenticated;
insert into public.profiles (id, username, display_name, ru_level) values ((select id from t_users where name='c'), 'clara', 'Clara', 'B1');
reset role;

do $$ begin
  assert (select username from public.profiles where display_name='Alice') = 'alice_1', 'username lowercased';
end $$;

-- clients cannot write server-managed columns or chess tables
select pg_temp.as_user('a'); set local role authenticated;
do $$ begin
  begin
    update public.profiles set streak_best = 99;
    raise exception 'should not update streak';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.games (white_id, time_control, pool) values (public.app_uid(), 'blitz5', 'blitz');
    raise exception 'should not insert games';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.test_items;
    raise exception 'should not read test answers';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_game_ratings(gen_random_uuid());
    raise exception 'should not call service function';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- matchmaking: a waits, b gets matched, a sees the same game
select pg_temp.as_user('a'); set local role authenticated;
do $$ declare r jsonb; begin
  r := public.find_match('blitz5', true, true);
  assert r->>'status' = 'waiting', 'a waits: ' || r::text;
end $$;
reset role;
select pg_temp.as_user('b'); set local role authenticated;
create temp table t_game as select (public.find_match('blitz5', true, true))->>'game_id' as id;
reset role;
select pg_temp.as_user('a'); set local role authenticated;
do $$ declare r jsonb; begin
  r := public.find_match('blitz5', true, true);
  assert r->>'status' = 'matched' and r->>'game_id' = (select id from t_game), 'a matched: ' || r::text;
end $$;
reset role;
do $$ declare g public.games; begin
  select * into g from public.games where id = (select id::uuid from t_game);
  assert g.rated and g.russian_chat and g.pool = 'blitz' and g.white_ms = 300000, 'game settings';
end $$;

-- Russian-only chat
select pg_temp.as_user('a'); set local role authenticated;
do $$ begin
  perform public.send_game_message((select id::uuid from t_game), 'Привет! Хороший ход e4, Nf3 и O-O.');
  begin
    perform public.send_game_message((select id::uuid from t_game), 'hello there');
    raise exception 'latin chat should fail';
  exception when sqlstate '22023' then null; end;
  assert (select count(*) from public.game_messages) = 1, 'one message visible to player';
end $$;
reset role;
select pg_temp.as_user('c'); set local role authenticated;
do $$ begin
  assert (select count(*) from public.game_messages) = 0, 'non-player cannot read chat';
  assert (select count(*) from public.games) = 0, 'non-player cannot read game';
end $$;
reset role;

-- Elo: finish five rated games a beats b, then check placement → provisional
do $$
declare
  a uuid := (select id from t_users where name='a');
  b uuid := (select id from t_users where name='b');
  g uuid;
  i int;
  ra public.ratings; rb public.ratings;
begin
  update public.games set status='finished', result='1-0', termination='resign', finished_at=now()
   where id = (select id::uuid from t_game) and white_id = a;
  update public.games set status='finished', result='0-1', termination='resign', finished_at=now()
   where id = (select id::uuid from t_game) and black_id = a;
  perform public.finalize_game((select id::uuid from t_game));
  perform public.finalize_game((select id::uuid from t_game)); -- idempotent
  select * into ra from public.ratings where user_id=a and pool='blitz';
  assert ra.games = 1 and ra.wins = 1, 'first game counted once: ' || row_to_json(ra)::text;
  -- placement game 1 vs 1200: (1200 + 1200 + 400) / 2 = 1400
  assert ra.rating = 1400, 'placement estimate after 1 win = ' || ra.rating;
  for i in 2..5 loop
    g := public.create_game(a, b, 'blitz5', true, false, null, null);
    update public.games set status='finished', result='1-0', termination='checkmate', finished_at=now() where id = g;
    perform public.finalize_game(g);
  end loop;
  select * into ra from public.ratings where user_id=a and pool='blitz';
  select * into rb from public.ratings where user_id=b and pool='blitz';
  assert ra.games = 5 and public.rating_status(ra.games) = 'provisional', 'a provisional';
  assert ra.peak = ra.rating, 'peak set at placement end';
  assert ra.rating > 1200 and rb.rating < 1200, 'a above, b below: ' || ra.rating || ' / ' || rb.rating;
  assert (select count(*) from public.rating_history where user_id=a) = 5, 'history rows';
  assert (select count(*) from public.activity where user_id=a and kind='game') = 5, 'game activity';
  assert exists (select 1 from public.user_achievements where user_id=a and achievement_id='placed'), 'placed achievement';
  assert exists (select 1 from public.user_achievements where user_id=a and achievement_id='first_rated_win'), 'rated win achievement';
  -- provisional: K=40
  g := public.create_game(b, a, 'blitz5', true, false, null, null);
  update public.games set status='finished', result='1/2-1/2', termination='agreement', finished_at=now() where id = g;
  perform public.finalize_game(g);
  assert (select white_delta + black_delta from public.games where id = g) between -1 and 1, 'draw deltas symmetric (K equal)';
  assert (select black_delta from public.games where id = g) < 0, 'favourite loses points on a draw';
end $$;

-- elo_next maths
do $$ begin
  assert public.elo_next(1500, 30, 0, 0, 1500, 1, 5) = 1510, 'established K=20 win vs equal = +10';
  assert public.elo_next(1500, 10, 0, 0, 1500, 0, 5) = 1480, 'provisional K=40 loss vs equal = -20';
  assert public.elo_next(2450, 50, 0, 0, 2450, 1, 5) = 2455, 'K=10 at 2400+';
  assert public.elo_next(120, 30, 0, 0, 2000, 0, 5) >= 100, 'floor 100';
end $$;

-- leaderboard / stats / profile run for a participant
select pg_temp.as_user('a'); set local role authenticated;
do $$ declare r jsonb; begin
  r := public.leaderboard('blitz', 10);
  assert jsonb_array_length(r->'rows') = 2 and (r->'rows'->0->>'rating')::int = 1384, 'placed players listed in order: ' || r::text;
  assert (r->'me'->>'rank')::int = 1, 'my rank';
  r := public.chess_stats();
  assert (r->'totals'->>'games')::int = 6, 'stats totals';
  r := public.public_profile('boris');
  assert r->>'username' = 'boris', 'public profile';
  r := public.dashboard();
  assert (r->'chess'->'totals'->>'games')::int = 6, 'dashboard chess';
end $$;
reset role;

-- challenges and invite links
select pg_temp.as_user('a'); set local role authenticated;
create temp table t_code as select public.create_invite('rapid15_10', false, false, 'white') as code;
do $$ begin
  perform public.send_challenge('clara', 'blitz3', false, false, 'random');
  begin
    perform public.accept_invite((select code from t_code));
    raise exception 'own invite should fail';
  exception when sqlstate '22023' then null; end;
end $$;
reset role;
select pg_temp.as_user('c'); set local role authenticated;
do $$ declare g uuid; r jsonb; begin
  r := public.inbox();
  assert jsonb_array_length(r->'incoming') = 1, 'clara has an incoming challenge';
  g := public.accept_invite((select code from t_code));
  assert (select white_id from public.games where id = g) = (select id from t_users where name='a'), 'inviter got white';
  begin
    perform public.respond_challenge(((r->'incoming'->0)->>'id')::uuid, true);
    raise exception 'second game vs same opponent should fail';
  exception when sqlstate '22023' then null; end;
end $$;
reset role;

-- blocking aborts games and hides players
select pg_temp.as_user('c'); set local role authenticated;
do $$ begin
  perform public.block_user((select id from t_users where name='a'));
  assert public.public_profile('alice_1') is null, 'blocked profile hidden';
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from public.games where status='active' and black_id=(select id from t_users where name='c')), 'game aborted on block';
end $$;

rollback;
\echo 'chess tests passed'
