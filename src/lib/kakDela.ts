// "Как дела?" — 100 ways to answer "How are you?", in 10 categories.
// Every phrase has a level, a tone (who it's right for) and a note on when to
// use it. Gendered phrases say who says them and give the other form.

export type KdLevel = "A1" | "A2" | "B1" | "B2";
export type Tone = "formal" | "neutral" | "casual" | "romantic" | "funny";

export type KdPhrase = {
  n: number;
  cat: number;
  ru: string;
  en: string;
  level: KdLevel;
  tone: Tone;
  note: string;
  /** Who says it, when the form depends on the speaker. */
  speaker?: "m" | "f";
  /** The same phrase as the other gender would say it. */
  other?: string;
  /** Romantic phrases that change with the person you're talking to: the form for a man. */
  toMan?: string;
};

export const CATEGORIES: { id: number; title: string; ru: string; blurb: string }[] = [
  { id: 1, title: "I'm good", ru: "Всё хорошо", blurb: "The everyday answers — from a polite «хорошо, спасибо» to an excited «лучше не бывает»." },
  { id: 2, title: "I'm doing better", ru: "Уже лучше", blurb: "After an illness or a hard time, when the other person knows something was wrong." },
  { id: 3, title: "Average, nothing special", ru: "Нормально", blurb: "What Russians really say most of the time. «Нормально» is not negative." },
  { id: 4, title: "Tired or busy", ru: "Устал", blurb: "Long day, lots of work. Many of these change with who's speaking." },
  { id: 5, title: "Happy and excited", ru: "Я счастлив", blurb: "Good news, a great mood, a great day." },
  { id: 6, title: "Not a great day", ru: "Не очень", blurb: "Honest answers for people you trust — expect them to ask what happened." },
  { id: 7, title: "Romantic", ru: "Для любимого человека", blurb: "For your partner only. Several change with who you're talking to." },
  { id: 8, title: "Funny and playful", ru: "С юмором", blurb: "Jokes Russians actually make — mostly for friends." },
  { id: 9, title: "Natural, relaxed", ru: "Как в жизни", blurb: "Short, real-life answers you'll hear every day." },
  { id: 10, title: "More advanced", ru: "Посложнее", blurb: "Longer B1–B2 answers that sound thoughtful and adult." },
];

export const TONES: Record<Tone, { label: string; who: string; cls: string }> = {
  formal: { label: "Polished", who: "Good with your boss, clients and anyone you call вы.", cls: "text-sky border-sky/30 bg-sky/10" },
  neutral: { label: "Everyday", who: "Safe with anyone — friends, coworkers, neighbours.", cls: "text-accent-soft border-accent/30 bg-accent/10" },
  casual: { label: "Casual", who: "Friends and family.", cls: "text-fog border-white/15 bg-white/[0.06]" },
  romantic: { label: "Romantic", who: "Your partner only.", cls: "text-[#ff9ec4] border-[#ff9ec4]/30 bg-[#ff9ec4]/10" },
  funny: { label: "Funny", who: "Friends and relaxed coworkers.", cls: "text-gold border-gold/30 bg-gold/10" },
};

/** Asking back is half the conversation. */
export const ASK_BACK = [
  { ru: "А у тебя?", en: "And you? (to a friend — ты)" },
  { ru: "А у вас?", en: "And you? (polite — вы)" },
  { ru: "А ты как?", en: "And how are you? (casual)" },
];

const p = (n: number, cat: number, ru: string, en: string, level: KdLevel, tone: Tone, note: string, extra: Partial<KdPhrase> = {}): KdPhrase => ({ n, cat, ru, en, level, tone, note, ...extra });

