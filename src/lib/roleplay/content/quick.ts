// Conversation starters (free conversation) and quick-fire questions (Quick Responses),
// by level. Partners speak in ты.

export const QUICK = String.raw`
@openers A1
> Что ты любишь делать? | What do you like to do?
= Я люблю играть в шахматы. | I love playing chess.
= Я люблю спорт и музыку. | I love sport and music.
? else: Классно! | Cool!
> Где ты живёшь? | Where do you live?
= Я живу во Флориде. | I live in Florida. // «Во Флориде» — «во» before ф/в + consonant.
= Я живу в Джексонвилле. | I live in Jacksonville.
? has=флорид/джексонвил/америк: Во Флориде всегда тепло, да? Завидую! | It's always warm in Florida, right? I'm jealous!
? else: Здорово! | Great!
* жить = to live
> Ты любишь кофе? | Do you like coffee?
= Да, очень! Пью каждое утро. | Yes, a lot! I drink it every morning.
= Нет, я больше люблю чай. | No, I prefer tea.
? yes: Я тоже! | Me too!
? no: Чай — это тоже хорошо. | Tea is good too.
> Какой твой любимый цвет? | What's your favourite colour?
= Синий. | Blue.
= Мне нравится чёрный. | I like black.
? else: Красивый цвет! | Nice colour!
* любимый = favourite
> Что ты ел{|а} на завтрак? | What did you have for breakfast?
= Яйца и кофе. | Eggs and coffee.
= Ничего, я не завтракаю. | Nothing, I don't eat breakfast.
? has=ничего/завтрака: Ой, это вредно! | Oh, that's bad for you!
? else: Хороший завтрак! | Good breakfast!
* завтрак = breakfast
> Ты рано встаёшь? | Do you get up early?
= Да, в шесть утра. | Yes, at six in the morning.
= Нет, я сова. | No, I'm a night owl. // «Сова» (owl) = night person; «жаворонок» (lark) = morning person.
? has=сова: Я тоже сова! | I'm a night owl too!
? yes, number: Ого, рано! | Wow, early!
? else: Понятно. | I see.
* сова = owl (night person)
> Ты играешь в шахматы каждый день? | Do you play chess every day?
= Да, почти каждый день. | Yes, almost every day.
= Нет, только по выходным. | No, only at weekends.
? else: Понятно! | I see!

@openers A2
> Как прошли твои выходные? | How was your weekend?
= Отлично! Я ездил{|а} на пляж. | Great! I went to the beach.
= Спокойно. Отдыхал{|а} дома. | Quiet. I rested at home.
? good: Супер! | Super!
? else: Иногда спокойные выходные — самые лучшие. | Sometimes quiet weekends are the best.
* выходные = weekend
> Что ты обычно делаешь по утрам? | What do you usually do in the mornings?
= Пью кофе и иду на работу. | I drink coffee and go to work.
= Хожу в спортзал перед работой. | I go to the gym before work.
? else: Хорошее начало дня! | A good start to the day!
* по утрам = in the mornings
> Какой твой любимый праздник? | What's your favourite holiday?
= Новый год. | New Year.
= День благодарения — много еды! | Thanksgiving — lots of food!
? has=нов: В России Новый год — самый главный праздник! | In Russia New Year is the main holiday!
? else: Отличный праздник! | Great holiday!
* праздник = holiday
> Что ты делал{|а} вчера вечером? | What did you do last night?
= Смотрел{|а} фильм. | I watched a film.
= Играл{|а} в шахматы онлайн. | I played chess online.
? else: Понятно! | I see!
> Какая у тебя была первая работа? | What was your first job?
= Я работал{|а} в ресторане. | I worked in a restaurant.
= Я продавал{|а} одежду в магазине. | I sold clothes in a shop.
? else: Интересно! Все с чего-то начинают. | Interesting! Everyone starts somewhere.
* первый = first
> Где ты был{|а} в последний отпуск? | Where did you go on your last holiday?
= Я был{|а} в Мексике. | I was in Mexico.
= Давно не был{|а} в отпуске! | I haven't had a holiday in ages!
? has=давно: Тебе пора отдохнуть! | It's time you had a rest!
? else: Здорово! | Great!
* отпуск = holiday, vacation
> Ты умеешь плавать? | Can you swim?
= Да, хорошо плаваю. | Yes, I swim well.
= Немного. | A little.
? else: Здорово! Летом пригодится. | Great! Handy in summer.
* плавать = to swim
> Ты любишь готовить? | Do you like cooking?
= Да, особенно на гриле. | Yes, especially on the grill.
= Нет, я обычно заказываю еду. | No, I usually order food.
? no, has=заказ: Доставка — лучший друг! | Delivery is your best friend!
? else: Здорово! | Great!

@openers B1
> Что бы ты изменил{|а} в своём городе? | What would you change in your city?
= Я бы сделал{|а} больше парков. | I'd make more parks.
= Меньше пробок, пожалуйста! | Less traffic, please!
? has=пробк: Это мечта всех городов. | That's every city's dream.
? else: Хорошая идея. | Good idea.
* изменить = to change
> Что тебя мотивирует? | What motivates you?
= Моя семья и мои цели. | My family and my goals.
= Желание быть лучше, чем вчера. | The desire to be better than yesterday.
? else: Это сильная мотивация. | That's strong motivation.
* цель = goal
> Чем ты гордишься? | What are you proud of?
= Я горжусь тем, что учу русский. | I'm proud that I'm learning Russian. // «Гордиться» + instrumental: горжусь тем, что…
= Своей работой. Я многого добил{ся|ась}. | My work. I've achieved a lot.
? has=русск: И правильно! | And rightly so!
? else: Это здорово. | That's great.
* гордиться = to be proud of
> Ты веришь в любовь с первого взгляда? | Do you believe in love at first sight?
= Да, конечно! | Yes, of course!
= Нет, любовь нужно построить. | No, love has to be built.
? yes: Романтик! | A romantic!
? no: Мудро. | Wise.
? else: Интересно. | Interesting.
* с первого взгляда = at first sight
> Что лучше: жить в большом городе или в маленьком? | What's better: living in a big city or a small one?
= В большом — там больше возможностей. | In a big one — there are more opportunities.
= В маленьком — там спокойнее. | In a small one — it's calmer.
? has=больш: А я, наоборот, люблю тишину. | I'm the opposite, I like quiet.
? has=маленьк/спокойн: {{Согласен|Согласна}}, большие города утомляют. | Agreed, big cities are tiring.
? else: У всего есть плюсы. | Everything has its pluses.
* возможность = opportunity

@openers B2
> Как ты думаешь, технологии делают нас счастливее? | Do you think technology makes us happier?
= С одной стороны, да, но с другой — мы стали более одинокими. | On the one hand yes, but on the other we've become lonelier. // «С одной стороны… с другой…» — a classic way to weigh both sides.
= Думаю, всё зависит от того, как их использовать. | I think it all depends on how you use them.
? else: Глубокая мысль. | A deep thought.
* с одной стороны = on the one hand
> Что для тебя значит успех? | What does success mean to you?
= Делать то, что любишь, и не думать о деньгах. | Doing what you love without thinking about money.
= Успех — это когда семья счастлива. | Success is when your family is happy.
? else: Красиво сказано. | Beautifully said.
* успех = success
> Если бы ты мог{|ла} поговорить с любым человеком из истории, кто бы это был? | If you could talk to anyone from history, who would it be?
= С Пушкиным — спросил{|а} бы, как писать стихи. | With Pushkin — I'd ask how to write poetry.
= С Каспаровым, конечно! | With Kasparov, of course!
? has=пушкин/толст/достоевск: Ого, русская классика! | Wow, Russian classics!
? else: Интересный выбор! | Interesting choice!
* любой = any
> Какая черта характера тебе больше всего нравится в людях? | Which character trait do you like most in people?
= Честность. Не люблю, когда врут. | Honesty. I don't like it when people lie.
= Чувство юмора. С ним всё легче. | A sense of humour. Everything's easier with it.
? has=юмор: {{Согласен|Согласна}}! Без юмора никуда. | Agreed! You can't do without humour.
? else: Это очень важно. | That's very important.
* черта характера = character trait
* чувство юмора = sense of humour

@quick A1
> Как тебя зовут? | What's your name?
= Меня зовут [me]. | My name is [me].
? else: Приятно познакомиться! | Nice to meet you!
> Откуда ты? | Where are you from?
= Я из Америки. | I'm from America.
? else: Понятно! | I see!
> Ты говоришь по-русски? | Do you speak Russian?
= Да, немного. | Yes, a little.
= Я учу русский. | I'm learning Russian.
? else: Отлично! | Great!
> Ты устал{|а}? | Are you tired?
= Да, немного. | Yes, a little.
= Нет, всё хорошо. | No, all good.
? else: Понятно! | I see!
> Ты голод{ен|на}? | Are you hungry?
= Да, очень! | Yes, very!
= Нет, я уже поел{|а}. | No, I've already eaten.
? else: Понятно! | I see!
> Ты любишь собак? | Do you like dogs?
= Да, очень люблю. | Yes, I love them.
= Больше кошек. | I prefer cats.
? else: Понятно! | I see!
> Ты сейчас дома? | Are you at home now?
= Да, я дома. | Yes, I'm at home.
= Нет, я на работе. | No, I'm at work.
? else: Ясно! | Got it!
> Какая сегодня погода? | What's the weather like today?
= Сегодня тепло и солнечно. | It's warm and sunny today.
= Идёт дождь. | It's raining.
? else: Ясно! | Got it!
> Ты хорошо спал{|а}? | Did you sleep well?
= Да, отлично. | Yes, great.
= Не очень. | Not really.
? else: Понятно. | I see.
> Ты любишь зиму? | Do you like winter?
= Нет, я люблю лето. | No, I love summer.
= Да, я люблю снег. | Yes, I love snow.
? else: Понятно! | I see!
> Что ты пьёшь утром? | What do you drink in the morning?
= Кофе. | Coffee.
= Чай с лимоном. | Tea with lemon.
? else: Ясно! | Got it!
> У тебя есть брат или сестра? | Do you have a brother or sister?
= Да, у меня есть брат. | Yes, I have a brother.
= Нет, у меня нет. | No, I don't.
? else: Понятно! | I see!
> Где ты работаешь? | Where do you work?
= Я работаю в салоне, продаю машины. | I work at a dealership, I sell cars.
= В магазине. | In a shop.
? else: Ясно! | Got it!
> Ты любишь музыку? | Do you like music?
= Да, очень. | Yes, a lot.
= Конечно! Особенно рок. | Of course! Especially rock.
? else: Понятно! | I see!
> Сколько тебе лет? | How old are you?
= Мне тридцать лет. | I'm thirty.
= Мне двадцать пять. | I'm twenty-five.
? else: Ясно! | Got it!

@quick A2
> Что ты делал{|а} вчера? | What did you do yesterday?
= Работал{|а}, а вечером отдыхал{|а}. | I worked, and in the evening I rested.
= Ходил{|а} в спортзал. | I went to the gym.
? else: Понятно! | I see!
> Куда ты пойдёшь вечером? | Where will you go this evening?
= Никуда, буду дома. | Nowhere, I'll be at home.
= Пойду в спортзал. | I'll go to the gym.
? else: Понятно! | I see!
> Что ты будешь делать завтра? | What will you do tomorrow?
= Завтра я работаю. | I'm working tomorrow.
= Буду отдыхать. | I'll rest.
? else: Ясно! | Got it!
> Ты когда-нибудь был{|а} в России? | Have you ever been to Russia?
= Нет, но очень хочу. | No, but I really want to.
= Нет, ещё не был{|а}. | No, not yet.
? else: Обязательно поедешь! | You'll definitely go!
* когда-нибудь = ever
> Сколько языков ты знаешь? | How many languages do you know?
= Два: английский и немного украинский. | Two: English and a bit of Ukrainian.
= Английский и немного русский. | English and a little Russian.
? else: Отлично! | Great!
> Как часто ты играешь в шахматы? | How often do you play chess?
= Каждый день. | Every day.
= Несколько раз в неделю. | A few times a week.
? else: Хорошо! | Good!
> Во сколько ты обычно ложишься спать? | What time do you usually go to bed?
= В одиннадцать вечера. | At eleven in the evening.
= Поздно, после полуночи. | Late, after midnight.
? else: Понятно! | I see!
* ложиться спать = to go to bed
> Что ты купил{|а} недавно? | What did you buy recently?
= Новые кроссовки. | New trainers.
= Ничего особенного. | Nothing special.
? else: Понятно! | I see!
> Ты любишь гулять? | Do you like going for walks?
= Да, особенно у моря. | Yes, especially by the sea.
= Не очень, я больше люблю дом. | Not really, I prefer home.
? else: Понятно! | I see!
> Где ты был{|а} вчера? | Where were you yesterday?
= Я был{|а} на работе. | I was at work.
= Весь день был{|а} дома. | I was at home all day.
? else: Ясно! | Got it!
> Ты умеешь водить машину? | Can you drive a car?
= Да, конечно. | Yes, of course.
= Да, я вожу каждый день. | Yes, I drive every day.
? else: Понятно! | I see!
> Какой твой любимый фильм? | What's your favourite film?
= «Крёстный отец». | "The Godfather".
= Я люблю «Интерстеллар». | I love Interstellar.
? else: Хороший выбор! | Good choice!
> С кем ты живёшь? | Who do you live with?
= С другом. | With a friend.
= Один{|а}. | Alone.
? else: Понятно! | I see!

@quick B1
> Что тебя сегодня порадовало? | What made you happy today?
= Хорошая партия в шахматы. | A good game of chess.
= Солнце и хороший кофе. | The sun and good coffee.
? else: Это важно — замечать хорошее. | It's important to notice the good things.
> Чего ты боишься? | What are you afraid of?
= Высоты. | Heights.
= Ничего! Ну, может, пауков. | Nothing! Well, maybe spiders.
? else: Понимаю. | I understand.
* бояться = to be afraid of
> Что бы ты сделал{|а} с миллионом долларов? | What would you do with a million dollars?
= Купил{|а} бы дом для родителей. | I'd buy my parents a house.
= Путешествовал{|а} бы по миру. | I'd travel the world.
? else: Хороший план! | Good plan!
> Какая у тебя мечта? | What's your dream?
= Свободно говорить по-русски. | To speak Russian fluently.
= Свой бизнес. | My own business.
? else: Всё получится! | It'll all work out!
> Что тебе не нравится в твоей работе? | What don't you like about your job?
= Долгие смены. | Long shifts.
= Иногда клиенты бывают грубыми. | Sometimes customers are rude.
? else: Понимаю. | I understand.
> Кто твой лучший друг и почему? | Who's your best friend and why?
= Тре — мы всегда поддерживаем друг друга. | Tre — we always support each other.
= Мой брат. Он меня понимает. | My brother. He understands me.
? else: Здорово, когда есть такой человек. | It's great to have someone like that.

@quick B2
> Что бы ты сказал{|а} себе в шестнадцать лет? | What would you tell yourself at sixteen?
= Не бойся ошибаться. | Don't be afraid to make mistakes.
= Учи языки раньше! | Learn languages earlier!
? else: Мудрый совет. | Wise advice.
> Какое решение в жизни ты считаешь самым важным? | Which decision in your life do you consider the most important?
= Переезд во Флориду. | Moving to Florida.
= Начать учить русский. | Starting to learn Russian.
? else: Интересно! | Interesting!
> Что делает человека интересным собеседником? | What makes someone an interesting person to talk to?
= Умение слушать. | The ability to listen.
= Любопытство и чувство юмора. | Curiosity and a sense of humour.
? else: {{Согласен|Согласна}}. | Agreed.
* собеседник = conversation partner
`;
