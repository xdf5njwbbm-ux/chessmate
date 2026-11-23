# Curriculum source

Everything a learner reads in Learn, Practice and the level tests is written here and compiled into
`supabase/migrations/20261124000500_curriculum_seed.sql` by `npm run content`.

## Lesson files (`a1.txt` … `b2.txt`)

```
# lesson a1-01 | greetings | Hello! | Привет!
summary: One line shown in the lesson list.
intro: A short paragraph shown before the lesson starts.

## dialogue: Title of the section          (or "## phrases: Title")
Анна: Привет!|Hi! Как|how дела?|(are)_things = Hi! How are you?
  > Optional note about the line above.
@formal Здравствуйте!|hello = Hello! (formal)

## grammar: Title
A paragraph of explanation. **bold** is allowed.
ex: Я играю. = I play.

## drills
? Я ___ в шахматы. | играю | играешь, играет, играют | I play chess.

## vocab
привЕт | hi | interjection | optional note
```

* A sentence line is `tokens = English`. Each token is `russian|gloss`; underscores in a gloss are spaces.
  A token without `|` (for example a dash) has no gloss.
* `хотел{хотела}|wanted` gives the masculine and feminine forms of a word. The app shows the form the
  learner chose in Settings and lets them reveal the other.
* `@formal`, `@informal` and `@spoken` mark register.
* In vocab, the stressed vowel is written in capitals (`пЕшка` → пе́шка). `^` capitalises the word.

## Other files

* `tests.txt` — placement and level tests (`*` marks the correct option).
* `scenarios.txt` — guided conversations (used when the AI tutor is off) and AI tutor scenarios.
* `pronunciation.txt` — pronunciation milestones A1–B2.