export const PHRASES: KdPhrase[] = [
  // 1 — I'm good
  p(1, 1, "Хорошо, спасибо.", "Good, thank you.", "A1", "neutral", "The safe default — fine with anyone, from a friend to your boss. Then ask back: «А у тебя?» or «А у вас?»."),
  p(2, 1, "Всё хорошо.", "Everything's good.", "A1", "neutral", "Literally \"everything is good\": Russians answer about life in general, not just today."),
  p(3, 1, "У меня всё хорошо.", "Everything's good with me.", "A1", "neutral", "У меня (\"with me\") makes it a little fuller. It flows straight into «А у тебя?»."),
  p(4, 1, "Отлично!", "Excellent!", "A1", "neutral", "Short and upbeat. Sounds genuinely positive — fine with anyone."),
  p(5, 1, "Прекрасно!", "Wonderful!", "A1", "neutral", "A little warmer and more elegant than отлично."),
  p(6, 1, "Замечательно!", "Wonderful!", "A2", "neutral", "Enthusiastic — best when something good really happened."),
  p(7, 1, "Всё отлично.", "Everything's great.", "A1", "neutral", "Calm and confident: \"all's great\"."),
  p(8, 1, "Не жалуюсь.", "Can't complain.", "A2", "neutral", "Modest and very Russian: things are fine, no need to boast. Great with coworkers."),
  p(9, 1, "Всё супер!", "Everything's great!", "A1", "casual", "Young and casual. Fine with friends, a bit too informal for your boss."),
  p(10, 1, "Лучше не бывает.", "Couldn't be better.", "A2", "casual", "Enthusiastic — but said with a sigh it's ironic and means the opposite!"),

  // 2 — I'm doing better
  p(11, 2, "Уже лучше.", "Better now.", "A1", "neutral", "Use it when the other person knows you were ill or having a hard time."),
  p(12, 2, "Мне уже лучше.", "I'm feeling better now.", "A1", "neutral", "Мне лучше = I feel better: the feeling \"happens to me\", so it's мне (dative), not я."),
  p(13, 2, "С каждым днём лучше.", "Better every day.", "A2", "neutral", "A reassuring answer while you're recovering. Often «с каждым днём всё лучше»."),
  p(14, 2, "Сегодня намного лучше.", "Much better today.", "A2", "neutral", "Намного = much, with comparatives: намного лучше, намного легче."),
  p(15, 2, "Постепенно становится лучше.", "It's gradually getting better.", "B1", "neutral", "Постепенно = gradually. Calm, slightly bookish."),
  p(16, 2, "Уже намного лучше, спасибо.", "Much better now, thank you.", "A2", "formal", "The polite version with спасибо — right for coworkers or your boss asking about your health."),
  p(17, 2, "Всё налаживается.", "Things are getting better.", "B1", "neutral", "\"Things are sorting themselves out\" — after a problem, a breakup or a tough stretch."),
  p(18, 2, "Жизнь налаживается.", "Life is getting back on track.", "B1", "casual", "Optimistic with a smile — it's also a well-known catchphrase. With friends."),
  p(19, 2, "Не так плохо, как раньше.", "Not as bad as before.", "A2", "neutral", "Honest and modest. Так… как = as… as."),
  p(20, 2, "Потихоньку прихожу в себя.", "I'm slowly getting back to myself.", "B1", "casual", "Приходить в себя = to come round, to recover — after illness, a shock or a brutal week."),

  // 3 — Average
  p(21, 3, "Нормально.", "Fine.", "A1", "neutral", "The most common real answer in Russia. It means \"fine\" — not \"meh\". Russians don't oversell."),
  p(22, 3, "Всё нормально.", "Everything's okay.", "A1", "neutral", "Also used to reassure: «Всё нормально, не волнуйся» — it's all fine, don't worry."),
  p(23, 3, "Ничего особенного.", "Nothing special.", "A2", "neutral", "When life is just ordinary. Also answers «Что нового?»."),
  p(24, 3, "Как обычно.", "As usual.", "A1", "neutral", "Short and natural."),
  p(25, 3, "Всё по-старому.", "Same as always.", "A2", "casual", "\"Same old\" — typical with a friend you haven't seen for a while."),
  p(26, 3, "Пойдёт.", "It's alright.", "A2", "casual", "Very casual \"it'll do\". With friends, not your boss."),
  p(27, 3, "Так себе.", "So-so.", "A1", "casual", "Honest \"so-so\". Expect the follow-up «А что случилось?»."),
  p(28, 3, "Не очень.", "Not great.", "A1", "casual", "Invites them to ask why — say it to people you'd tell."),
  p(29, 3, "Бывает и лучше.", "Could be better.", "A2", "casual", "A light way to admit things aren't great."),
  p(30, 3, "Жить можно.", "It's livable.", "B1", "casual", "Wry and a bit funny: \"one can live\". With friends."),

  // 4 — Tired or busy
  p(31, 4, "Немного устал.", "I'm a little tired.", "A1", "neutral", "Said by a man. Устал looks like past tense but means \"I'm tired\" now.", { speaker: "m", other: "Немного устала." }),
  p(32, 4, "Немного устала.", "I'm a little tired.", "A1", "neutral", "Said by a woman — the past-tense ending -а.", { speaker: "f", other: "Немного устал." }),
  p(33, 4, "Очень устал.", "I'm very tired.", "A1", "neutral", "Said by a man. Very tired? Russians also say «устал как собака» — tired as a dog.", { speaker: "m", other: "Очень устала." }),
  p(34, 4, "Очень устала.", "I'm very tired.", "A1", "neutral", "Said by a woman — the -а ending on устала shows it.", { speaker: "f", other: "Очень устал." }),
  p(35, 4, "Сегодня был тяжёлый день.", "Today was a hard day.", "A2", "neutral", "Тяжёлый = heavy, hard. It invites sympathy — friends, family, your partner."),
  p(36, 4, "Много работы.", "Lots of work.", "A1", "neutral", "The classic busy answer — perfect with coworkers. Много + genitive: работы."),
  p(37, 4, "Очень занят.", "I'm very busy.", "A1", "neutral", "Said by a man. Careful: on its own it can sound like \"no time for you\" — add a smile or «но всё хорошо».", { speaker: "m", other: "Очень занята." }),
  p(38, 4, "Очень занята.", "I'm very busy.", "A1", "neutral", "Said by a woman. The stress moves to the end: занята́.", { speaker: "f", other: "Очень занят." }),
  p(39, 4, "Немного вымотался.", "I'm a little worn out.", "B1", "casual", "Said by a man. Вымотаться = to be worn out — stronger and more casual than устал.", { speaker: "m", other: "Немного вымоталась." }),
  p(40, 4, "Хочу просто отдохнуть.", "I just want to rest.", "A2", "casual", "Honest and relaxed. Просто = just."),

  // 5 — Happy and excited
  p(41, 5, "Я счастлив!", "I'm happy!", "A2", "casual", "Said by a man. Pronounced «щасли́в» — the т is silent. A strong word: real happiness, not just \"fine\".", { speaker: "m", other: "Я счастлива!" }),
  p(42, 5, "Я счастлива!", "I'm happy!", "A2", "casual", "Said by a woman. Pronounced «щасли́ва».", { speaker: "f", other: "Я счастлив!" }),
  p(43, 5, "Я в отличном настроении.", "I'm in a great mood.", "A2", "neutral", "В … настроении = in a … mood (prepositional). Fine with anyone."),
  p(44, 5, "Настроение отличное!", "My mood is great!", "A2", "neutral", "The same idea, more spoken — настроение comes first."),
  p(45, 5, "Сегодня прекрасный день.", "It's a wonderful day today.", "A1", "neutral", "Cheerful — about the day itself."),
  p(46, 5, "Не могу перестать улыбаться.", "I can't stop smiling.", "B1", "casual", "Warm and expressive — for sharing good news with friends or your partner."),
  p(47, 5, "Я очень рад тебя слышать.", "I'm really happy to hear from you.", "A2", "casual", "Said by a man, on the phone (слышать = to hear). In person: «рад тебя видеть».", { speaker: "m", other: "Я очень рада тебя слышать." }),
  p(48, 5, "Я очень рада тебя слышать.", "I'm really happy to hear from you.", "A2", "casual", "Said by a woman, on the phone. In person: «рада тебя видеть».", { speaker: "f", other: "Я очень рад тебя слышать." }),
  p(49, 5, "Сегодня всё складывается хорошо.", "Everything's going well today.", "B1", "neutral", "Складываться = to work out, to come together."),
  p(50, 5, "Я на седьмом небе от счастья.", "I'm over the moon.", "B1", "casual", "Literally \"in the seventh heaven\" — for big news: a new job, love."),

  // 6 — Not a great day
  p(51, 6, "Не очень хорошо.", "Not very well.", "A1", "neutral", "Honest. The other person will usually ask what happened."),
  p(52, 6, "Сегодня не лучший день.", "Today isn't the best day.", "A2", "neutral", "Softer than \"bad\" — fine at work."),
  p(53, 6, "Немного грустно.", "I'm a little sad.", "A2", "casual", "Грустно is impersonal (мне грустно). Share it with friends or your partner."),
  p(54, 6, "Я расстроен.", "I'm upset.", "A2", "casual", "Said by a man — upset about something specific.", { speaker: "m", other: "Я расстроена." }),
  p(55, 6, "Я расстроена.", "I'm upset.", "A2", "casual", "Said by a woman — upset or disappointed about something specific.", { speaker: "f", other: "Я расстроен." }),
  p(56, 6, "У меня был тяжёлый день.", "I've had a hard day.", "A2", "neutral", "У меня был = I had. A natural opening to talk about your day."),
  p(57, 6, "Немного нервничаю.", "I'm a little nervous.", "A2", "neutral", "Нервничать = to be nervous — before an exam, an interview, a date."),
  p(58, 6, "Я переживаю из-за работы.", "I'm worried about work.", "B1", "neutral", "Переживать = to worry. Из-за + genitive = because of: из-за работы."),
  p(59, 6, "Просто устал от всего.", "I'm just tired of everything.", "B1", "casual", "Said by a man. It's heavy — only with people close to you. Устать от + genitive = to be tired of.", { speaker: "m", other: "Просто устала от всего." }),
  p(60, 6, "Надеюсь, завтра будет лучше.", "I hope tomorrow will be better.", "A2", "neutral", "A hopeful ending to a bad-day answer."),

  // 7 — Romantic
  p(61, 7, "Теперь намного лучше, потому что ты написала.", "Much better now, because you texted me.", "B1", "romantic", "Said to a woman: написала agrees with her. To a man: «ты написал».", { toMan: "Теперь намного лучше, потому что ты написал." }),
  p(62, 7, "Было хорошо, а теперь ещё лучше.", "It was good, and now it's even better.", "A2", "romantic", "Light and flirty — the \"because of you\" is understood."),
  p(63, 7, "Теперь, когда я говорю с тобой, всё прекрасно.", "Now that I'm talking to you, everything's wonderful.", "B1", "romantic", "Sweet and a little dramatic — perfect on a call."),
  p(64, 7, "Скучаю по тебе.", "I miss you.", "A2", "romantic", "Скучать по + dative: по тебе. Also fine with very close family."),
  p(65, 7, "Мне тебя не хватает.", "I miss you (I miss having you around).", "B1", "romantic", "Literally \"you're not enough for me\" — deeper than скучаю."),
  p(66, 7, "Было бы лучше, если бы ты была рядом.", "It would be better if you were here.", "B1", "romantic", "\"Would\" = бы + past. Said to a woman (была); to a man: был.", { toMan: "Было бы лучше, если бы ты был рядом." }),
  p(67, 7, "Я улыбаюсь, потому что думаю о тебе.", "I'm smiling because I'm thinking about you.", "A2", "romantic", "Думать о + prepositional: о тебе. Sweet and simple."),
  p(68, 7, "Теперь у меня есть повод улыбаться.", "Now I have a reason to smile.", "B1", "romantic", "Повод = a reason, an occasion. Playfully romantic."),
  p(69, 7, "Всё хорошо, особенно когда ты рядом.", "Everything's good, especially when you're around.", "A2", "romantic", "Особенно = especially. Warm — great in person."),
  p(70, 7, "А ты украсила мой день!", "And you've brightened my day!", "B1", "romantic", "Said to a woman (украсила); to a man: украсил. \"You made my day\" copied word for word («ты сделала мой день») is understood, but sounds translated.", { toMan: "А ты украсил мой день!" }),

  // 8 — Funny
  p(71, 8, "Живой, и это уже хорошо!", "Alive — and that's already something!", "A2", "funny", "Said by a man; a woman says «Живая». A joke for friends.", { speaker: "m", other: "Живая, и это уже хорошо!" }),
  p(72, 8, "Пока не жалуюсь!", "Can't complain — yet!", "A2", "funny", "A playful twist on «не жалуюсь»: пока = for now."),
  p(73, 8, "Лучше, чем вчера!", "Better than yesterday!", "A2", "funny", "Light and positive — fine with coworkers too."),
  p(74, 8, "Как огурчик!", "Fit as a fiddle!", "B1", "funny", "Literally \"like a little cucumber\" — fresh and in great shape. Old-fashioned, and that's why it's funny."),
  p(75, 8, "Держусь!", "Hanging in there!", "A2", "funny", "Half a joke, half the truth. Very common."),
  p(76, 8, "Выживаю!", "Surviving!", "A2", "funny", "Dramatic joke about a busy week."),
  p(77, 8, "Как обычно, пытаюсь покорить мир.", "As usual, trying to conquer the world.", "B1", "funny", "Mock-serious ambition. With friends."),
  p(78, 8, "Всё под контролем. Почти.", "Everything's under control. Almost.", "A2", "funny", "The pause before «почти» is the joke."),
  p(79, 8, "Лучше, чем моя зарплата!", "Better than my paycheck!", "B1", "funny", "Funny with friends — never with your boss!"),
  p(80, 8, "Жду выходных!", "Waiting for the weekend!", "A1", "funny", "The universal office joke — safe with coworkers. Ждать + genitive: выходных."),

  // 9 — Natural, relaxed
  p(81, 9, "Да всё потихоньку.", "Oh, getting by.", "A2", "casual", "One of the most common real answers. Да here is a filler (\"oh, well\"), not \"yes\"."),
  p(82, 9, "Работаю, живу, не жалуюсь.", "Working, living, can't complain.", "A2", "casual", "Three short verbs in a row — relaxed and natural."),
  p(83, 9, "Занимаюсь своими делами.", "Just doing my own thing.", "B1", "casual", "Свои дела = your own stuff. Заниматься + instrumental: своими делами."),
  p(84, 9, "Ничего нового.", "Nothing new.", "A1", "neutral", "Also the answer to «Что нового?» (What's new?)."),
  p(85, 9, "Всё идёт своим чередом.", "Everything's going as usual.", "B2", "neutral", "A set phrase: life is going the way it should."),
  p(86, 9, "Понемногу.", "Little by little.", "A2", "casual", "Short and easy-going, like «потихоньку»."),
  p(87, 9, "Пока всё спокойно.", "All quiet for now.", "A2", "neutral", "Calm, slightly cautious — пока = for now."),
  p(88, 9, "Есть хорошие новости!", "I have some good news!", "A2", "neutral", "Say it when you want them to ask «Какие?» (What news?)."),
  p(89, 9, "Сегодня много планов.", "I have a lot of plans today.", "A2", "neutral", "Busy but positive. Много + genitive plural: планов."),
  p(90, 9, "Просто наслаждаюсь жизнью.", "Just enjoying life.", "B1", "casual", "Наслаждаться + instrumental: жизнью."),

  // 10 — More advanced
  p(91, 10, "В целом всё неплохо.", "Overall, things aren't bad.", "B1", "neutral", "В целом = overall; неплохо (\"not bad\") means pretty good."),
  p(92, 10, "Не могу сказать, что всё идеально.", "I can't say everything's perfect.", "B1", "formal", "Honest but measured — good with colleagues."),
  p(93, 10, "Бывают взлёты и падения.", "There are ups and downs.", "B2", "neutral", "Philosophical. Взлёт = take-off, падение = fall."),
  p(94, 10, "Стараюсь сохранять позитивный настрой.", "I'm trying to stay positive.", "B2", "formal", "Настрой = attitude, mindset. Mature and fine at work."),
  p(95, 10, "Сейчас у меня довольно насыщенный период.", "I'm going through a pretty busy period.", "B2", "formal", "Насыщенный = full, intense. Polished — good with your boss or clients."),
  p(96, 10, "Есть над чем поработать, но всё движется вперёд.", "There's room to improve, but things are moving forward.", "B2", "formal", "Есть над чем поработать = there's work to do. Constructive and professional."),
  p(97, 10, "Не всё так просто, но я справляюсь.", "It's not all that easy, but I'm managing.", "B1", "neutral", "Справляться = to cope, to manage. Honest and strong."),
  p(98, 10, "В последнее время всё складывается довольно удачно.", "Things have been going pretty well lately.", "B2", "formal", "В последнее время = lately; удачно = well, luckily."),
  p(99, 10, "Я благодарен за то, что у меня есть.", "I'm grateful for what I have.", "B1", "casual", "Said by a man; a woman says благодарна. Thoughtful — friends, family, your partner.", { speaker: "m", other: "Я благодарна за то, что у меня есть." }),
  p(100, 10, "Главное, что все близкие здоровы.", "The main thing is that everyone close to me is healthy.", "B1", "neutral", "A very Russian answer: the health of the people you love comes first."),
];

