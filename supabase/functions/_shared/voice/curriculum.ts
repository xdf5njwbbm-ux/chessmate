// AI Voice Practice — conversation curriculum, levels, modes and tutors.
// Pure data, shared by the `voice` edge function (it builds the tutor's
// instructions from it) and the app (lesson picker, call screen).
//
// Russian is written with an apostrophe after the stressed vowel ("Приве'т")
// and converted to a combining acute accent (U+0301) by `st()`.

export type VoiceLevel = "A1" | "A2" | "B1" | "B2" | "C1";
export type VoiceMode = "beginner" | "natural" | "immersion";
export type TutorId = "anya" | "misha";
export type Phrase = { ru: string; en: string };

export const VOICE_LEVELS: VoiceLevel[] = ["A1", "A2", "B1", "B2", "C1"];

/** "Приве'т" → "Приве́т" */
export const st = (s: string) => s.replace(/([аеёиоуыэюяАЕЁИОУЫЭЮЯ])'/g, "$1́");
const p = (ru: string, en: string): Phrase => ({ ru: st(ru), en });

export const LEVEL_INFO: Record<VoiceLevel, { name: string; can: string; style: string }> = {
  A1: {
    name: "Absolute beginner",
    can: "Greet people, introduce yourself and answer simple questions about yourself.",
    style:
      "Very short sentences (3–7 words). Present tense, the most common few hundred words. One idea per sentence, one question per turn. Pause briefly between sentences.",
  },
  A2: {
    name: "Basic conversations",
    can: "Handle everyday situations: shopping, plans, your day, simple stories in the past and future.",
    style:
      "Short everyday sentences. Past and future tense are fine. Simple connectors (и, но, потому что, а потом). Common vocabulary; explain any new word.",
  },
  B1: {
    name: "Independent conversations",
    can: "Talk about experiences, give opinions with reasons and keep a conversation going on your own.",
    style:
      "Connected, natural speech at a relaxed pace. Opinions, reasons, comparisons, stories about experiences. Everyday idioms occasionally, avoid rare words.",
  },
  B2: {
    name: "Detailed discussions",
    can: "Discuss abstract and current topics in detail, argue a point and react spontaneously.",
    style:
      "Natural speed and register of an educated native speaker. Abstract topics, nuance, hypotheticals, idioms and colloquialisms (briefly explain unusual ones).",
  },
  C1: {
    name: "Advanced natural conversation",
    can: "Speak fluently and flexibly, with humour, register shifts and precise vocabulary.",
    style:
      "Fully natural native conversation: idioms, colloquial speech, wordplay, complex grammar and fast exchanges. Correct only subtle errors and unnatural phrasing.",
  },
};

export const MODES: Record<VoiceMode, { title: string; ru: string; blurb: string; points: string[]; speed: number; slowSpeed: number }> = {
  beginner: {
    title: "Beginner guided",
    ru: "С подсказками",
    blurb: "Slow, simple Russian with English help after every sentence.",
    points: ["Speaks slowly", "Simple A1 words", "English translations", "Suggested answers when you're stuck", "One new thing at a time"],
    speed: 0.85,
    slowSpeed: 0.7,
  },
  natural: {
    title: "Natural conversation",
    ru: "Живой разговор",
    blurb: "Everyday Russian at a natural pace, with less and less English.",
    points: ["Everyday Russian", "Unexpected follow-up questions", "Encourages full sentences", "English only when you need it"],
    speed: 1,
    slowSpeed: 0.8,
  },
  immersion: {
    title: "Immersion",
    ru: "Только по-русски",
    blurb: "Russian only, natural speed, real conversations.",
    points: ["Russian only", "No automatic translations", "Natural speaking speed", "English only if you ask for help"],
    speed: 1,
    slowSpeed: 0.8,
  },
};

export const TUTORS: Record<TutorId, { name: string; ru: string; voice: string; gender: "f" | "m"; bio: string; city: string }> = {
  anya: {
    name: "Anya",
    ru: "Аня",
    voice: "marin",
    gender: "f",
    city: "Saint Petersburg",
    bio: "Anya is 28, from Saint Petersburg. She teaches Russian online, loves long walks along the Neva, strong tea, cats and playing chess with friends on weekends.",
  },
  misha: {
    name: "Misha",
    ru: "Миша",
    voice: "cedar",
    gender: "m",
    city: "Moscow",
    bio: "Misha is 31, from Moscow. He's a Russian tutor and a big football and chess fan, cooks a mean борщ and likes travelling around Russia by train.",
  },
};

export type Topic = {
  id: number;
  slug: string;
  title: string;
  ru: string;
  /** What you'll be able to do. */
  goal: string;
  /** Where the conversation happens, when it's a role-play. */
  scene?: string;
  /** The tutor's first question on this topic at A1. */
  opener: Phrase;
  /** Core phrases (stress-marked). */
  phrases: Phrase[];
  /** The one grammar idea this topic teaches at A1. */
  grammar: string;
  /** How the same topic grows at higher levels. */
  stretch: Record<Exclude<VoiceLevel, "A1">, string>;
};

export const TOPICS: Topic[] = [
  {
    id: 1, slug: "greetings", title: "Greetings and introductions", ru: st("Знако'мство"),
    goal: "Say hello, introduce yourself, say it's nice to meet someone and say goodbye.",
    opener: p("Приве'т! Как тебя' зову'т?", "Hi! What's your name?"),
    phrases: [
      p("Приве'т!", "Hi!"), p("Здра'вствуйте!", "Hello! (polite)"), p("Меня' зову'т …", "My name is …"),
      p("Как тебя' зову'т?", "What's your name?"), p("О'чень прия'тно!", "Nice to meet you!"), p("Пока'! / До свида'ния!", "Bye! / Goodbye!"),
    ],
    grammar: "«Меня зовут …» literally means 'they call me …' — Russian has no 'am/is/are' in the present. Use ты with friends and вы with strangers or to be polite.",
    stretch: {
      A2: "Introduce someone else (Это мой друг …) and say how you know each other.",
      B1: "Small talk with someone new: what brings you here, how you know the host, first impressions.",
      B2: "Introduce yourself professionally and switch naturally between ты and вы.",
      C1: "Introductions with humour and nuance; etiquette and first impressions in Russian culture.",
    },
  },
  {
    id: 2, slug: "how-are-you", title: "How are you?", ru: st("Как дела'?"),
    goal: "Ask and answer 'how are you' naturally, and ask back.",
    opener: p("Приве'т! Как дела'?", "Hi! How are you?"),
    phrases: [
      p("Как дела'?", "How are you?"), p("Хорошо', спаси'бо.", "Good, thanks."), p("У меня' всё хорошо'.", "I'm doing well."),
      p("Норма'льно.", "Okay / fine."), p("Так себе'.", "So-so."), p("А у тебя'?", "And you?"), p("Отли'чно!", "Great!"),
    ],
    grammar: "Answer «Как дела?» with «Хорошо» or «У меня всё хорошо» — not «Я хорошо», which sounds like 'I'm good (at something)'. Ask back with «А у тебя?».",
    stretch: {
      A2: "Say why: «Хорошо, потому что сегодня пятница».",
      B1: "Describe your week and your mood with reasons and examples.",
      B2: "Express mixed feelings precisely (устал, но доволен) and react with empathy.",
      C1: "Idiomatic answers (Лучше всех! Потихоньку. Живу — не жалуюсь.) and reading between the lines.",
    },
  },
  {
    id: 3, slug: "name-age", title: "Your name and age", ru: st("Имя и во'зраст"),
    goal: "Say your name and age and ask other people theirs.",
    opener: p("Ско'лько тебе' лет?", "How old are you?"),
    phrases: [
      p("Ско'лько тебе' лет?", "How old are you?"), p("Мне два'дцать пять лет.", "I'm twenty-five."),
      p("Мне два'дцать оди'н год.", "I'm twenty-one."), p("Мне два'дцать два го'да.", "I'm twenty-two."),
      p("А тебе'?", "And you?"), p("Когда' у тебя' день рожде'ния?", "When is your birthday?"),
    ],
    grammar: "Age uses «мне» (to me): «Мне 25 лет». After 1 say год, after 2–4 года, after 5–20 лет.",
    stretch: {
      A2: "Ages and birthdays of family members (Моему брату тринадцать лет).",
      B1: "Talk about being older or younger, what you did at different ages.",
      B2: "Discuss age, generations and life stages.",
      C1: "Debate attitudes to age and birthdays in different cultures.",
    },
  },
  {
    id: 4, slug: "origin", title: "Where are you from?", ru: st("Отку'да ты?"),
    goal: "Say where you're from, your nationality and which languages you speak.",
    opener: p("Отку'да ты?", "Where are you from?"),
    phrases: [
      p("Отку'да ты?", "Where are you from?"), p("Я из Аме'рики.", "I'm from America."),
      p("Я америка'нец. / Я америка'нка.", "I'm American. (m / f)"), p("Ты говори'шь по-ру'сски?", "Do you speak Russian?"),
      p("Я немно'го говорю' по-ру'сски.", "I speak a little Russian."), p("А ты отку'да?", "And where are you from?"),
    ],
    grammar: "«из» + genitive: Америка → из Америки, Москва → из Москвы, Техас → из Техаса.",
    stretch: {
      A2: "Describe your home town and where your family is from.",
      B1: "Compare your country and Russia: food, weather, people.",
      B2: "Discuss identity, regions and stereotypes.",
      C1: "Nuanced discussion of culture, history and belonging.",
    },
  },
  {
    id: 5, slug: "home", title: "Where do you live?", ru: st("Где ты живёшь?"),
    goal: "Say where you live and describe your home and city simply.",
    opener: p("Где ты живёшь?", "Where do you live?"),
    phrases: [
      p("Где ты живёшь?", "Where do you live?"), p("Я живу' в Аме'рике.", "I live in America."), p("Я живу' в Москве'.", "I live in Moscow."),
      p("У меня' кварти'ра.", "I have an apartment."), p("Э'то большо'й го'род.", "It's a big city."), p("Мне нра'вится мой го'род.", "I like my city."),
    ],
    grammar: "«в» + prepositional means 'in': Москва → в Москве, Флорида → во Флориде. жить: я живу, ты живёшь.",
    stretch: {
      A2: "Describe your home: rooms, neighbours, what's nearby.",
      B1: "Pros and cons of your city; where you'd like to live and why.",
      B2: "Housing, city vs countryside, how cities are changing.",
      C1: "Urban life, gentrification and quality of life in depth.",
    },
  },
  {
    id: 6, slug: "family", title: "Family and relationships", ru: st("Семья'"),
    goal: "Talk about your family members simply.",
    opener: p("У тебя' есть брат и'ли сестра'?", "Do you have a brother or sister?"),
    phrases: [
      p("У тебя' есть брат и'ли сестра'?", "Do you have a brother or sister?"), p("У меня' есть брат.", "I have a brother."),
      p("Э'то моя' ма'ма.", "This is my mom."), p("Мой па'па — врач.", "My dad is a doctor."),
      p("У меня' больша'я семья'.", "I have a big family."), p("Как зову'т твою' сестру'?", "What's your sister's name?"),
    ],
    grammar: "«У меня есть …» means 'I have …'. мой for masculine words (мой брат), моя for feminine (моя мама).",
    stretch: {
      A2: "Describe relatives: age, job, where they live, what they're like.",
      B1: "Family traditions, holidays and relationships between relatives.",
      B2: "Family dynamics and how families are changing.",
      C1: "Generational differences and values, with nuance.",
    },
  },
  {
    id: 7, slug: "work", title: "What do you do for work?", ru: st("Рабо'та"),
    goal: "Say what you do, where you work and whether you like it.",
    opener: p("Кем ты рабо'таешь?", "What do you do for work?"),
    phrases: [
      p("Кем ты рабо'таешь?", "What do you do?"), p("Я рабо'таю продавцо'м.", "I work as a salesperson."),
      p("Где ты рабо'таешь?", "Where do you work?"), p("Я рабо'таю в магази'не.", "I work in a store."),
      p("Мне нра'вится моя' рабо'та.", "I like my job."), p("Э'то интере'сно!", "That's interesting!"),
    ],
    grammar: "«Работать кем» takes the instrumental: продавец → продавцом, врач → врачом, учитель → учителем.",
    stretch: {
      A2: "Describe a normal work day and your colleagues.",
      B1: "What you like and dislike about your job, career plans.",
      B2: "Work culture, remote work, ambitions and challenges.",
      C1: "Negotiation, leadership and professional nuance.",
    },
  },
  {
    id: 8, slug: "routine", title: "Daily routines", ru: st("Мой день"),
    goal: "Describe your typical day with times.",
    opener: p("Во ско'лько ты встаёшь?", "What time do you get up?"),
    phrases: [
      p("Во ско'лько ты встаёшь?", "What time do you get up?"), p("Я встаю' в семь часо'в.", "I get up at seven."),
      p("У'тром я пью ко'фе.", "In the morning I drink coffee."), p("Пото'м я иду' на рабо'ту.", "Then I go to work."),
      p("Ве'чером я отдыха'ю.", "In the evening I relax."), p("Я ложу'сь спать в оди'ннадцать.", "I go to bed at eleven."),
    ],
    grammar: "Parts of the day: утром, днём, вечером, ночью. 'At seven' is «в семь (часов)».",
    stretch: {
      A2: "Compare weekdays and weekends; what you usually do and sometimes do.",
      B1: "Habits you want to change, how your routine used to be.",
      B2: "Work-life balance, productivity and habits.",
      C1: "Lifestyle debates with idiomatic language.",
    },
  },
  {
    id: 9, slug: "food", title: "Food and drinks", ru: st("Еда' и напи'тки"),
    goal: "Say what you like and don't like to eat and drink.",
    opener: p("Ты лю'бишь ко'фе и'ли чай?", "Do you like coffee or tea?"),
    phrases: [
      p("Что ты лю'бишь есть?", "What do you like to eat?"), p("Я люблю' пи'ццу.", "I love pizza."), p("Я не люблю' ры'бу.", "I don't like fish."),
      p("Я хочу' пить.", "I'm thirsty."), p("Э'то о'чень вку'сно!", "It's very tasty!"), p("Ты лю'бишь ко'фе и'ли чай?", "Do you like coffee or tea?"),
    ],
    grammar: "«любить» + accusative: feminine -а becomes -у (пицца → пиццу, рыба → рыбу). Masculine words don't change (люблю чай).",
    stretch: {
      A2: "Describe a meal you cooked or ate; Russian dishes you've tried.",
      B1: "Recipes, food habits, comparing cuisines.",
      B2: "Diets, food culture and traditions.",
      C1: "Food as culture and identity; idioms about food.",
    },
  },
  {
    id: 10, slug: "restaurant", title: "Ordering at restaurants", ru: st("В кафе'"),
    goal: "Order food and drinks politely and ask for the bill.",
    scene: "Role-play: you are a friendly waiter in a small café in Moscow; the learner is the customer. Use вы.",
    opener: p("Здра'вствуйте! Что бу'дете зака'зывать?", "Hello! What would you like to order?"),
    phrases: [
      p("Мо'жно меню', пожа'луйста?", "Can I have the menu, please?"), p("Я бу'ду борщ.", "I'll have borscht."),
      p("Мне, пожа'луйста, чай.", "Tea for me, please."), p("Что вы посове'туете?", "What do you recommend?"),
      p("Ско'лько с меня'?", "How much do I owe?"), p("Счёт, пожа'луйста!", "The bill, please!"),
    ],
    grammar: "Order with «Мне, пожалуйста, …» or «Я буду …». Use вы with the waiter.",
    stretch: {
      A2: "Ask about dishes, make a special request, pay by card or cash.",
      B1: "Deal with a problem politely (wrong dish, cold soup).",
      B2: "Book a table, discuss the menu, recommend places.",
      C1: "Restaurant reviews and food criticism with nuance.",
    },
  },
  {
    id: 11, slug: "shopping", title: "Shopping", ru: st("Поку'пки"),
    goal: "Ask for things, prices and sizes, and buy something.",
    scene: "Role-play: you are a shop assistant in a clothing shop; the learner is a customer. Use вы.",
    opener: p("Здра'вствуйте! Вам что'-нибудь подсказа'ть?", "Hello! Can I help you with anything?"),
    phrases: [
      p("Ско'лько э'то сто'ит?", "How much is this?"), p("Э'то до'рого.", "That's expensive."), p("Э'то дёшево.", "That's cheap."),
      p("У вас есть …?", "Do you have …?"), p("Я хочу' купи'ть …", "I want to buy …"), p("Мо'жно посмотре'ть?", "May I take a look?"), p("Я возьму' э'то.", "I'll take it."),
    ],
    grammar: "Prices: 1 рубль, 2–4 рубля, 5 and up рублей. «У вас есть …?» = 'Do you have …?'",
    stretch: {
      A2: "Sizes, colours, trying things on, returning something.",
      B1: "Compare products, ask for a discount, online shopping.",
      B2: "Consumer habits, advertising, sales.",
      C1: "Consumerism and economics in depth.",
    },
  },
  {
    id: 12, slug: "directions", title: "Asking for directions", ru: st("Как пройти'?"),
    goal: "Ask where something is and understand simple directions.",
    scene: "Role-play: you are a helpful passer-by on a street in Moscow; the learner is a tourist asking the way. Use вы.",
    opener: p("Вы что'-то и'щете? Могу' помо'чь?", "Are you looking for something? Can I help?"),
    phrases: [
      p("Извини'те, где метро'?", "Excuse me, where is the metro?"), p("Как пройти' к це'нтру?", "How do I get to the centre?"),
      p("Иди'те пря'мо.", "Go straight."), p("Поверни'те напра'во.", "Turn right."), p("Поверни'те нале'во.", "Turn left."),
      p("Э'то далеко'?", "Is it far?"), p("Нет, э'то бли'зко.", "No, it's close."),
    ],
    grammar: "где = where (something is), куда = where to. Directions use вы-commands: идите, поверните.",
    stretch: {
      A2: "Public transport: which bus, how many stops, where to change.",
      B1: "Give directions yourself; describe a route you take.",
      B2: "Navigate a complicated situation (closed station, getting lost).",
      C1: "Describe a city's layout and history vividly.",
    },
  },
  {
    id: 13, slug: "weather", title: "Talking about the weather", ru: st("Пого'да"),
    goal: "Say what the weather is like and which season you like.",
    opener: p("Кака'я у тебя' сего'дня пого'да?", "What's the weather like where you are today?"),
    phrases: [
      p("Кака'я сего'дня пого'да?", "What's the weather like today?"), p("Сего'дня тепло'.", "It's warm today."),
      p("Сего'дня хо'лодно.", "It's cold today."), p("Идёт дождь.", "It's raining."), p("Идёт снег.", "It's snowing."),
      p("Све'тит со'лнце.", "The sun is shining."), p("Я люблю' ле'то.", "I love summer."),
    ],
    grammar: "Weather words need no 'it is': тепло, холодно, жарко. Seasons: летом, зимой, весной, осенью = in summer, winter, spring, autumn.",
    stretch: {
      A2: "Yesterday's and tomorrow's weather; what you do in each season.",
      B1: "Climate where you live vs Russia; weather and mood.",
      B2: "Climate change and extreme weather.",
      C1: "Weather idioms and literary descriptions.",
    },
  },
  {
    id: 14, slug: "hobbies", title: "Hobbies and interests", ru: st("Хо'бби"),
    goal: "Talk about what you like doing in your free time.",
    opener: p("Что ты лю'бишь де'лать в свобо'дное вре'мя?", "What do you like doing in your free time?"),
    phrases: [
      p("Что ты лю'бишь де'лать?", "What do you like to do?"), p("Я люблю' игра'ть в ша'хматы.", "I love playing chess."),
      p("Я игра'ю на гита'ре.", "I play the guitar."), p("В свобо'дное вре'мя я чита'ю.", "In my free time I read."),
      p("Ты лю'бишь спорт?", "Do you like sports?"), p("Како'й твой люби'мый фильм?", "What's your favourite film?"),
    ],
    grammar: "играть в + game (в шахматы, в футбол), играть на + instrument (на гитаре). «Люблю» + infinitive: люблю читать.",
    stretch: {
      A2: "How long you've done a hobby, how often, with whom.",
      B1: "Why you love it; recommend a book, film or game.",
      B2: "Discuss trends in entertainment and sport.",
      C1: "Critique art, film and literature with nuance.",
    },
  },
  {
    id: 15, slug: "your-day", title: "Talking about your day", ru: st("Как прошёл день?"),
    goal: "Say how your day went and what you did.",
    opener: p("Как прошёл твой день?", "How was your day?"),
    phrases: [
      p("Как прошёл твой день?", "How was your day?"), p("Хорошо'. Я мно'го рабо'тал(а).", "Good. I worked a lot."),
      p("Я о'чень уста'л(а).", "I'm very tired."), p("Что ты сего'дня де'лал(а)?", "What did you do today?"),
      p("Ничего' осо'бенного.", "Nothing special."), p("А как твой день?", "And how was your day?"),
    ],
    grammar: "The past tense changes with gender: он работал, она работала. Use the form that fits you.",
    stretch: {
      A2: "Tell your day in order: сначала, потом, после этого.",
      B1: "Tell a small story from your day with feelings and reasons.",
      B2: "Reflect on a challenging day and what you'd do differently.",
      C1: "Storytelling with humour, suspense and colloquial flair.",
    },
  },
  {
    id: 16, slug: "plans", title: "Making plans", ru: st("Пла'ны"),
    goal: "Suggest doing something together, agree on a time, or say no politely.",
    opener: p("Что ты де'лаешь в суббо'ту?", "What are you doing on Saturday?"),
    phrases: [
      p("Что ты де'лаешь в суббо'ту?", "What are you doing on Saturday?"), p("Дава'й пойдём в кино'!", "Let's go to the cinema!"),
      p("Хоро'шая иде'я!", "Good idea!"), p("Во ско'лько?", "What time?"), p("Дава'й в семь.", "Let's say seven."),
      p("Извини', я за'нят. / Я занята'.", "Sorry, I'm busy. (m / f)"),
    ],
    grammar: "«Давай …» = 'let's …'. Days take «в»: в субботу, в пятницу, в воскресенье.",
    stretch: {
      A2: "Rearrange plans, suggest alternatives, agree on a place.",
      B1: "Plan a trip together: dates, budget, preferences.",
      B2: "Negotiate plans with competing preferences.",
      C1: "Persuade and compromise with tact and humour.",
    },
  },
  {
    id: 17, slug: "yesterday", title: "Talking about yesterday", ru: st("Вчера'"),
    goal: "Say what you did yesterday using the past tense.",
    opener: p("Что ты де'лал вчера'?", "What did you do yesterday?"),
    phrases: [
      p("Что ты де'лал(а) вчера'?", "What did you do yesterday?"), p("Вчера' я был(а') до'ма.", "Yesterday I was at home."),
      p("Я смотре'л(а) фильм.", "I watched a film."), p("Я ходи'л(а) в магази'н.", "I went to the shop."),
      p("Бы'ло ве'село!", "It was fun!"), p("А ты что де'лал(а)?", "And what did you do?"),
    ],
    grammar: "Past tense: -л for a man, -ла for a woman, -ли for 'they/we': был, была, были.",
    stretch: {
      A2: "Last weekend, last holiday: where you went, what you saw.",
      B1: "Tell a memorable story from the past in detail.",
      B2: "Compare the past and present; childhood memories.",
      C1: "Narrate with aspect nuances and vivid detail.",
    },
  },
  {
    id: 18, slug: "tomorrow", title: "Talking about tomorrow", ru: st("За'втра"),
    goal: "Say what you will do tomorrow using the future tense.",
    opener: p("Что ты бу'дешь де'лать за'втра?", "What will you do tomorrow?"),
    phrases: [
      p("Что ты бу'дешь де'лать за'втра?", "What will you do tomorrow?"), p("За'втра я бу'ду рабо'тать.", "Tomorrow I'll work."),
      p("Я пойду' в спортза'л.", "I'll go to the gym."), p("За'втра бу'дет хо'лодно.", "It will be cold tomorrow."),
      p("Мы уви'димся за'втра?", "Will we see each other tomorrow?"),
    ],
    grammar: "Future: буду / будешь + infinitive (буду работать). Some verbs have a one-word future: пойду, увижу, позвоню.",
    stretch: {
      A2: "Next week and next year: plans and intentions.",
      B1: "Hopes, predictions and conditions (если будет время …).",
      B2: "Future of work, technology and society.",
      C1: "Speculate and hypothesise with nuance.",
    },
  },
  {
    id: 19, slug: "phone", title: "Phone conversations", ru: st("По телефо'ну"),
    goal: "Answer the phone, ask for someone, call back and arrange a call.",
    scene: "Role-play: you are calling the learner on the phone (you are a Russian friend). Start like a real phone call.",
    opener: p("Алло'! Приве'т! Ты мо'жешь говори'ть?", "Hello? Hi! Can you talk?"),
    phrases: [
      p("Алло'!", "Hello? (on the phone)"), p("Ты мо'жешь говори'ть?", "Can you talk right now?"), p("Мо'жно Ива'на?", "May I speak to Ivan?"),
      p("Тебя' пло'хо слы'шно.", "I can barely hear you."), p("Я тебе' перезвоню'.", "I'll call you back."), p("Дава'й созвони'мся за'втра.", "Let's talk tomorrow."),
    ],
    grammar: "тебе = 'to you' (dative): «Я тебе позвоню». «Можно + person» to ask for someone: «Можно Ивана?»",
    stretch: {
      A2: "Leave a message, book an appointment by phone.",
      B1: "Handle a misunderstanding or bad connection on the phone.",
      B2: "Formal calls: customer service, complaints.",
      C1: "Fast, informal calls full of colloquial speech.",
    },
  },
  {
    id: 20, slug: "relationships", title: "Everyday relationship conversations", ru: st("Отноше'ния"),
    goal: "Talk warmly with a partner or close friend: feelings, small apologies, plans together.",
    opener: p("Как ты себя' чу'вствуешь сего'дня?", "How are you feeling today?"),
    phrases: [
      p("Я по тебе' скуча'ю.", "I miss you."), p("Как ты себя' чу'вствуешь?", "How are you feeling?"),
      p("Дава'й поу'жинаем вме'сте.", "Let's have dinner together."), p("Спаси'бо за по'мощь!", "Thanks for your help!"),
      p("Извини', я опозда'л(а).", "Sorry, I'm late."), p("Ты мне нра'вишься.", "I like you."), p("Не волну'йся.", "Don't worry."),
    ],
    grammar: "«Мне нравится …» / «Ты мне нравишься»: the person who likes is in the dative (мне), the thing liked is the subject.",
    stretch: {
      A2: "Small everyday talks: chores, plans for the evening, compliments.",
      B1: "Resolve a small disagreement kindly; express feelings.",
      B2: "Discuss relationships, trust and communication.",
      C1: "Subtle emotional language, tact and humour.",
    },
  },
];

export const topicById = (id: number | null | undefined) => TOPICS.find((t) => t.id === id) ?? null;

export const nextLevel = (l: VoiceLevel): VoiceLevel | null => VOICE_LEVELS[VOICE_LEVELS.indexOf(l) + 1] ?? null;
export const levelIndex = (l: string) => Math.max(0, VOICE_LEVELS.indexOf(l as VoiceLevel));
export const isLevel = (l: unknown): l is VoiceLevel => VOICE_LEVELS.includes(l as VoiceLevel);
export const isMode = (m: unknown): m is VoiceMode => m === "beginner" || m === "natural" || m === "immersion";
export const isTutor = (t: unknown): t is TutorId => t === "anya" || t === "misha";

/** Live speaking speed for the call. */
export const speedFor = (mode: VoiceMode, slow: boolean) => (slow ? MODES[mode].slowSpeed : MODES[mode].speed);
