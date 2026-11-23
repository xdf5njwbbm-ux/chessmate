-- =====================================================================
-- Chessmate — core schema
-- Tables, constraints, triggers, row level security and column grants.
-- Clients may only read their own rows directly; everything about other
-- users is served by SECURITY DEFINER functions (see rpc migration) that
-- never return birthdates, exact coordinates or other private fields.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Identity helper: the signed-in, non-anonymous user (null otherwise)
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

create or replace function public.age_years(d date) returns int
language sql stable
set search_path = ''
as $$ select extract(year from age(current_date, d))::int $$;

create or replace function public.distance_km(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision
language sql immutable
set search_path = ''
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

create or replace function public.tc_initial_ms(tc text) returns bigint
language sql immutable
set search_path = ''
as $$
  select (case tc
    when 'blitz3' then 180000
    when 'blitz5' then 300000
    when 'rapid10' then 600000
    when 'rapid15' then 900000
    when 'correspondence' then 259200000   -- 3 days per move
  end)::bigint
$$;

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  first_name          text not null check (char_length(first_name) between 1 and 30),
  birthdate           date not null,
  gender              text not null check (gender in ('woman','man','nonbinary')),
  interested_in       text[] not null default '{}'
                      check (interested_in <@ array['woman','man','nonbinary']),
  city                text check (city is null or char_length(city) <= 60),
  lat                 double precision check (lat is null or lat between -90 and 90),
  lng                 double precision check (lng is null or lng between -180 and 180),
  max_distance_km     int not null default 80 check (max_distance_km between 1 and 20000),
  age_min             int not null default 18 check (age_min between 18 and 99),
  age_max             int not null default 60 check (age_max between 18 and 120),
  bio                 text not null default '' check (char_length(bio) <= 500),
  intentions          text check (intentions in ('serious','casual','friendship','unsure')),
  elo                 int check (elo between 100 and 3500),
  experience          text check (experience in ('beginner','intermediate','advanced','competitive')),
  formats             text[] not null default '{}'
                      check (formats <@ array['blitz3','blitz5','rapid10','rapid15','correspondence']),
  interests           text[] not null default '{}'
                      check (cardinality(interests) <= 12 and interests <@ array[
                        'Travel','Music','Movies','Fitness','Cooking','Reading','Gaming','Hiking',
                        'Art','Coffee','Photography','Tech','Fashion','Dogs','Cats','Sports',
                        'Dancing','Wine','Podcasts','Puzzles','Anime','Yoga','Live music','Foodie',
                        'Writing','Board games','Nature','Science']),
  photos              text[] not null default '{}' check (cardinality(photos) <= 6),
  discoverable        boolean not null default true,
  show_online         boolean not null default true,
  show_distance       boolean not null default true,
  onboarding_complete boolean not null default false,   -- computed by trigger
  app_rating          int not null default 1200,         -- server-managed
  rated_games         int not null default 0,            -- server-managed
  last_seen           timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (age_min <= age_max)
);

create or replace function public.profiles_before_write() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p text;
begin
  new.first_name := btrim(new.first_name);
  new.city := nullif(btrim(coalesce(new.city, '')), '');
  new.bio := btrim(coalesce(new.bio, ''));

  if new.birthdate > (current_date - interval '18 years')::date then
    raise exception 'You must be 18 or older to use Chessmate.' using errcode = '22023';
  end if;
  if new.birthdate < date '1900-01-01' then
    raise exception 'Please enter a valid date of birth.' using errcode = '22023';
  end if;

  if (new.lat is null) <> (new.lng is null) then
    raise exception 'Location must include both latitude and longitude.' using errcode = '22023';
  end if;
  -- store only approximate location (~1 km)
  if new.lat is not null then
    new.lat := round(new.lat::numeric, 2)::double precision;
    new.lng := round(new.lng::numeric, 2)::double precision;
  end if;

  foreach p in array new.photos loop
    if p !~ ('^' || new.id::text || '/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$') then
      raise exception 'Invalid photo.' using errcode = '22023';
    end if;
  end loop;

  select coalesce(array_agg(distinct x), '{}') into new.interested_in from unnest(new.interested_in) x;
  select coalesce(array_agg(distinct x), '{}') into new.formats from unnest(new.formats) x;
  select coalesce(array_agg(s.x order by s.min_ord), '{}') into new.interests
    from (select t.x, min(t.ord) as min_ord from unnest(new.interests) with ordinality as t(x, ord) group by t.x) s;

  if tg_op = 'INSERT' then
    new.app_rating := case when new.elo is null then 1200 else greatest(600, least(2400, new.elo)) end;
    new.rated_games := 0;
    new.created_at := now();
  end if;

  new.onboarding_complete :=
        cardinality(new.interested_in) > 0
    and new.intentions is not null
    and new.experience is not null
    and cardinality(new.photos) >= 3
    and (new.city is not null or new.lat is not null);

  new.updated_at := now();
  return new;
