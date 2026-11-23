-- =====================================================================
-- Russian Chess Academy — schema
-- Two independent progressions: Russian (A1–B2) and chess (Elo per time
-- control). They are stored in separate tables and are never combined.
--
-- Security model: clients read only their own rows (RLS). Everything
-- about other people, all curriculum content and every write that affects
-- progress, ratings or entitlements goes through SECURITY DEFINER
-- functions (next migration) or the `game` / `speech` / `tutor` edge
-- functions running with the service role.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------
create or replace function public.app_uid() returns uuid
language sql stable
set search_path = ''
as $$
  select case
    when coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then null
    else auth.uid()
  end
$$;

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

-- ---------------------------------------------------------------------
-- Configuration, plans and subscriptions
-- Prices live in `plans` and can be changed without touching code.
-- `paywall_enabled = false` means everyone gets premium features
-- (early access) until a payment provider is connected.
-- ---------------------------------------------------------------------
create table public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.plans (
  id               text primary key,
  name             text not null,
  tagline          text not null default '',
  features         jsonb not null,
  price_cents      int check (price_cents is null or price_cents >= 0),
  currency         text check (currency is null or currency ~ '^[A-Z]{3}$'),
  billing_interval text check (billing_interval in ('month','year')),
  active           boolean not null default true,
  sort             int not null default 0
);

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  username           text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name       text not null check (char_length(display_name) between 1 and 40),
  ru_level           text not null default 'A1' check (ru_level in ('A1','A2','B1','B2')),
  ru_forms           text not null default 'm' check (ru_forms in ('m','f')),
  learning_intensity text not null default 'standard' check (learning_intensity in ('quick','standard','deep')),
  show_translit      boolean not null default true,
  speech_rate        numeric(3,2) not null default 1.00 check (speech_rate between 0.5 and 1.25),
  voice              text not null default 'female' check (voice in ('female','male','female2')),
  chess_experience   text not null default 'casual' check (chess_experience in ('new','casual','club','advanced')),
  russian_chat       boolean not null default false,
  daily_goal_words   int not null default 10 check (daily_goal_words between 5 and 50),
  timezone           text not null default 'UTC' check (char_length(timezone) <= 64),
  show_online        boolean not null default true,
  streak_current     int not null default 0,   -- server-managed
  streak_best        int not null default 0,   -- server-managed
  last_active_day    date,                     -- server-managed
  last_seen          timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create or replace function public.profiles_before_write() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.username := lower(btrim(new.username));
  new.display_name := btrim(new.display_name);
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    new.timezone := 'UTC';
  end if;
  if tg_op = 'INSERT' then
    new.streak_current := 0;
    new.streak_best := 0;
    new.last_active_day := null;
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_before_write
before insert or update on public.profiles
for each row execute function public.profiles_before_write();

-- The learner's "today", in their own time zone (daily objectives, streaks).
create or replace function public.local_day(u uuid) returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone coalesce((select p.timezone from public.profiles p where p.id = u), 'UTC'))::date
$$;

