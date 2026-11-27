# Russian Chess Academy

Learn Russian from A1 to B2 while playing real chess. Every move you make comes with a short Russian phrase pitched at your level, and there's a full course alongside the games: lessons, spaced review, listening, pronunciation and conversation practice.

Live site: https://xdf5njwbbm-ux.github.io/chessmate/

## What's in it

- **Chess.** Full rules (chess.js), clocks, draw offers, resignations, rematches, friend challenges, invite links, Elo matchmaking and leaderboards. There's a separate rating for each time-control pool (bullet, blitz, rapid, daily).
- **Stockfish bot.** Stockfish 18 runs in the browser. You can pick its strength from 100 to 3000. Bot games are practice and never change your rating. Undo and analysis are available.
- **Russian on every move.** A learning panel next to the board, with three intensities (Quick, Standard, Deep). Each card has audio at 1×, 0.75× and 0.5×, a transliteration, an English translation, the vocabulary, a grammar note and a mini exercise.
- **Course.** 56 lessons across 25 everyday topics plus chess talk, A1–B2. Every sentence has a word-by-word gloss, stress marks, masculine and feminine forms, and the ты/вы register. There's a placement test, level tests, SM‑2 spaced review, vocabulary, a listening drill and daily objectives.
- **Speaking.** Neural Russian voices and pronunciation scoring through Azure Speech when it's configured. Otherwise the device's own voices and speech recognition are used, and they're labelled honestly: no invented scores.
- **Conversation partner.** An AI tutor (Claude) that holds conversations in 25 scenarios and corrects you gently. Without an API key it falls back to scripted, guided conversations.
- **AI Voice Practice.** A real voice call with a native Russian tutor (Аня or Миша): you just talk, and the tutor listens, answers and corrects you live. Three modes (beginner guided, natural, immersion), a 20-topic conversation curriculum, a live transcript with translations, stress marks and a pronunciation guide, replay and slow-down, a post-call report with scores and a personal review lesson, and long-term memory of what you've said, the words you know and the mistakes you make. The speaking level (A1–C1) only rises when your calls show it.
- **Two progressions, never mixed.** Your Russian level and your chess rating are stored and shown separately.

## Stack

React 19 + Vite + TypeScript + Tailwind v4, react-chessboard, chess.js, Stockfish 18 (WASM, GPLv3; see `public/engine/`). The backend is Supabase: Postgres with row level security, SQL functions and three Deno edge functions.

```
src/                    app (pages, components, lib, state)
content/                course source text (A1–B2 lessons, tests, scenarios, pronunciation)
scripts/build-content.mjs  validates content and generates the seed migration
supabase/migrations/    schema, functions, config, generated curriculum seed
supabase/functions/     game (server-validated moves, AI game records), speech (TTS + assessment), tutor (AI partner),
                        voice (AI Voice Practice: realtime call setup, turn analysis, reports)
supabase/tests/         SQL tests for ratings, matchmaking and learning
```

## How ratings work

- Only rated games between people change Elo. Stockfish games are recorded as unrated, whatever the result.
- The first 5 rated games in a pool are placement games. The rating is a performance rating, with one virtual draw against 1200 so a single result can't swing it wildly. It's shown after the fifth game.
- After placement: K=40 while provisional (under 20 games, shown as `1534?`), then K=20, and K=10 from 2400. Floor of 100. The peak rating is tracked after placement.
- Every move in an online game is validated on the server by the `game` edge function. A rating is applied exactly once, when the game finishes.

## Security model

- Clients can only read their own private rows. Everything else goes through `security definer` SQL functions that check the caller (`require_uid()`), validate input and enforce plan limits.
- Profiles have column-level grants, so the Russian level, streaks and plan can't be written directly.
- Edge functions use the service role only on the server. Secrets never reach the browser.

## Plans

The Free and Premium plans live in the `plans` table, and their features are JSON (levels, daily reviews, saved phrases, AI tutor, scoring and so on). Prices aren't hard-coded. While `app_config.paywall_enabled` is `false`, everyone gets Premium ("early access"). To turn billing on, set prices in `plans` and flip that flag.

## Configuration

Add these in Supabase → Edge Functions → Secrets:

| Secret | Purpose |
| --- | --- |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Neural voices and pronunciation scoring (optional) |
| `ANTHROPIC_API_KEY` | AI conversation partner (optional) |
| `TUTOR_MODEL` | Override the tutor model (optional) |
| `OPENAI_API_KEY` | AI Voice Practice: the realtime voice call, transcript analysis, reports and the tutor's voice for replays |
| `VOICE_MODEL`, `VOICE_TEXT_MODEL`, `VOICE_TRANSCRIBE_MODEL`, `VOICE_TTS_MODEL`, `VOICE_REASONING` | Override the voice models (optional; defaults `gpt-realtime-2.1`, `gpt-5.4-mini`, `gpt-transcribe`, `gpt-4o-mini-tts`, `low`) |

Without them, the app uses device voices, recognition-based feedback and guided conversations. AI Voice Practice needs `OPENAI_API_KEY`; daily call time per account is `app_config.voice_daily_minutes` (default 60).

### How a voice call works

The browser opens a WebRTC connection straight to OpenAI's Realtime API: the microphone goes up as a live audio track, the tutor's voice comes back as one, and a data channel carries transcripts and turn-taking events. The `voice` edge function builds the tutor's instructions on the server (level, mode, lesson, memory) and signs the connection with the API key, so no secret reaches the browser. Semantic turn detection decides when you've finished speaking, so there are no buttons between sentences. Each line of the transcript is annotated by a text model (translation, stress, pronunciation guide, corrections), and when the call ends the function writes the report, evaluates the speaking level, updates the tutor's memory and adds your corrected sentences and known words to Review.

## Development

```bash
npm ci
npm run dev           # app on http://localhost:5173
npm test              # content check, chess rule tests, phrase tests
npm run content       # rebuild supabase/migrations/*_curriculum_seed.sql from content/
npm run build
```

The SQL tests in `supabase/tests/` run against a database with the migrations applied (`psql -f supabase/tests/chess.test.sql`).

Every push to `main` runs the tests, builds the app and deploys it to GitHub Pages.
