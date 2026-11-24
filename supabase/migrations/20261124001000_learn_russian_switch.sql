-- Chess-only accounts: a player who just wants to play chess (for example a
-- friend invited to a game) turns this off and never sees Russian lessons,
-- in-game Russian or Russian onboarding. Defaults to on for everyone else.
alter table public.profiles add column if not exists learn_russian boolean not null default true;

grant insert (learn_russian) on public.profiles to authenticated;
grant update (learn_russian) on public.profiles to authenticated;