create table public.subscriptions (
  user_id                  uuid primary key references public.profiles(id) on delete cascade,
  plan_id                  text not null references public.plans(id),
  status                   text not null check (status in ('active','trialing','past_due','canceled')),
  provider                 text,
  provider_customer_id     text,
  provider_subscription_id text,
  current_period_end       timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Curriculum (content is served only through functions, so premium
-- levels can be gated on the server)
-- ---------------------------------------------------------------------
create table public.levels (
  code        text primary key check (code in ('A1','A2','B1','B2')),
  name        text not null,
  description text not null,
  sort        int not null
);

create table public.lesson_categories (
  id          text primary key,
  name        text not null,
  grp         text not null check (grp in ('everyday','chess','grammar','pronunciation')),
  sort        int not null
);

create table public.lessons (
  id          text primary key,
  level       text not null references public.levels(code),
  category_id text not null references public.lesson_categories(id),
  sort        int not null,
  title       text not null,
  title_ru    text not null,
  summary     text not null,
  content     jsonb not null,
  line_count  int not null default 0,
  vocab_count int not null default 0
);
create index lessons_level_idx on public.lessons (level, sort);
create index lessons_category_idx on public.lessons (category_id);

create table public.vocab (
  id        text primary key,
  ru        text not null,
  stressed  text not null,
  en        text not null,
  pos       text not null default '',
  note      text not null default '',
  tags      text[] not null default '{}',
  level     text not null references public.levels(code),
  lesson_id text references public.lessons(id) on delete set null
);
create index vocab_lesson_idx on public.vocab (lesson_id);
create index vocab_level_idx on public.vocab (level);

create table public.tests (
  id       text primary key,          -- 'placement', 'A1', 'A2', 'B1', 'B2'
  level    text references public.levels(code),
  title    text not null,
  summary  text not null,
  pass_pct int not null default 80,
  sort     int not null
);

create table public.test_items (
  id      text primary key,
  test_id text not null references public.tests(id) on delete cascade,
  sort    int not null,
  level   text not null references public.levels(code),
  kind    text not null check (kind in ('reading','listening','grammar','vocab')),
  prompt  text not null,
  ru      text,                       -- Russian text to read or listen to
  options jsonb not null,             -- ["...", "...", ...]
  answer  int not null                -- never exposed to clients
);
create index test_items_test_idx on public.test_items (test_id, sort);

create table public.conversation_scenarios (
  id          text primary key,
  level       text not null references public.levels(code),
  category_id text not null references public.lesson_categories(id),
  sort        int not null,
  title       text not null,
  title_ru    text not null,
  description text not null,
  tutor_role  text not null,           -- who the tutor plays (barista, coworker, …)
  script      jsonb not null           -- guided steps used when the AI tutor is off
);

create table public.pron_milestones (
  id          text primary key,
  level       text not null references public.levels(code),
  sort        int not null,
  title       text not null,
  summary     text not null,
  focus       text[] not null default '{}',   -- sounds this milestone trains
  items       jsonb not null,                -- [{ru, en, tip}]
  pass_count  int not null                   -- items that must be passed
);

-- ---------------------------------------------------------------------
-- Learning progress
-- ---------------------------------------------------------------------
create table public.lesson_progress (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  lesson_id    text not null references public.lessons(id) on delete cascade,
  attempts     int not null default 0,
  best_score   int not null default 0 check (best_score between 0 and 100),
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index lesson_progress_lesson_idx on public.lesson_progress (lesson_id);

create table public.test_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  test_id      text not null references public.tests(id) on delete cascade,
  score        int not null,
  total        int not null,
  passed       boolean not null,
  level_before text,
  level_after  text,
  created_at   timestamptz not null default now()
);
create index test_attempts_user_idx on public.test_attempts (user_id, test_id);
create index test_attempts_test_idx on public.test_attempts (test_id);

-- Spaced repetition (SM-2 variant). kind 'word' -> vocab.id,
-- kind 'phrase' -> saved_phrases.id
create table public.srs_items (
  user_id          uuid not null references public.profiles(id) on delete cascade,
  kind             text not null check (kind in ('word','phrase')),
  item_id          text not null,
  ease             real not null default 2.5,
  interval_days    real not null default 0,
  reps             int not null default 0,
  lapses           int not null default 0,
  correct          int not null default 0,
  incorrect        int not null default 0,
  due_at           timestamptz not null default now(),
  last_reviewed_at timestamptz,
  created_at       timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);
create index srs_items_due_idx on public.srs_items (user_id, due_at);

create table public.saved_phrases (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  ru         text not null check (char_length(ru) between 1 and 300),
  en         text not null default '' check (char_length(en) <= 300),
  source     text not null default 'game' check (source in ('game','lesson','chat','practice','tutor')),
  created_at timestamptz not null default now(),
  unique (user_id, ru)
);

-- Everything a learner does, by local day: drives streaks, daily
-- objectives, listening accuracy and speaking progress.
create table public.activity (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  kind       text not null check (kind in ('lesson','review','listening','speaking','phrase','game','test','tutor')),
  correct    boolean,
  ref        text,
  created_at timestamptz not null default now()
);
create index activity_user_day_idx on public.activity (user_id, day);
create unique index activity_game_once on public.activity (user_id, ref) where kind = 'game';

-- Pronunciation attempts. provider 'azure' attempts are scored on the
-- server by Azure pronunciation assessment; 'browser' attempts only know
-- which words the device's speech recognizer heard (no score).
create table public.speech_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  text         text not null check (char_length(text) between 1 and 400),
  ref          text,
  provider     text not null check (provider in ('azure','browser')),
  recognized   text not null default '',
  pron_score   numeric(5,2),
  accuracy     numeric(5,2),
  fluency      numeric(5,2),
  completeness numeric(5,2),
  prosody      numeric(5,2),
  words        jsonb not null default '[]',
  passed       boolean not null default false,
  duration_ms  int not null default 0 check (duration_ms between 0 and 120000),
  created_at   timestamptz not null default now()
);
create index speech_attempts_user_idx on public.speech_attempts (user_id, created_at);

