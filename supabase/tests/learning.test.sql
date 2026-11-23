-- Learning server tests (run like chess.test.sql).
\set ON_ERROR_STOP on
begin;
create temp table t_users (name text primary key, id uuid);
insert into auth.users (email) values ('l1@t.test'),('l2@t.test');
insert into t_users select split_part(email,'@',1), id from auth.users where email like 'l_@t.test';
grant select on t_users to authenticated;
create or replace function pg_temp.as_user(n text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from t_users where name = n), 'role', 'authenticated')::text, true);
end $$;

-- placement before a profile exists: graded, not stored
select pg_temp.as_user('l1'); set local role authenticated;
do $$ declare t jsonb; ans jsonb := '{}'; r jsonb; begin
  t := public.get_test('placement');
  assert jsonb_array_length(t->'items') = 16, 'placement items';
  assert not (t->'items'->0 ? 'answer'), 'answers hidden';
  r := public.submit_test('placement', ans);
  assert r->>'recommended' = 'A1' and (r->>'score')::int = 0, 'empty placement -> A1';
end $$;
insert into public.profiles (id, username, display_name, timezone) values ((select id from t_users where name='l1'), 'learner', 'Learner', 'America/New_York');
reset role;

-- answer all A1 + A2 placement items correctly as superuser to build the answer map
create temp table t_ans as select jsonb_object_agg(id, answer) filter (where level in ('A1','A2')) as a from public.test_items where test_id='placement';
grant select on t_ans to authenticated;
select pg_temp.as_user('l1'); set local role authenticated;
do $$ declare r jsonb; begin
  r := public.submit_test('placement', (select a from t_ans));
  assert r->>'recommended' = 'B1', 'A1+A2 mastered -> start B1: ' || (r->>'recommended');
  assert (select ru_level from public.profiles) = 'B1', 'profile level updated by placement';
  perform public.set_ru_level('A1');
end $$;

-- curriculum, lesson, completion -> SRS words, objectives, streak
do $$ declare c jsonb; l jsonb; r jsonb; d jsonb; first_id text; begin
  c := public.curriculum();
  assert jsonb_array_length(c->'levels') = 4, 'four levels';
  assert jsonb_array_length(c->'levels'->0->'lessons') = 14, 'A1 lessons';
  assert (c->'levels'->3->>'locked')::boolean = false, 'early access unlocks B2';
  first_id := c->'levels'->0->'lessons'->0->>'id';
  l := public.get_lesson(first_id);
  assert jsonb_array_length(l->'vocab') > 5 and l->'content'->'sections' is not null, 'lesson content';
  r := public.complete_lesson(first_id, 40);
  assert not (r->>'completed')::boolean and (r->>'words_added')::int = 0, 'low score does not complete';
  r := public.complete_lesson(first_id, 90);
  assert (r->>'first_completion')::boolean and (r->>'words_added')::int = jsonb_array_length(l->'vocab'), 'completion adds words';
  assert r->'new_achievements' ? 'first_lesson', 'first lesson achievement';
  d := public.dashboard();
  assert (d->'objectives'->>'lesson')::int = 1, 'lesson objective';
  assert (d->'objectives'->>'words')::int = jsonb_array_length(l->'vocab'), 'words objective counts today';
  assert (d->'russian'->>'streak')::int = 1, 'streak started';
  assert (d->'russian'->>'lessons_completed')::int = 1, 'lessons completed';
  assert d->'russian'->'next_lesson'->>'id' <> first_id, 'next lesson advances';
end $$;

-- reviews (SM-2)
do $$ declare q jsonb; it jsonb; r jsonb; begin
  q := public.review_queue(10);
  assert jsonb_array_length(q->'items') = 10 and jsonb_array_length(q->'distractors') > 20, 'queue + distractors';
  it := q->'items'->0;
  r := public.record_review(it->>'kind', it->>'item_id', 2);
  assert (r->>'interval_days')::real = 1, 'first good review = 1 day';
  it := q->'items'->1;
  r := public.record_review(it->>'kind', it->>'item_id', 0);
  assert (select lapses from public.srs_items where item_id = it->>'item_id') = 1, 'lapse recorded';
  assert jsonb_array_length(public.focus_words()) >= 1, 'missed word becomes a focus word';
  begin
    perform public.record_review('word', 'no-such-word', 2);
    raise exception 'unknown item should fail';
  exception when sqlstate '22023' then null; end;
end $$;

