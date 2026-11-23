-- Covering indexes for foreign keys (keeps cascading deletes and joins fast as data grows)
create index if not exists answers_question_idx  on public.answers (question_id);
create index if not exists games_challenge_idx   on public.games (challenge_id);
create index if not exists games_next_game_idx   on public.games (next_game_id);
create index if not exists games_rematch_of_idx  on public.games (rematch_of);
create index if not exists likes_game_idx        on public.likes (game_id);
create index if not exists matches_game_idx      on public.matches (game_id);
create index if not exists reports_reported_idx  on public.reports (reported_id);