-- AI tutor / guided conversations
create table public.tutor_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  scenario_id text references public.conversation_scenarios(id) on delete set null,
  level       text not null check (level in ('A1','A2','B1','B2')),
  mode        text not null check (mode in ('ai','guided')),
  turns       int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tutor_conversations_user_idx on public.tutor_conversations (user_id, updated_at);
create index tutor_conversations_scenario_idx on public.tutor_conversations (scenario_id);

create table public.tutor_messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.tutor_conversations(id) on delete cascade,
  role            text not null check (role in ('tutor','user')),
  ru              text not null,
  en              text not null default '',
  correction      jsonb,
  created_at      timestamptz not null default now()
);
create index tutor_messages_conv_idx on public.tutor_messages (conversation_id, id);

-- ---------------------------------------------------------------------
-- Chess
-- ---------------------------------------------------------------------
create table public.time_controls (
  id           text primary key,
  label        text not null,
  pool         text not null check (pool in ('bullet','blitz','rapid','daily','untimed')),
  initial_ms   bigint not null,
  increment_ms int not null default 0,
  per_move     boolean not null default false,
  ai_only      boolean not null default false,
  sort         int not null
);

create table public.games (
  id                 uuid primary key default gen_random_uuid(),
  white_id           uuid references public.profiles(id) on delete set null,
  black_id           uuid references public.profiles(id) on delete set null,
  opponent_kind      text not null default 'human' check (opponent_kind in ('human','ai')),
  ai_elo             int check (ai_elo between 100 and 3200),
  time_control       text not null references public.time_controls(id),
  pool               text not null check (pool in ('bullet','blitz','rapid','daily','untimed')),
  rated              boolean not null default false,
  russian_chat       boolean not null default false,
  initial_ms         bigint not null default 0,
  increment_ms       int not null default 0,
  per_move           boolean not null default false,
  status             text not null default 'active' check (status in ('active','finished','aborted')),
  result             text check (result in ('1-0','0-1','1/2-1/2')),
  termination        text check (termination in ('checkmate','resign','timeout','stalemate','insufficient',
                                                 'threefold','fifty_move','agreement','abort','timeout_vs_insufficient')),
  fen                text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves              text[] not null default '{}',   -- UCI
  sans               text[] not null default '{}',   -- SAN, same length as moves
  white_ms           bigint not null default 0,
  black_ms           bigint not null default 0,
  turn_started_at    timestamptz not null default now(),
  draw_offer_from    uuid,
  rematch_offer_from uuid,
  rematch_of         uuid references public.games(id) on delete set null,
  next_game_id       uuid references public.games(id) on delete set null,
  challenge_id       uuid,
  white_rating       int,
  black_rating       int,
  white_delta        int,
  black_delta        int,
  white_status       text check (white_status in ('unrated','provisional','established')),
  black_status       text check (black_status in ('unrated','provisional','established')),
  rating_applied     boolean not null default false,
  undo_count         int not null default 0,
  client_ref         uuid unique,                     -- idempotency key for recorded AI games
  version            int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  finished_at        timestamptz,
  check (white_id is distinct from black_id),
  check (not rated or opponent_kind = 'human'),       -- games against the engine never affect Elo
  check (opponent_kind = 'human' or ai_elo is not null)
);
create index games_white_idx on public.games (white_id, status);
create index games_black_idx on public.games (black_id, status);
create index games_finished_idx on public.games (finished_at);
create index games_time_control_idx on public.games (time_control);
create index games_next_game_idx on public.games (next_game_id);
create index games_rematch_of_idx on public.games (rematch_of);

