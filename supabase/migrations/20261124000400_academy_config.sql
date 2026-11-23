-- =====================================================================
-- Russian Chess Academy — configuration and reference data
-- Prices are intentionally null: set them here (or in the table editor)
-- when billing goes live, then flip paywall_enabled to true.
-- =====================================================================

insert into public.app_config (key, value) values
  ('paywall_enabled', 'false'),
  ('placement_games', '5')
on conflict (key) do update set value = excluded.value, updated_at = now();

insert into public.plans (id, name, tagline, features, price_cents, currency, billing_interval, sort) values
  ('free', 'Free', 'Start speaking and playing',
   '{"levels":["A1"],"daily_reviews":40,"saved_phrases":50,"deep_learning":false,"full_analysis":false,
     "ai_tutor":false,"neural_voices":false,"pronunciation_scoring":false,"advanced_stats":false,"personal_plan":false}',
   0, null, null, 1),
  ('premium', 'Premium', 'The full A1–B2 academy',
   '{"levels":["A1","A2","B1","B2"],"daily_reviews":null,"saved_phrases":null,"deep_learning":true,"full_analysis":true,
     "ai_tutor":true,"neural_voices":true,"pronunciation_scoring":true,"advanced_stats":true,"personal_plan":true}',
   null, null, 'month', 2)
on conflict (id) do update set name = excluded.name, tagline = excluded.tagline, features = excluded.features, sort = excluded.sort;

insert into public.levels (code, name, description, sort) values
  ('A1', 'Beginner', 'Greetings, introductions, everyday basics and the names of the pieces.', 1),
  ('A2', 'Elementary', 'Everyday conversations, past and future, describing your moves and asking why.', 2),
  ('B1', 'Intermediate', 'Opinions, feelings, conditionals and explaining your strategy.', 3),
  ('B2', 'Upper-intermediate', 'Nuanced, natural Russian: complex sentences, participles and real analysis.', 4)
on conflict (code) do update set name = excluded.name, description = excluded.description, sort = excluded.sort;

insert into public.lesson_categories (id, name, grp, sort) values
  ('essentials',  'Essential Russian',            'everyday', 1),
  ('greetings',   'Greetings & introductions',    'everyday', 2),
  ('meeting',     'Meeting new people',           'everyday', 3),
  ('friends',     'Making friends',               'everyday', 4),
  ('family',      'Family & relationships',       'everyday', 5),
  ('dating',      'Dating & communication',       'everyday', 6),
  ('work',        'Work & careers',               'everyday', 7),
  ('shopping',    'Shopping & stores',            'everyday', 8),
  ('restaurants', 'Restaurants & ordering',       'everyday', 9),
  ('cooking',     'Cooking & groceries',          'everyday', 10),
  ('travel',      'Travel & transportation',      'everyday', 11),
  ('hotels',      'Hotels & accommodation',       'everyday', 12),
  ('fitness',     'Gym & fitness',                'everyday', 13),
  ('health',      'Health & appointments',        'everyday', 14),
  ('weather',     'Weather & seasons',            'everyday', 15),
  ('hobbies',     'Hobbies & interests',          'everyday', 16),
  ('movies',      'Movies & entertainment',       'everyday', 17),
  ('routines',    'Daily routines',               'everyday', 18),
  ('money',       'Money & finances',             'everyday', 19),
  ('emotions',    'Expressing emotions',          'everyday', 20),
  ('plans',       'Making plans',                 'everyday', 21),
  ('directions',  'Asking for directions',        'everyday', 22),
  ('phone',       'Telephone conversations',      'everyday', 23),
  ('opinions',    'Opinions & ideas',             'everyday', 24),
  ('problems',    'Problems & disagreements',     'everyday', 25),
  ('smalltalk',   'Small talk',                   'everyday', 26),
  ('numbers',     'Numbers & time',               'everyday', 27),
  ('chess_vocab', 'Chess vocabulary',             'chess',    40),
  ('chess_talk',  'Chess conversations',          'chess',    41),
  ('grammar',     'Russian grammar',              'grammar',  50),
  ('sounds',      'Pronunciation',                'pronunciation', 60)
on conflict (id) do update set name = excluded.name, grp = excluded.grp, sort = excluded.sort;