-- phrases, practice, speech, vocabulary
do $$ declare id bigint; v jsonb; p jsonb; begin
  id := public.save_phrase('Твой ход.', 'Your move.', 'game');
  assert public.save_phrase('Твой ход.', '', 'game') = id, 'saving twice is idempotent';
  perform public.record_practice('listening', true, 'x');
  perform public.record_practice('listening', false, 'y');
  perform public.record_speech_attempt('Привет', 'pm:a1-phrases:0', 'привет', '[]', true, 1500);
  perform public.record_speech_attempt('щи', 'pm:a1-hissing:3', 'щи', '[]', false, 900);
  v := public.my_vocabulary();
  assert jsonb_array_length(v->'phrases') = 1, 'phrase listed';
  p := public.pronunciation_overview();
  assert (p->'stats'->>'attempts')::int = 2, 'speech attempts';
  assert (select jsonb_array_length(m->'passed_items')) = 1 from jsonb_array_elements(p->'milestones') m where m->>'id' = 'a1-phrases', 'milestone progress';
  assert p->'difficult_sounds'->0->>'sound' = 'щ', 'difficult sound detected';
  assert (public.dashboard()->'russian'->'listening'->>'total')::int = 2, 'listening accuracy';
  perform public.delete_phrase(id);
  assert jsonb_array_length(public.my_vocabulary()->'phrases') = 0, 'phrase deleted';
end $$;

-- scenarios & guided conversation
do $$ declare s jsonb; cid uuid; begin
  s := public.scenarios();
  assert jsonb_array_length(s) = 16, 'scenarios';
  cid := public.start_conversation('a1-cafe', 'A1', 'guided');
  perform public.log_conversation_turn(cid, 'tutor', 'Здравствуйте!', 'Hello!', null);
  perform public.log_conversation_turn(cid, 'user', 'Кофе, пожалуйста.', '', null);
  assert (select turns from public.tutor_conversations where id = cid) = 2, 'turns logged';
  assert jsonb_array_length(public.conversations()) = 1, 'conversation listed';
end $$;

-- level test: pass A1 -> moves to A2
reset role;
create temp table t_a1 as select jsonb_object_agg(id, answer) as a from public.test_items where test_id='A1';
grant select on t_a1 to authenticated;
select pg_temp.as_user('l1'); set local role authenticated;
do $$ declare r jsonb; begin
  r := public.submit_test('A1', (select a from t_a1));
  assert (r->>'passed')::boolean and r->>'level_after' = 'A2', 'A1 passed -> A2';
  assert r->'new_achievements' ? 'level_a1', 'certified achievement';
end $$;
reset role;

-- paywall on: free plan gets A1 only, limits enforced
update public.app_config set value = 'true' where key = 'paywall_enabled';
select pg_temp.as_user('l1'); set local role authenticated;
do $$ declare c jsonb; begin
  c := public.curriculum();
  assert (c->'levels'->1->>'locked')::boolean, 'A2 locked on free plan';
  assert c->'entitlements'->>'plan' = 'free', 'free plan';
  begin
    perform public.get_lesson('b2-01');
    raise exception 'premium lesson should be refused';
  exception when insufficient_privilege then null; end;
  begin
    perform public.start_conversation('a1-cafe', 'A1', 'ai');
    raise exception 'AI tutor should be premium';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.subscriptions (user_id, plan_id, status) values ((select id from t_users where name='l1'), 'premium', 'active');
select pg_temp.as_user('l1'); set local role authenticated;
do $$ begin
  assert public.get_lesson('b2-01')->>'id' = 'b2-01', 'premium subscriber unlocked';
  assert (public.my_plan()->'entitlements'->>'plan') = 'premium', 'my_plan reflects subscription';
end $$;
-- clients cannot touch subscriptions or progress tables directly
do $$ begin
  begin
    insert into public.subscriptions (user_id, plan_id, status) values (public.app_uid(), 'premium', 'active');
    raise exception 'subscription insert should fail';
  exception when insufficient_privilege then null; end;
  begin
    update public.lesson_progress set best_score = 100;
    raise exception 'progress update should fail';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.lessons limit 1;
    raise exception 'lessons table should not be readable';
  exception when insufficient_privilege then null; end;
  begin
    update public.profiles set ru_level = 'B2';
    raise exception 'ru_level is not directly writable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- another user cannot see l1's data
select pg_temp.as_user('l2'); set local role authenticated;
do $$ begin
  assert (select count(*) from public.srs_items) = 0, 'srs isolated';
  assert (select count(*) from public.activity) = 0, 'activity isolated';
  assert (select count(*) from public.profiles) = 0, 'profiles isolated';
end $$;
reset role;
rollback;
\echo 'learning tests passed'