-- One rating per pool. While games < placement_games the player is
-- "unrated" (the number is a hidden running estimate); then
-- "provisional" until 20 games; then "established".
create table public.ratings (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  pool        text not null check (pool in ('bullet','blitz','rapid','daily')),
  rating      int not null default 1200,
  games       int not null default 0,
  wins        int not null default 0,
  losses      int not null default 0,
  draws       int not null default 0,
  peak        int,
  opp_sum     bigint not null default 0,    -- placement: sum of opponent ratings
  score_sum   numeric not null default 0,   -- placement: points scored
  updated_at  timestamptz not null default now(),
  primary key (user_id, pool)
);
create index ratings_pool_idx on public.ratings (pool, rating desc);

create table public.rating_history (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles(id) on delete cascade,
  pool            text not null,
  game_id         uuid references public.games(id) on delete set null,
  rating_before   int not null,
  rating_after    int not null,
  status_after    text not null,
  opponent_id     uuid references public.profiles(id) on delete set null,
  opponent_rating int not null,
  score           numeric not null,
  created_at      timestamptz not null default now()
);
create index rating_history_user_idx on public.rating_history (user_id, pool, id);
create index rating_history_game_idx on public.rating_history (game_id);
create index rating_history_opp_idx on public.rating_history (opponent_id);

-- Matchmaking queue (one open seek per player)
create table public.seeks (
  user_id      uuid primary key references public.profiles(id) on delete cascade,
  time_control text not null references public.time_controls(id),
  rated        boolean not null,
  russian_chat boolean not null default false,
  rating       int not null,
  game_id      uuid references public.games(id) on delete set null,
  created_at   timestamptz not null default now(),
  pinged_at    timestamptz not null default now()
);
create index seeks_tc_idx on public.seeks (time_control, rated);
create index seeks_game_idx on public.seeks (game_id);

create table public.challenges (
  id           uuid primary key default gen_random_uuid(),
  from_id      uuid not null references public.profiles(id) on delete cascade,
  to_id        uuid references public.profiles(id) on delete cascade,     -- null = open invite link
  invite_code  text unique,
  time_control text not null references public.time_controls(id),
  rated        boolean not null default false,
  russian_chat boolean not null default false,
  color        text not null default 'random' check (color in ('random','white','black')),
  status       text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired')),
  game_id      uuid references public.games(id) on delete set null,
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  expires_at   timestamptz not null default now() + interval '24 hours',
  check (from_id is distinct from to_id),
  check (to_id is not null or invite_code is not null)
);
create index challenges_to_idx on public.challenges (to_id, status);
create index challenges_from_idx on public.challenges (from_id, status);
create index challenges_game_idx on public.challenges (game_id);
create index challenges_tc_idx on public.challenges (time_control);
alter table public.games add constraint games_challenge_fk foreign key (challenge_id) references public.challenges(id) on delete set null;
create index games_challenge_idx on public.games (challenge_id);