end
$$;

create trigger profiles_before_write
before insert or update on public.profiles
for each row execute function public.profiles_before_write();

-- ---------------------------------------------------------------------
-- Questionnaire
-- ---------------------------------------------------------------------
create table public.questions (
  id          text primary key,
  section     text not null check (section in ('chess','fun','dating')),
  prompt      text not null,
  kind        text not null check (kind in ('single','multi')),
  options     jsonb not null,              -- [{"v": value, "l": label}, ...]
  ordinal     boolean not null default false,
  dimension   text not null check (dimension in ('personality','communication','chess_style')),
  weight      numeric not null default 1,
  max_select  int not null default 1,
  sort        int not null
);

create table public.answers (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  question_id text not null references public.questions(id) on delete cascade,
  answer      text[] not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, question_id)
);

create or replace function public.answers_before_write() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  q public.questions;
  v text;
begin
  select * into q from public.questions where id = new.question_id;
  if not found then
    raise exception 'Unknown question.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct x), '{}') into new.answer from unnest(new.answer) x;
  if cardinality(new.answer) < 1 or cardinality(new.answer) > q.max_select then
    raise exception 'Invalid number of choices.' using errcode = '22023';
  end if;
  foreach v in array new.answer loop
    if not exists (select 1 from jsonb_array_elements(q.options) o where o ->> 'v' = v) then
      raise exception 'Invalid choice.' using errcode = '22023';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end
$$;

create trigger answers_before_write
before insert or update on public.answers
for each row execute function public.answers_before_write();

-- ---------------------------------------------------------------------
-- Safety: blocks and reports
-- ---------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create table public.reports (
  id          bigint generated always as identity primary key,
  reporter_id uuid references auth.users(id) on delete set null,
  reported_id uuid references auth.users(id) on delete set null,
  game_id     uuid,
  reason      text not null check (reason in ('fake','inappropriate','harassment','underage','spam','cheating','other')),
  details     text not null default '' check (char_length(details) <= 1000),
  status      text not null default 'open' check (status in ('open','reviewed','actioned','dismissed')),
  created_at  timestamptz not null default now()
);
create index reports_reporter_idx on public.reports (reporter_id, created_at);

-- ---------------------------------------------------------------------
-- Challenges and games
-- ---------------------------------------------------------------------
create table public.challenges (
  id           uuid primary key default gen_random_uuid(),
  from_id      uuid not null references public.profiles(id) on delete cascade,
  to_id        uuid not null references public.profiles(id) on delete cascade,
  time_control text not null check (time_control in ('blitz3','blitz5','rapid10','rapid15','correspondence')),
  mode         text not null check (mode in ('casual','competitive')),
  status       text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired')),
  game_id      uuid,
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (from_id <> to_id)
);
create unique index challenges_one_pending_per_pair
  on public.challenges (least(from_id, to_id), greatest(from_id, to_id)) where status = 'pending';
create index challenges_to_idx on public.challenges (to_id, status);
create index challenges_from_idx on public.challenges (from_id, status);

create table public.games (
  id                 uuid primary key default gen_random_uuid(),
  white_id           uuid references auth.users(id) on delete set null,
  black_id           uuid references auth.users(id) on delete set null,
  time_control       text not null check (time_control in ('blitz3','blitz5','rapid10','rapid15','correspondence')),
  mode               text not null check (mode in ('casual','competitive')),
  initial_ms         bigint not null,
  increment_ms       int not null default 0,
  per_move           boolean not null default false,
  status             text not null default 'active' check (status in ('active','finished','aborted')),
  result             text check (result in ('1-0','0-1','1/2-1/2')),
  termination        text check (termination in ('checkmate','resign','timeout','stalemate','insufficient',
                                                 'threefold','fifty_move','agreement','abort','timeout_vs_insufficient')),
  fen                text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves              text[] not null default '{}',   -- UCI
  sans               text[] not null default '{}',   -- SAN, same length as moves
  white_ms           bigint not null,
  black_ms           bigint not null,
  turn_started_at    timestamptz not null default now(),
  draw_offer_from    uuid,
  rematch_offer_from uuid,
  rematch_of         uuid references public.games(id) on delete set null,
  next_game_id       uuid references public.games(id) on delete set null,
  challenge_id       uuid references public.challenges(id) on delete set null,
  white_rating       int,
  black_rating       int,
  white_delta        int,
  black_delta        int,
  version            int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  finished_at        timestamptz,
  check (white_id is distinct from black_id)
);
create index games_white_idx on public.games (white_id, status);
create index games_black_idx on public.games (black_id, status);