/** Phrases you'd say yourself: drops the other gender's version of speaker-specific phrases. */
export function forSpeaker(list: KdPhrase[], forms: "m" | "f") {
  return list.filter((x) => !x.speaker || x.speaker === forms);
}

/** The form to say: a romantic phrase changes with who you're talking to (a man talking to a woman by default). */
export function sayForm(x: KdPhrase, forms: "m" | "f") {
  return forms === "f" && x.toMan ? x.toMan : x.ru;
}

// ---------------------------------------------------------------- "Как дела?" simulator

export type Situation = {
  id: string;
  who: string;
  whoRu: string;
  /** asker's gender (for their reactions) */
  g: "m" | "f";
  vy: boolean;
  q: string;
  qEn: string;
  /** tones that fit; categories that fit especially well */
  good: Tone[];
  best?: number[];
  /** why a tone doesn't fit here */
  bad: Partial<Record<Tone, string>>;
  /** their answer when you ask back */
  back: { ru: string; en: string };
};

export const SITUATIONS: Situation[] = [
  { id: "friend", who: "Dima, a friend, texts you", whoRu: "Дима", g: "m", vy: false, q: "Привет! Как дела?", qEn: "Hi! How are you?", good: ["neutral", "casual", "funny"], bad: { romantic: "That's romantic — a bit much for Dima. Save it for your partner.", formal: "Correct, but stiff for a friend — like answering a text with a business email." }, back: { ru: "Да тоже нормально, спасибо!", en: "Oh, fine too, thanks!" } },
  { id: "coworker", who: "Olga Petrovna, a senior coworker, in the morning", whoRu: "Ольга Петровна", g: "f", vy: true, q: "Доброе утро! Как ваши дела?", qEn: "Good morning! How are you?", good: ["formal", "neutral"], bad: { romantic: "Romantic — definitely not for a coworker!", casual: "A bit too casual for someone you call вы.", funny: "A joke can work with relaxed coworkers, but with Olga Petrovna keep it everyday." }, back: { ru: "Спасибо, всё хорошо.", en: "Thank you, all good." } },
  { id: "partner", who: "Nastya, your girlfriend, calls you", whoRu: "Настя", g: "f", vy: false, q: "Привет, солнце! Как ты?", qEn: "Hi, sunshine! How are you?", good: ["romantic", "casual", "neutral", "funny"], best: [7], bad: { formal: "Too formal for your girlfriend — she'll wonder what's wrong!" }, back: { ru: "Теперь отлично — я же с тобой говорю!", en: "Great now — I'm talking to you!" } },
  { id: "mom", who: "Your mum, on the phone", whoRu: "Мама", g: "f", vy: false, q: "Ну как ты там? Как дела?", qEn: "So how are you doing over there?", good: ["neutral", "casual"], best: [1, 5, 9], bad: { romantic: "That's for a partner — Mum will be confused.", formal: "Too formal for your mum!", funny: "Mums usually want a real answer first — joke after." }, back: { ru: "Да всё хорошо. Скучаем по тебе!", en: "All good. We miss you!" } },
  { id: "recovering", who: "Ira, a friend who knows you were ill", whoRu: "Ира", g: "f", vy: false, q: "Ну как ты? Тебе лучше?", qEn: "So how are you? Feeling better?", good: ["neutral", "casual", "formal"], best: [2], bad: { romantic: "Romantic — not for a friend.", funny: "She's worried about you — answer the question first, joke later." }, back: { ru: "У меня всё хорошо, спасибо. Береги себя!", en: "I'm fine, thanks. Take care of yourself!" } },
  { id: "neighbour", who: "Your neighbour, in the lift", whoRu: "Сосед", g: "m", vy: true, q: "Здравствуйте! Как жизнь?", qEn: "Hello! How's life?", good: ["neutral", "formal", "funny"], best: [1, 3, 9], bad: { romantic: "Romantic — not for a neighbour!", casual: "A bit too casual for someone you call вы — keep it light and everyday." }, back: { ru: "Да потихоньку, спасибо!", en: "Getting by, thanks!" } },
];