create table public.game_messages (
  id         bigint generated always as identity primary key,
  game_id    uuid not null references public.games(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  body       text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now()
);
create index game_messages_game_idx on public.game_messages (game_id, id);
create index game_messages_user_idx on public.game_messages (user_id, created_at);

-- ---------------------------------------------------------------------
-- Achievements
-- ---------------------------------------------------------------------
create table public.achievements (
  id          text primary key,
  name        text not null,
  description text not null,
  category    text not null check (category in ('russian','chess','habit')),
  tier        text not null check (tier in ('bronze','silver','gold')),
  sort        int not null
);

create table public.user_achievements (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  earned_at      timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
create index user_achievements_ach_idx on public.user_achievements (achievement_id);

-- ---------------------------------------------------------------------
-- Safety
-- ---------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_id uuid references public.profiles(id) on delete set null,
  game_id     uuid references public.games(id) on delete set null,
  reason      text not null check (reason in ('cheating','harassment','inappropriate','spam','other')),
  details     text not null default '' check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open','reviewed','actioned','dismissed')),
  created_at  timestamptz not null default now()
);
create index reports_reporter_idx on public.reports (reporter_id, created_at);
create index reports_reported_idx on public.reports (reported_id);
create index reports_game_idx on public.reports (game_id);

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['app_config','plans','profiles','subscriptions','levels','lesson_categories','lessons','vocab',
    'tests','test_items','conversation_scenarios','pron_milestones','lesson_progress','test_attempts','srs_items',
    'saved_phrases','activity','speech_attempts','tutor_conversations','tutor_messages','time_controls','games',
    'ratings','rating_history','seeks','challenges','game_messages','achievements','user_achievements','blocks','reports']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- public reference data
create policy "plans: read" on public.plans for select to anon, authenticated using (active);
create policy "levels: read" on public.levels for select to anon, authenticated using (true);
create policy "categories: read" on public.lesson_categories for select to anon, authenticated using (true);
create policy "time controls: read" on public.time_controls for select to anon, authenticated using (true);
create policy "achievements: read" on public.achievements for select to anon, authenticated using (true);
grant select on public.plans, public.levels, public.lesson_categories, public.time_controls, public.achievements
  to anon, authenticated;

-- own rows
create policy "own profile: read" on public.profiles for select to authenticated using (id = (select public.app_uid()));
create policy "own profile: create" on public.profiles for insert to authenticated with check (id = (select public.app_uid()));
create policy "own profile: update" on public.profiles for update to authenticated
  using (id = (select public.app_uid())) with check (id = (select public.app_uid()));
grant select on public.profiles to authenticated;
grant insert (id, username, display_name, ru_level, ru_forms, learning_intensity, show_translit, speech_rate, voice,
              chess_experience, russian_chat, daily_goal_words, timezone, show_online)
  on public.profiles to authenticated;
-- ru_level is changed through set_ru_level() / tests, not directly
grant update (display_name, ru_forms, learning_intensity, show_translit, speech_rate, voice,
              chess_experience, russian_chat, daily_goal_words, timezone, show_online)
  on public.profiles to authenticated;

create policy "own subscription: read" on public.subscriptions for select to authenticated using (user_id = (select public.app_uid()));
create policy "own lesson progress: read" on public.lesson_progress for select to authenticated using (user_id = (select public.app_uid()));
create policy "own test attempts: read" on public.test_attempts for select to authenticated using (user_id = (select public.app_uid()));
create policy "own srs: read" on public.srs_items for select to authenticated using (user_id = (select public.app_uid()));
create policy "own phrases: read" on public.saved_phrases for select to authenticated using (user_id = (select public.app_uid()));
create policy "own activity: read" on public.activity for select to authenticated using (user_id = (select public.app_uid()));
create policy "own speech: read" on public.speech_attempts for select to authenticated using (user_id = (select public.app_uid()));
create policy "own conversations: read" on public.tutor_conversations for select to authenticated using (user_id = (select public.app_uid()));
create policy "own conversation messages: read" on public.tutor_messages for select to authenticated
  using (exists (select 1 from public.tutor_conversations c where c.id = conversation_id and c.user_id = (select public.app_uid())));
create policy "own ratings: read" on public.ratings for select to authenticated using (user_id = (select public.app_uid()));
create policy "own rating history: read" on public.rating_history for select to authenticated using (user_id = (select public.app_uid()));
create policy "own seek: read" on public.seeks for select to authenticated using (user_id = (select public.app_uid()));
create policy "own achievements: read" on public.user_achievements for select to authenticated using (user_id = (select public.app_uid()));
create policy "own blocks: read" on public.blocks for select to authenticated using (blocker_id = (select public.app_uid()));
create policy "my games: read" on public.games for select to authenticated
  using ((select public.app_uid()) in (white_id, black_id));
create policy "my challenges: read" on public.challenges for select to authenticated
  using ((select public.app_uid()) in (from_id, to_id));
create policy "my game chat: read" on public.game_messages for select to authenticated
  using (exists (select 1 from public.games g where g.id = game_id and (select public.app_uid()) in (g.white_id, g.black_id)));

grant select on public.subscriptions, public.lesson_progress, public.test_attempts, public.srs_items, public.saved_phrases,
  public.activity, public.speech_attempts, public.tutor_conversations, public.tutor_messages, public.ratings,
  public.rating_history, public.seeks, public.user_achievements, public.blocks, public.games, public.challenges,
  public.game_messages
  to authenticated;
-- lessons, vocab, tests, test_items, scenarios, milestones, app_config and reports:
-- no direct client access at all.

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table public.games, public.challenges, public.game_messages;

-- ---------------------------------------------------------------------
-- Internal helpers are not callable through the API
-- ---------------------------------------------------------------------
revoke execute on function public.require_uid(), public.local_day(uuid), public.profiles_before_write()
  from public, anon, authenticated;
revoke execute on function public.app_uid() from public, anon;
grant execute on function public.app_uid() to authenticated;
