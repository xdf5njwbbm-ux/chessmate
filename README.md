# Chessmate ♞♥

**Play first. Fall later.** A dating app where people match on personality, then meet over a game of chess. After the final move, a mutual like makes it a match.

Live site: https://xdf5njwbbm-ux.github.io/chessmate/

## What's built (phases 1–3)

| Area | Included |
| --- | --- |
| **Accounts** | Email + password sign-up and sign-in, email confirmation, password reset, 18+ age gate enforced in the database, account deletion |
| **Onboarding** | 10 guided steps: name, birthday and gender · who you want to meet (gender, age range, distance) · location (GPS, rounded to ~1 km, or city) · 3–6 photos · bio and dating intentions · chess experience, Elo (optional), favorite formats · interests · 22-question chess, fun and dating questionnaire |
| **Compatibility** | Server-side score (0–99%) from personality answers (40%), shared interests (20%), dating intentions (20%), communication style (10%) and chess playing style (10%). **Elo is never an input**: a 900 can be a 96% match with a 1500. |
| **Discover** | Feed sorted by compatibility, by similar Elo or by who's online, with filters for distance, age, Elo, experience, intentions and minimum compatibility. Only mutually compatible people appear (both sides' gender and age preferences). |
| **Profiles** | Photo carousel, compatibility ring, "why you match" (shared interests and answers), bio, intentions, personality tags, chess card (self-reported Elo, Chessmate rating, W–L–D, style, opening, formats), highlighted answers |
| **Challenges** | Choose 3 or 5 min blitz, 10 or 15 min rapid, or correspondence (3 days per move), casual or competitive. Real-time notifications when you're challenged, accepted or declined. Challenges expire after 24 hours and are rate-limited. |
| **Live chess** | Server-authoritative moves (every move is validated by chess.js on the server), drag or tap to move, legal-move hints, check highlighting, castling, en passant, promotion picker, check/checkmate/stalemate/insufficient material/threefold/50-move detection, server-side clocks (each side's first move is untimed), timeout claims, abort, resign, draw offers, move list, material count, real-time sync with polling fallback |
| **After the game** | Result screen with rating change, private like/pass (they only find out if it's mutual), "It's a match" celebration, rematch offers with colors swapped |
| **Matches** | Grid of mutual matches, unmatch |
| **Safety & privacy** | Block (cancels challenges, ends games, hides both ways), report with reasons, hide from Discover, hide online status, hide distance. Birthdates and coordinates never leave the database. |

Coming next (phase 4): messaging, push notifications and optional in-game voice chat (WebRTC).

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, react-chessboard, chess.js, self-hosted Inter and Fraunces fonts. Mobile-first, installable to the home screen.
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime, Edge Functions).
- **Hosting:** GitHub Pages, deployed by GitHub Actions on every push to `main`.

## Security model

- **Row level security everywhere.** You can only read your own profile, answers, likes and blocks directly. Everything about other people comes from `SECURITY DEFINER` functions that return safe, derived fields: age (not birthdate), rounded distance (not coordinates), and compatibility.
- **Column-level grants.** You can't write your rating, games played, onboarding status or birthdate (after sign-up).
- **Server-authoritative games.** Clients can't write to `games`. Every action goes through the `game` edge function, which replays the game with chess.js, checks turn order, legality and clocks, and saves with an optimistic version check so simultaneous requests can't both apply.
- **Ratings** change only when a competitive game finishes on the server (Elo, K=40 for your first 20 rated games, then K=20). The self-reported Elo is a separate field.
- **Photos** live in a private bucket. Members see them through short-lived signed URLs and can only write to their own folder. Uploads are resized and re-encoded in the browser, which strips EXIF and GPS data.
- **Anonymous sessions** are rejected by every policy and function (`app_uid()`).

## Project layout

```
src/
  pages/          Landing, Auth, Onboarding, Discover, ProfileView, Games, Game, Matches, Me, EditProfile, Settings
  components/     UI kit, profile steps, challenge/report sheets, cards, match celebration
  state/          session (auth + profile), live (realtime + inbox), toasts
  lib/            supabase client, API wrappers, photo upload/signing, types, constants
supabase/
  migrations/     schema, questionnaire seed, server functions, storage
  functions/game/ edge function + pure game logic + tests
.github/workflows/deploy.yml
```

## Develop

```bash
npm install
npm run dev          # http://localhost:5173/chessmate/
npm run test:chess   # 23 chess-rule and clock tests for the game server
npm run build
```

Deploy the edge function after changing `supabase/functions/game`:

```bash
supabase functions deploy game --project-ref dmynmniiapfrpzfxgqwn
```

## One-time setup checklist

1. **GitHub Pages:** Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. **Supabase Auth → URL Configuration:** set Site URL to `https://xdf5njwbbm-ux.github.io/chessmate/` and add it to Redirect URLs (confirmation and reset links land there).
3. **Supabase Auth → Emails → SMTP:** add a custom SMTP provider (e.g. Resend). The built-in sender is heavily rate-limited and not meant for real users.
4. **Supabase Auth → Providers:** turn **off** anonymous sign-ins (leftover from the old flashcard app) and turn **on** leaked password protection.