insert into public.time_controls (id, label, pool, initial_ms, increment_ms, per_move, ai_only, sort) values
  ('bullet1',    '1 min',        'bullet',  60000,      0,     false, false, 1),
  ('bullet2_1',  '2 | 1',        'bullet',  120000,     1000,  false, false, 2),
  ('blitz3',     '3 min',        'blitz',   180000,     0,     false, false, 3),
  ('blitz3_2',   '3 | 2',        'blitz',   180000,     2000,  false, false, 4),
  ('blitz5',     '5 min',        'blitz',   300000,     0,     false, false, 5),
  ('rapid10',    '10 min',       'rapid',   600000,     0,     false, false, 6),
  ('rapid15_10', '15 | 10',      'rapid',   900000,     10000, false, false, 7),
  ('rapid30',    '30 min',       'rapid',   1800000,    0,     false, false, 8),
  ('daily',      '1 day / move', 'daily',   86400000,   0,     true,  false, 9),
  ('untimed',    'No clock',     'untimed', 0,          0,     false, true,  10)
on conflict (id) do update set label = excluded.label, pool = excluded.pool, initial_ms = excluded.initial_ms,
  increment_ms = excluded.increment_ms, per_move = excluded.per_move, ai_only = excluded.ai_only, sort = excluded.sort;

insert into public.achievements (id, name, description, category, tier, sort) values
  ('first_lesson',    'First lesson',        'Complete your first Russian lesson.',                  'russian', 'bronze', 1),
  ('lessons_10',      'Steady learner',      'Complete 10 lessons.',                                 'russian', 'silver', 2),
  ('lessons_30',      'Scholar',             'Complete 30 lessons.',                                 'russian', 'gold',   3),
  ('words_50',        '50 words',            'Add 50 words to your vocabulary.',                     'russian', 'bronze', 4),
  ('words_250',       '250 words',           'Add 250 words to your vocabulary.',                    'russian', 'silver', 5),
  ('words_500',       '500 words',           'Add 500 words to your vocabulary.',                    'russian', 'gold',   6),
  ('reviews_100',     'Memory builder',      'Complete 100 spaced-repetition reviews.',              'russian', 'bronze', 7),
  ('reviews_1000',    'Total recall',        'Complete 1,000 reviews.',                              'russian', 'gold',   8),
  ('speaker_25',      'Finding your voice',  'Practice pronunciation 25 times.',                     'russian', 'bronze', 9),
  ('speaker_250',     'Confident speaker',   'Practice pronunciation 250 times.',                    'russian', 'gold',   10),
  ('conversation_20', 'Conversationalist',   'Send 20 replies in practice conversations.',           'russian', 'silver', 11),
  ('level_a1',        'A1 certified',        'Pass the A1 level test.',                              'russian', 'bronze', 12),
  ('level_a2',        'A2 certified',        'Pass the A2 level test.',                              'russian', 'silver', 13),
  ('level_b1',        'B1 certified',        'Pass the B1 level test.',                              'russian', 'gold',   14),
  ('level_b2',        'B2 certified',        'Pass the B2 level test.',                              'russian', 'gold',   15),
  ('streak_3',        'Three in a row',      'Study three days in a row.',                           'habit',   'bronze', 20),
  ('streak_7',        'A full week',         'Keep a 7-day learning streak.',                        'habit',   'silver', 21),
  ('streak_30',       'Unstoppable',         'Keep a 30-day learning streak.',                       'habit',   'gold',   22),
  ('first_game',      'First game',          'Finish your first game.',                              'chess',   'bronze', 30),
  ('first_win',       'First victory',       'Win a game.',                                          'chess',   'bronze', 31),
  ('first_rated_win', 'Rated win',           'Win a rated game.',                                    'chess',   'silver', 32),
  ('placed',          'On the ladder',       'Finish your placement games and get a rating.',        'chess',   'bronze', 33),
  ('games_50',        'Regular',             'Finish 50 games.',                                     'chess',   'silver', 34),
  ('games_250',       'Veteran',             'Finish 250 games.',                                    'chess',   'gold',   35),
  ('rating_800',      '800',                 'Reach a rating of 800.',                               'chess',   'bronze', 40),
  ('rating_1000',     '1000',                'Reach a rating of 1000.',                              'chess',   'bronze', 41),
  ('rating_1200',     '1200',                'Reach a rating of 1200.',                              'chess',   'silver', 42),
  ('rating_1400',     '1400',                'Reach a rating of 1400.',                              'chess',   'silver', 43),
  ('rating_1600',     '1600',                'Reach a rating of 1600.',                              'chess',   'gold',   44),
  ('rating_1800',     '1800',                'Reach a rating of 1800.',                              'chess',   'gold',   45),
  ('rating_2000',     '2000',                'Reach a rating of 2000.',                              'chess',   'gold',   46),
  ('rating_2200',     '2200',                'Reach a rating of 2200.',                              'chess',   'gold',   47)
on conflict (id) do update set name = excluded.name, description = excluded.description, category = excluded.category,
  tier = excluded.tier, sort = excluded.sort;