-- ---------------------------------------------------------------------
-- Likes and matches
-- ---------------------------------------------------------------------
create table public.likes (
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  game_id    uuid references public.games(id) on delete set null,
  liked      boolean not null,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index likes_to_idx on public.likes (to_id);

create table public.matches (
  user_a     uuid not null references public.profiles(id) on delete cascade,
  user_b     uuid not null references public.profiles(id) on delete cascade,
  game_id    uuid references public.games(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index matches_b_idx on public.matches (user_b);

-- ---------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.questions  enable row level security;
alter table public.answers    enable row level security;
alter table public.blocks     enable row level security;
alter table public.reports    enable row level security;
alter table public.challenges enable row level security;
alter table public.games      enable row level security;
alter table public.likes      enable row level security;
alter table public.matches    enable row level security;

create policy "own profile: read"   on public.profiles for select to authenticated using (id = (select public.app_uid()));
create policy "own profile: create" on public.profiles for insert to authenticated with check (id = (select public.app_uid()));
create policy "own profile: update" on public.profiles for update to authenticated
  using (id = (select public.app_uid())) with check (id = (select public.app_uid()));

create policy "questions: read" on public.questions for select to anon, authenticated using (true);

create policy "own answers: read"   on public.answers for select to authenticated using (user_id = (select public.app_uid()));
create policy "own answers: create" on public.answers for insert to authenticated with check (user_id = (select public.app_uid()));
create policy "own answers: update" on public.answers for update to authenticated
  using (user_id = (select public.app_uid())) with check (user_id = (select public.app_uid()));
create policy "own answers: delete" on public.answers for delete to authenticated using (user_id = (select public.app_uid()));

create policy "own blocks: read" on public.blocks for select to authenticated using (blocker_id = (select public.app_uid()));

create policy "my challenges: read" on public.challenges for select to authenticated
  using ((select public.app_uid()) in (from_id, to_id));

create policy "my games: read" on public.games for select to authenticated
  using ((select public.app_uid()) in (white_id, black_id));

create policy "my likes: read" on public.likes for select to authenticated using (from_id = (select public.app_uid()));

create policy "my matches: read" on public.matches for select to authenticated
  using ((select public.app_uid()) in (user_a, user_b));

-- reports: no client policies (insert happens through report_user())

-- ---------------------------------------------------------------------
-- Table privileges (Supabase grants ALL by default — tighten it)
-- ---------------------------------------------------------------------
revoke all on public.profiles, public.questions, public.answers, public.blocks, public.reports,
              public.challenges, public.games, public.likes, public.matches
  from anon, authenticated;

grant select on public.questions to anon, authenticated;
grant select on public.profiles, public.blocks, public.challenges, public.games, public.likes, public.matches
  to authenticated;
grant select, insert, update, delete on public.answers to authenticated;

-- profile columns a user may write (server-managed columns are excluded;
-- birthdate is set once at sign-up and cannot be changed afterwards)
grant insert (id, first_name, birthdate, gender, interested_in, city, lat, lng, max_distance_km,
              age_min, age_max, bio, intentions, elo, experience, formats, interests, photos,
              discoverable, show_online, show_distance)
  on public.profiles to authenticated;
grant update (first_name, gender, interested_in, city, lat, lng, max_distance_km, age_min, age_max,
              bio, intentions, elo, experience, formats, interests, photos,
              discoverable, show_online, show_distance)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;
alter publication supabase_realtime add table public.challenges, public.games, public.matches;

-- helper functions are internal
revoke execute on function public.age_years(date), public.distance_km(double precision, double precision, double precision, double precision),
  public.tc_initial_ms(text), public.profiles_before_write(), public.answers_before_write()
  from public, anon, authenticated;
grant execute on function public.app_uid() to authenticated;
revoke execute on function public.app_uid() from public, anon;