/** What the other person says back, by the kind of answer you gave. */
export function reaction(cat: number, s: Situation, forms: "m" | "f"): { ru: string; en: string } {
  const rad = s.g === "f" ? "Рада" : "Рад";
  const vy = s.vy;
  switch (cat) {
    case 1: return vy ? { ru: "Вот и замечательно!", en: "That's wonderful!" } : { ru: `Вот и отлично! ${rad} за тебя.`, en: "Great! Happy for you." };
    case 2: return vy ? { ru: `${rad} это слышать. Берегите себя!`, en: "Glad to hear it. Take care!" } : { ru: "Ну и хорошо! Береги себя.", en: "Good! Take care of yourself." };
    case 3: return { ru: "Ну, нормально — это тоже неплохо.", en: "Well, fine is not bad either." };
    case 4: return vy ? { ru: "Отдохните как следует!", en: "Get some proper rest!" } : { ru: "Отдохни как следует!", en: "Get some proper rest!" };
    case 5: return vy ? { ru: "Как здорово! Что случилось?", en: "How great! What happened?" } : { ru: "Ого! Что случилось? Рассказывай!", en: "Wow! What happened? Tell me!" };
    case 6: return vy ? { ru: "Сочувствую. Надеюсь, всё наладится.", en: "I'm sorry. I hope things get better." } : { ru: "Ой… Что случилось? Хочешь поговорить?", en: "Oh… What happened? Want to talk?" };
    case 7: return s.id === "partner"
      ? { ru: forms === "f" ? "Ой, ты такая милая!" : "Ой, ты такой милый!", en: "Aww, you're so sweet!" }
      : { ru: "Э-э… спасибо?", en: "Uh… thanks?" };
    case 8: return { ru: "Ха-ха! Понятно.", en: "Ha-ha! Got it." };
    case 9: return { ru: "Понятно. Ну и хорошо!", en: "Got it. Good!" };
    default: return { ru: "Звучит здорово. Так держать!", en: "Sounds great. Keep it up!" };
  }
}
