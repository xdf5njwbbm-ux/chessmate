// Role-play scenarios, A1–A2. [follow] isn't a flag here — any beat can lead into a topic
// the player mentions; [ask] marks beats where the player should ask the question.
// [me] = the player's name (or a stand-in name in example answers).

export const SCENARIOS_A = String.raw`
@scenario greet A1 ty dima
title: Привет! Как дела? | Greetings and "How are you?"
about: You bump into your friend Дима. Say hi, answer «Как дела?» in different ways — and ask back.
goal: Answering «Как дела?» naturally, and asking back: «А у тебя?», «А ты как?»
end: Ладно, мне пора. Пока! Хорошего дня! | Right, I've got to go. Bye! Have a good day!
> Привет! Как дела? | Hi! How are you?
- Привет! Как дела? (How are you?) | Hi! How are you?
~ Здорово! Как жизнь? | Hey! How's life?
= Хорошо, спасибо! А у тебя? | Good, thanks! And you? // Answer, then ask back — Russians almost always return the question.
= Всё отлично! А ты как? | Everything's great! How about you?
= Неплохо. А как твои дела? | Not bad. And how are you doing?
? good: {{Рад|Рада}} слышать! | Glad to hear it!
? ok: Ну, нормально — это тоже хорошо. | Well, fine is good too.
? bad: Ой, что случилось? Надеюсь, ничего серьёзного. | Oh, what happened? I hope it's nothing serious.
? else: Понятно! | I see!
* Как дела? = How are you?
* А у тебя? = And you?
! Answer, then ask back: «Хорошо, спасибо! А у тебя?». Leaving out «А у тебя?» can sound cold.
> {{Рад|Рада}} тебя видеть! Как проходит твой день? | Glad to see you! How's your day going?
- Как проходит твой день? (How is your day going?) | How's your day going?
~ Как день, нормально? | How's the day, all right?
= Потихоньку. Много работы. | Little by little. Lots of work. // «Потихоньку» — 'slowly but surely'; a very Russian answer.
= Отлично! У меня сегодня выходной. | Great! I have a day off today.
= Немного устал{|а}, но всё хорошо. | A bit tired, but all good.
? busy: Понимаю, у меня тоже завал. | I get it, I'm swamped too.
? tired: Отдохни вечером обязательно. | Make sure you rest this evening.
? good, has=выходн: Повезло! Отдыхай! | Lucky! Enjoy the rest!
? ok: Потихоньку — это нормально. | Little by little is fine.
? else: Ясно! | Got it!
* потихоньку = little by little
* выходной = day off
> Что нового? | What's new?
~ Ну, рассказывай, что новенького? | So, tell me, what's new?
= Да ничего особенного. | Nothing special really. // The classic answer. «Да» here just softens it.
= У меня новая работа! | I have a new job!
= Всё по-старому. | Everything's the same as before.
? has=особенн/по-старому/ничего/=нет: Ну, нет новостей — хорошие новости. | Well, no news is good news.
? has=нов, good: Ого, поздравляю! Рассказывай! | Wow, congratulations! Tell me!
? else: Интересно! | Interesting!
* ничего особенного = nothing special
* по-старому = the same as before
> Как настроение? | How are you feeling? (what's your mood?)
= Отличное! | Great!
= Бывает и лучше. | Could be better. // A soft way to say things aren't great.
= Сегодня намного лучше, чем вчера. | Much better today than yesterday.
? good: Супер! Это заметно. | Super! It shows.
? bad: Эх. Хочешь поговорить об этом? | Ah. Want to talk about it?
? else: Хорошо, что хорошо! | Good that it's good!
* настроение = mood
* бывает и лучше = could be better
> [ask] Знаешь, я тоже сегодня весь день работал. Но ты меня даже не спросил{|а}, как у меня дела! | You know, I worked all day today too. But you didn't even ask how I'm doing!
- Ты меня не спросил{|а}, как у меня дела! (Ask him: «А у тебя как дела?») | You didn't ask how I'm doing! (Ask him back.)
= Ой, прости! А как твои дела? | Oh, sorry! And how are you doing?
= А у тебя как дела? Как работа? | And how are things with you? How's work?
? q, askback: Спасибо, что спросил{|а}! Устал, но всё хорошо. | Thanks for asking! Tired, but all good.
? else: Ха, ладно. В следующий раз спроси: «А у тебя?» | Ha, fine. Next time, ask: «А у тебя?»
! Practise asking: «А как твои дела?», «А у тебя как?», «А ты как?»
> Слушай, мне надо бежать. Было очень приятно тебя видеть! | Listen, I have to run. It was really nice to see you!
= Мне тоже! Пока! | Me too! Bye!
= Взаимно! До встречи! | Likewise! See you! // «Взаимно» — 'likewise', a neat one-word reply.
= Давай, пока! Созвонимся. | OK, bye! Let's talk soon.
? else: Пока-пока! | Bye-bye!
* взаимно = likewise
* созвонимся = let's call each other

@scenario meet A1 ty nastya
title: Знакомство | Meeting someone for the first time
about: At a friend's party you meet Настя. Introduce yourself and get to know each other.
goal: Names, where you're from, what you do, and «Очень приятно!»
end: Пиши мне! Пока! | Text me! Bye!
> Привет! Я Настя. А как тебя зовут? | Hi! I'm Nastya. And what's your name?
- Привет! Я Настя. Как тебя зовут? (What's your name?) | Hi! I'm Nastya. What's your name?
= Привет! Меня зовут [me]. Очень приятно! | Hi! My name is [me]. Nice to meet you! // «Меня зовут…» — literally 'they call me…'.
= Привет, Настя! Я [me]. | Hi, Nastya! I'm [me].
? name: Очень приятно[, name]! | Nice to meet you!
? else: Очень приятно! | Nice to meet you!
* Как тебя зовут? = What's your name?
* Очень приятно = Nice to meet you
> Ты здесь в первый раз? | Is this your first time here?
= Да, в первый раз. Меня пригласил друг. | Yes, first time. A friend invited me.
= Нет, я уже был{|а} здесь. | No, I've been here before.
? yes: Добро пожаловать! Здесь классно. | Welcome! It's great here.
? no: А, значит, ты уже всех знаешь! | Ah, so you already know everyone!
? else: Понятно! | I see!
* в первый раз = for the first time
> Откуда ты? | Where are you from?
= Я из Америки, из Флориды. | I'm from America, from Florida. // «Из» + genitive: из Америки, из Флориды.
= Я американец, но учу русский. | I'm American, but I'm learning Russian.
? has=америк/сша/флорид/штат: Ого, из Америки! Далеко. А у вас там тепло, да? | Wow, from America! Far away. It's warm there, right?
? else: Интересно! Я никогда там не была. | Interesting! I've never been there.
* откуда = where from
> А чем ты занимаешься? | And what do you do?
= Я работаю в продажах. | I work in sales.
= Я продаю машины. | I sell cars.
= Я учусь и работаю. | I study and work.
? has=продаж/продаю/машин: Здорово! Значит, ты умеешь убеждать. | Great! So you know how to persuade people.
? else: Звучит интересно! | Sounds interesting!
* чем ты занимаешься? = what do you do?
> Ты хорошо говоришь по-русски! Ты давно учишь русский? | You speak Russian well! Have you been learning long?
= Спасибо! Нет, недавно, несколько месяцев. | Thanks! No, recently, a few months.
= Спасибо, я стараюсь! Уже год. | Thanks, I try! A year already. // «Я стараюсь» — 'I try'; modest and natural after a compliment.
? number, has=год/месяц/недел: Для такого времени — очень хорошо! | For that amount of time — very good!
? else: У тебя отлично получается! | You're doing great!
* давно = for a long time
* недавно = recently
> Сколько тебе лет, если не секрет? | How old are you, if it's not a secret?
= Мне двадцать восемь лет. | I'm twenty-eight. // Age uses «мне»: «Мне 28 лет».
= Это секрет! А тебе? | That's a secret! And you?
? number: Ага, почти как мне! | Aha, almost like me!
? has=секрет: Ха, загадочн{ый|ая}! | Ha, mysterious!
? else: Понятно! | I see!
* Сколько тебе лет? = How old are you?
> [ask] Ой, я задаю столько вопросов! Теперь твоя очередь — спроси меня что-нибудь. | Oh, I'm asking so many questions! Now it's your turn — ask me something.
- Теперь ты спроси меня что-нибудь! (Ask: «Откуда ты?», «Чем ты занимаешься?») | Now you ask me something!
= А ты откуда? | And where are you from?
= А чем ты занимаешься? | And what do you do?
= Что ты любишь делать в свободное время? | What do you like to do in your free time?
? q: Хороший вопрос! | Good question!
? else: Ну давай, не стесняйся — спроси что-нибудь! | Come on, don't be shy — ask something!
! Questions to keep a conversation going: «А ты?», «А что ты любишь?», «А откуда ты?»
> Было очень приятно познакомиться! Давай обменяемся номерами? | It was really nice to meet you! Shall we swap numbers?
= Давай! Мне тоже было очень приятно. | Sure! It was really nice for me too.
= Конечно! Вот мой номер. | Of course! Here's my number.
? yes, good, agree: Супер! Напишу тебе завтра. | Super! I'll text you tomorrow.
? else: Ну ладно! | Oh, all right!
* познакомиться = to get acquainted, to meet
* номер = (phone) number

@scenario crush A2 ty katya
title: Девушка, которая нравится | Talking to a girl you like
about: In a chess café you start talking to Катя. Be friendly, curious — and brave enough to ask her out.
goal: Small talk, light compliments, asking someone to meet again
end: Пока! Напиши мне! | Bye! Text me!
> Привет! Ты тоже любишь шахматы? | Hi! Do you love chess too?
~ Привет! Тоже шахматист{|ка}? | Hi! A chess player too?
= Привет! Да, очень люблю. Хочешь сыграть? | Hi! Yes, I love it. Want to play? // A question at the end invites her to keep talking.
= Да! Я играю почти каждый день. | Yes! I play almost every day.
? yes, like: Отлично, наконец-то есть с кем поговорить о шахматах! | Great, finally someone to talk to about chess!
? else: Ну, никогда не поздно полюбить! | Well, it's never too late to fall in love with it!
> Ты часто сюда приходишь? | Do you come here often?
= Да, почти каждые выходные. | Yes, almost every weekend.
= Нет, сегодня в первый раз. | No, today's the first time.
? yes: Странно, что я тебя раньше не видела! | Strange that I haven't seen you before!
? no: Значит, мне повезло! | So I'm lucky!
? else: Понятно! | I see!
* часто = often
> Я Катя, кстати. А тебя как зовут? | I'm Katya, by the way. And what's your name?
= Очень приятно, Катя! Меня зовут [me]. | Nice to meet you, Katya! My name is [me].
= Я [me]. Красивое имя — Катя. | I'm [me]. Katya is a pretty name. // A small compliment works well here.
? has=красив: Спасибо! Ты очень мил{ый|ая}. | Thank you! You're very sweet.
? name: Приятно познакомиться[, name]! | Nice to meet you!
? else: Приятно познакомиться! | Nice to meet you!
* кстати = by the way
> Что ты любишь делать, кроме шахмат? | What do you like doing, apart from chess?
= Я люблю спорт и путешествовать. | I love sport and travelling.
= Я люблю готовить и гулять у моря. | I love cooking and walking by the sea.
? has=готов: Ты умеешь готовить? Это очень привлекательно! | You can cook? That's very attractive!
? has=путешеств: Я тоже! Это моя мечта — путешествовать. | Me too! It's my dream — to travel.
? else: Интересно! | Interesting!
* кроме = apart from
> А ты умеешь танцевать? Я обожаю сальсу. | And can you dance? I love salsa.
= Не очень, но могу научиться! | Not really, but I can learn! // Playful and positive — a good flirting move.
= Нет, совсем не умею. Научишь? | No, not at all. Will you teach me?
? has=научи: Может быть… если выиграешь у меня в шахматы! | Maybe… if you beat me at chess!
? yes: Правда? Тогда пойдём как-нибудь танцевать! | Really? Then let's go dancing sometime!
? else: Ничего, я научу! | No worries, I'll teach you!
* уметь = to know how to
* научить = to teach
> [ask] Ой, я всё говорю о себе. Твоя очередь — спроси меня что-нибудь! | Oh, I keep talking about myself. Your turn — ask me something!
= Откуда ты? | Where are you from?
= Чем ты занимаешься? | What do you do?
= А что ты делаешь в эти выходные? | And what are you doing this weekend? // A natural lead-in to asking her out.
? q: Ага, хороший вопрос! | Aha, good question!
? else: Ну же, спроси что-нибудь! | Come on, ask something!
> Слушай, мне скоро уходить. Было здорово поговорить! | Listen, I have to leave soon. It was great talking!
= Мне тоже! Можно твой номер? | Me too! Can I have your number?
= Давай встретимся ещё раз? Например, в субботу? | Shall we meet again? Say, on Saturday? // «Давай встретимся» — 'let's meet'.
? has=номер/телефон: Конечно! Записывай. | Of course! Write it down.
? has=встрет/суббот/воскрес/пятниц/кофе/кино: С удовольствием! | With pleasure!
? else: Мне тоже было очень приятно. | It was really nice for me too.
* встретиться = to meet up

@scenario day A2 ty dima
title: Как прошёл день? | Talking about your day
about: Дима asks about your day — and really listens. Mention what you did and he'll ask more.
goal: Past tense (работал, ходил, был), daily routine, follow-up questions
end: Ладно, не буду мешать тебе играть. Удачи! | OK, I won't distract you from your game. Good luck!
> Привет! Как дела? | Hi! How are you?
= Хорошо, спасибо. А у тебя? | Good, thanks. And you?
= Нормально. А ты как? | Fine. How about you?
? good, ok: Отлично! | Great!
? bad: Эх, сочувствую. | Ah, sorry to hear that.
? else: Понятно! | I see!
> Чем ты сегодня {занимался|занималась}? | What did you do today?
- Что ты сегодня делал{|а}? (What did you do today?) | What did you do today?
~ Ну, чем сегодня {занимался|занималась}? | So, what've you been up to today?
= Я работал{|а}, а потом пош{ёл|ла} в спортзал. | I worked, and then I went to the gym. // Past tense: -л for men, -ла for women.
= Весь день был{|а} дома и отдыхал{|а}. | I was at home all day and rested.
= С утра работал{|а}, а вечером играл{|а} в шахматы. | I worked in the morning and played chess in the evening.
? topic=gym: Здорово! | Great!
? topic=rest: Тоже правильно — иногда надо отдыхать. | That's right too — sometimes you need to rest.
? topic=chess: Ха, кто бы сомневался! | Ha, who'd have doubted it!
? else: Понятно! | I see!
* заниматься = to be busy with, to do
* потом = then, afterwards
> Во сколько ты сегодня встал{|а}? | What time did you get up today?
= Я встал{|а} в семь утра. | I got up at seven in the morning. // «В семь утра» — at seven in the morning.
= Поздно, в десять! | Late, at ten!
? has=поздно/десят/одиннадц/двенадц: Везёт! Я в шесть. | Lucky! I got up at six.
? number: Рано! Ты молодец. | Early! Well done.
? else: Ясно! | Got it!
* вставать = to get up
> Что было самое интересное сегодня? | What was the most interesting thing today?
= Я встретил{|а} старого друга. | I met an old friend.
= Ничего особенного, обычный день. | Nothing special, an ordinary day.
? has=особенн/обычн: Обычные дни тоже нужны. | Ordinary days are needed too.
? else: Классно! | Cool!
* самое интересное = the most interesting thing
> А что ты будешь делать вечером? | And what will you do this evening?
= Вечером буду играть в шахматы. | In the evening I'll play chess. // Future: «буду» + infinitive.
= Хочу отдохнуть и посмотреть фильм. | I want to rest and watch a film.
? topic=chess: Отлично. Только не проиграй! | Great. Just don't lose!
? topic=movies: Хороший план. | Good plan.
? else: Хороший план! | Good plan!
* вечером = in the evening

@scenario work A2 ty dima
title: Работа и коллеги | Discussing work and coworkers
about: Дима wants to hear how work's going — your week, your coworkers, your boss.
goal: Work vocabulary, describing people, likes and dislikes
end: Ладно, удачи на работе! Ты молодец. | OK, good luck at work! You're doing great.
> Ну как работа? Как прошла неделя? | So how's work? How was the week?
~ Ну чё, как там работа? | So, how's work going?
= Неделя была тяжёлая, но хорошая. | The week was tough, but good.
= Нормально, было много клиентов. | Fine, there were lots of customers.
? bad, busy, tired: Понимаю. Тяжёлые недели бывают. | I get it. Tough weeks happen.
? good, ok: Отлично! | Great!
? else: Ясно. | Got it.
* неделя = week
* тяжёлый = hard, heavy
> Тебе нравятся твои коллеги? | Do you like your coworkers?
= Да, у меня отличные коллеги. | Yes, I have great coworkers.
= Не все. Один коллега очень много говорит! | Not all of them. One coworker talks a lot!
? yes, good, like: Повезло! Это редкость. | Lucky! That's rare.
? has=говорит/много/болтает: Ха, такой есть в каждом офисе! | Ha, there's one in every office!
? else: Понятно. Везде по-разному. | I see. It's different everywhere.
* коллега = coworker
> А начальник у тебя какой? | And what's your boss like?
= Строгий, но справедливый. | Strict, but fair. // «Строгий, но справедливый» — a classic description.
= Хороший, всегда помогает. | Good, always helps.
? has=строг: Строгий — это не всегда плохо. | Strict isn't always bad.
? good, has=хорош/помога: Хороший начальник — это половина успеха. | A good boss is half the success.
? else: Ясно. | Got it.
* начальник = boss
* справедливый = fair
> Что ты обычно делаешь на работе? | What do you usually do at work?
= Я встречаю клиентов и помогаю им выбрать машину. | I meet customers and help them choose a car.
= Отвечаю на звонки, пишу письма и продаю. | I answer calls, write emails and sell.
? has=машин: Значит, ты эксперт по машинам! | So you're a car expert!
? else: Звучит как много работы! | Sounds like a lot of work!
* выбрать = to choose
> У тебя бывают трудные клиенты? | Do you get difficult customers?
= Да, бывают. Иногда клиент кричит. | Yes, sometimes. Sometimes a customer shouts.
= Бывают, но я стараюсь быть вежлив{ым|ой}. | Sometimes, but I try to be polite.
? yes, has=быва: Уважаю. Нужно иметь терпение. | Respect. You need patience.
? no: Повезло! | Lucky!
? else: Понятно. | I see.
* вежливый = polite
* терпение = patience
> Как ты отдыхаешь после работы? | How do you unwind after work?
= Иду в спортзал или играю в шахматы. | I go to the gym or play chess.
= Просто лежу на диване. | I just lie on the sofa.
? else: Хороший способ отдохнуть! | A good way to rest!
> [B1] А ты хочешь работать там долго или думаешь о чём-то новом? | And do you want to work there for a long time, or are you thinking about something new?
= Пока мне нравится, но в будущем хочу расти. | I like it for now, but in the future I want to grow.
= Я думаю о своём бизнесе. | I'm thinking about my own business.
? has=бизнес: Смело! Я в тебя верю. | Bold! I believe in you.
? else: Правильно — главное, чтобы было интересно. | Right — the main thing is that it's interesting.
* расти = to grow

@scenario restaurant A2 vy artyom
title: В ресторане | Ordering food at a restaurant
about: Артём, your waiter, takes your order. Be polite — use вы and «пожалуйста».
goal: «Мне, пожалуйста…», «Можно…?», asking for advice, the bill
end: Спасибо! Приходите к нам ещё! | Thank you! Come again!
> Добрый вечер! Вы готовы сделать заказ? | Good evening! Are you ready to order?
= Добрый вечер! Да, я готов{|а}. | Good evening! Yes, I'm ready.
= Ещё нет. Можно пару минут? | Not yet. Can I have a couple of minutes?
? no, has=минут: Конечно, не торопитесь. | Of course, take your time.
? yes, good: Отлично! | Great!
? else: Хорошо. | All right.
* заказ = order
> Что будете пить? | What will you drink?
= Мне, пожалуйста, чёрный чай. | Black tea for me, please. // «Мне, пожалуйста…» — the polite way to order.
= Можно стакан воды и кофе? | Can I have a glass of water and a coffee?
? has=чай/кофе/вод/сок/пив/вин: Хорошо, сейчас принесу. | All right, I'll bring it now.
? else: Понял. | Got it.
* Мне, пожалуйста… = For me, please…
* Можно…? = May I have…?
> На первое у нас сегодня борщ и куриный суп. Что желаете? | For the first course today we have borscht and chicken soup. What would you like?
= Борщ, пожалуйста. | Borscht, please.
= Я не буду суп, спасибо. | I won't have soup, thanks.
? has=борщ: Отличный выбор! Борщ у нас со сметаной. | Excellent choice! Our borscht comes with sour cream.
? has=куриный/курин: Хорошо, куриный суп. | OK, chicken soup.
? no, has==буду: Без проблем. | No problem.
? else: Хорошо. | All right.
* на первое = for the first course (soup)
> А на второе? Советую пельмени или котлеты с пюре. | And for the main? I recommend pelmeni or cutlets with mash.
= Пельмени, пожалуйста. Со сметаной. | Pelmeni, please. With sour cream.
= А что вы посоветуете? | And what do you recommend? // Asking for advice is very natural in Russian restaurants.
? q: Котлеты у нас очень вкусные — домашние! | Our cutlets are very tasty — home-made!
? has=пельмен: Пельмени — наш хит! | Pelmeni are our bestseller!
? else: Хорошо, записал. | OK, noted.
* на второе = for the main course
* посоветовать = to recommend
> Что-нибудь ещё? Может, десерт? | Anything else? Maybe dessert?
= Нет, спасибо, это всё. | No, thank you, that's all.
= Да, можно блины с мёдом? | Yes, can I have blini with honey?
? no: Хорошо. | All right.
? has=блин: Блины — это правильный выбор! | Blini are the right choice!
? else: Хорошо. | All right.
* это всё = that's all
> Как вам наш борщ? | How do you like our borscht?
= Очень вкусно, спасибо! | Very tasty, thank you!
= Немного солёный, но вкусный. | A bit salty, but tasty.
? has=солён/холодн, bad: Ой, извините! Я скажу повару. | Oh, I'm sorry! I'll tell the chef.
? good: Спасибо, передам повару! | Thank you, I'll pass it on to the chef!
? else: Спасибо! | Thank you!
* Как вам…? = How do you like…?
> Вам принести счёт? | Shall I bring you the bill?
= Да, пожалуйста. Можно оплатить картой? | Yes, please. Can I pay by card?
= Да, принесите, пожалуйста. | Yes, bring it, please.
? has=карт: Конечно, у нас можно картой. | Of course, you can pay by card here.
? else: Сейчас принесу. | I'll bring it now.
* счёт = the bill
* оплатить картой = to pay by card

@scenario furniture A2 vy marina
title: Покупаем мебель | Shopping for furniture
about: In a furniture store, Марина helps you find a sofa. Ask questions, compare, bargain a little.
goal: Describing what you need, sizes, colours, prices, «Есть скидка?»
end: Спасибо за покупку! Хорошего дня! | Thank you for your purchase! Have a good day!
> Здравствуйте! Чем могу помочь? | Hello! How can I help?
= Здравствуйте! Я ищу диван. | Hello! I'm looking for a sofa.
= Я просто смотрю, спасибо. | I'm just looking, thanks. // The standard way to say you're browsing.
? has=смотр: Хорошо! Если что — я рядом. | All right! If you need anything — I'm nearby.
? has=диван: Отлично, у нас большой выбор диванов. | Great, we have a big selection of sofas.
? else: Конечно, давайте посмотрим. | Of course, let's take a look.
* искать = to look for
> Для какой комнаты вы ищете мебель? | Which room are you looking for furniture for?
= Для гостиной. | For the living room.
= Для спальни. Ещё мне нужна кровать. | For the bedroom. I also need a bed.
? has=гостин: Для гостиной у нас есть отличные модели. | We have great models for the living room.
? has=спальн/кроват: Понятно. Кровати у нас на втором этаже. | I see. The beds are on the second floor.
? else: Понятно. | I see.
* гостиная = living room
* спальня = bedroom
> Какой размер вам нужен? | What size do you need?
= Не очень большой — комната маленькая. | Not very big — the room is small.
= Большой, на трёх человек. | Big, for three people.
? else: Хорошо, сейчас покажу. | All right, I'll show you.
* размер = size
> Какой цвет вам нравится? | What colour do you like?
= Серый или бежевый. | Grey or beige.
= Что-нибудь тёмное, например синий. | Something dark, for example blue.
? else: Хороший выбор, такие цвета сейчас популярны. | Good choice, those colours are popular now.
* цвет = colour
> Вот этот диван очень удобный. Хотите сесть, попробовать? | This sofa is very comfortable. Would you like to sit down, try it?
= Да, давайте. О, правда удобный! | Yes, let's. Oh, it really is comfortable!
= Он слишком мягкий для меня. | It's too soft for me.
? has=мягк/жёстк/жестк: Понимаю. Есть модель потвёрже. | I understand. There's a firmer model.
? good, yes: Правда? Это наш самый популярный. | Right? It's our most popular one.
? else: Хорошо. | All right.
* удобный = comfortable
* слишком = too
> Он стоит сорок пять тысяч рублей. | It costs forty-five thousand roubles.
= Это дороговато. Есть скидка? | That's a bit pricey. Is there a discount? // «Дороговато» — 'a bit pricey'; softer than «дорого».
= Хорошо, это нормальная цена. | OK, that's a reasonable price.
? has=скидк/дорог/дешевле: Для вас могу сделать скидку десять процентов. | For you I can do a ten per cent discount.
? else: Отлично. | Excellent.
* стоить = to cost
* скидка = discount
> Доставка нужна? | Do you need delivery?
= Да, нужна. Сколько стоит доставка? | Yes, I do. How much is delivery?
= Нет, спасибо, я заберу сам{|а}. | No, thanks, I'll pick it up myself.
? q, has=сколько: Доставка по городу бесплатная. | Delivery within the city is free.
? no: Хорошо, тогда склад работает до девяти. | All right, then the warehouse is open until nine.
? else: Хорошо, оформим. | OK, we'll arrange it.
* доставка = delivery
> Как будете платить — картой или наличными? | How will you pay — by card or cash?
= Картой, пожалуйста. | By card, please.
= Наличными. | Cash.
? else: Хорошо. Вот чек. | All right. Here's the receipt.
* наличные = cash

@scenario hobbies A2 ty nastya
title: Хобби | Talking about hobbies
about: Настя wants to know what you do for fun — and why you love it.
goal: «Я люблю + infinitive», how long, why
end: Договорились! Это будет весело. | Deal! It'll be fun.
> Что ты любишь делать в свободное время? | What do you like doing in your free time?
= Я люблю играть в шахматы и ходить в спортзал. | I love playing chess and going to the gym. // «Люблю» + infinitive: люблю играть, люблю ходить.
= В свободное время я читаю и гуляю. | In my free time I read and go for walks.
? else: Классно! | Cool!
* свободное время = free time
> Как давно ты этим занимаешься? | How long have you been doing that?
= Уже много лет. | For many years now.
= Недавно, около года. | Recently, about a year.
? has=лет/давно, number: Ого, ты профи! | Wow, you're a pro!
? else: Отлично, всё впереди! | Great, it's all ahead of you!
* около = about
> А почему тебе это нравится? | And why do you like it?
= Это помогает мне расслабиться. | It helps me relax.
= Мне нравится, что можно всё время учиться. | I like that you can keep learning all the time.
? else: Как хорошо ты это объяснил{|а}! | How well you explained that!
* расслабиться = to relax
> Есть хобби, которое ты хочешь попробовать? | Is there a hobby you want to try?
= Да, я хочу научиться играть на гитаре. | Yes, I want to learn to play the guitar.
= Хочу попробовать йогу. | I want to try yoga.
? has=йог: Пойдём со мной! Я хожу два раза в неделю. | Come with me! I go twice a week.
? else: Попробуй обязательно! | Definitely try it!
* попробовать = to try
> [ask] А ты знаешь, какое у меня хобби? | And do you know what my hobby is?
= Нет. Какое у тебя хобби? | No. What's your hobby?
= Не знаю. Расскажи! | I don't know. Tell me!
? q, dontknow, no: Я рисую! И ещё люблю кино. | I draw! And I love films too.
? else: Я рисую! И ещё люблю кино. | I draw! And I love films too.
> Давай как-нибудь займёмся чем-нибудь вместе? | Shall we do something together sometime?
= Давай! Может, сходим в кино? | Sure! Maybe we'll go to the cinema?
= С удовольствием! Научишь меня рисовать? | With pleasure! Will you teach me to draw?
? has=кино: Отлично, в кино! | Great, the cinema!
? has=рисова: С радостью научу! | I'll be glad to teach you!
? else: Отлично! | Great!
* как-нибудь = sometime

@scenario family A2 ty nastya
title: Семья | Talking about family
about: Настя asks about your family — who they are, where they live, what you do together.
goal: Family words, «У меня есть…», describing people
end: Как здорово! Семья — это главное. | How lovely! Family is the main thing.
> Расскажи о своей семье! | Tell me about your family!
= У меня есть мама, папа и младший брат. | I have a mum, a dad and a younger brother.
= У меня большая семья: два брата и сестра. | I have a big family: two brothers and a sister.
? else: Здорово! | Great!
* семья = family
> Где живут твои родители? | Where do your parents live?
= Они живут в другом городе. | They live in another city.
= Недалеко от меня, в десяти минутах. | Not far from me, ten minutes away.
? has=друг/далеко: Наверное, ты по ним скучаешь. | You probably miss them.
? else: Удобно! | Convenient!
* родители = parents
> Ты похож{|а} на маму или на папу? | Do you look like your mum or your dad?
= Говорят, я похож{|а} на папу. | They say I look like my dad. // «Быть похожим на» — to look like.
= Наверное, на маму. У нас одинаковые глаза. | Probably my mum. We have the same eyes.
? else: Как интересно! | How interesting!
* похож на = looks like
> Как вы обычно празднуете праздники? | How do you usually celebrate holidays?
= Мы собираемся у родителей и много едим! | We get together at my parents' and eat a lot!
= На Рождество вся семья вместе. | At Christmas the whole family is together.
? has=ед/еды/едим: Как у нас! Русские праздники — это много еды. | Like us! Russian holidays mean lots of food.
? else: Как уютно. | How cosy.
* праздник = holiday
> Ты часто звонишь родителям? | Do you call your parents often?
= Да, почти каждый день. | Yes, almost every day.
= Раз в неделю, по воскресеньям. | Once a week, on Sundays.
? else: Молодец. Родителям это важно. | Good for you. It matters to parents.
* звонить = to call
> [ask] Хочешь, я расскажу про свою семью? | Want me to tell you about my family?
= Конечно! У тебя есть братья или сёстры? | Of course! Do you have brothers or sisters?
= Да, расскажи! | Yes, tell me!
? q, yes: У меня младший брат, он студент. А родители живут в Питере. | I have a younger brother, he's a student. And my parents live in Petersburg.
? else: У меня младший брат и родители в Питере. | I have a younger brother and my parents in Petersburg.

@scenario weekend A2 ty dima
title: Планы на выходные | Making plans for the weekend
about: Дима wants to do something this weekend. Agree on what, when and where.
goal: Suggesting, agreeing, «Давай…», «Как насчёт…?», times and places
end: Договорились! До субботы! | Deal! See you Saturday!
> Какие планы на выходные? | What are your plans for the weekend?
~ Чё делаешь на выходных? | What are you up to this weekend?
= Пока не знаю. А у тебя? | Don't know yet. And you?
= В субботу работаю, а в воскресенье свобод{ен|на}. | I work on Saturday, but I'm free on Sunday.
? askback, q: Я хочу куда-нибудь сходить! | I want to go out somewhere!
? has=свобод/воскрес: Отлично, значит, есть время! | Great, so there's time!
? else: Понятно. | I see.
* выходные = the weekend
> Может, сходим куда-нибудь вместе? | Maybe we'll go somewhere together?
= Давай! Куда пойдём? | Sure! Where shall we go?
= С удовольствием! Есть идеи? | With pleasure! Any ideas?
? q: Можно в кино или в боулинг. | We could go to the cinema or bowling.
? yes, good: Супер! | Super!
? no: Жаль. Ну, может, в другой раз. | Shame. Well, maybe another time.
? else: Хорошо! | OK!
* куда-нибудь = somewhere
> Как насчёт боулинга в субботу вечером? | How about bowling on Saturday evening?
= Отличная идея! Во сколько? | Great idea! What time?
= В субботу я не могу. Может, в воскресенье? | I can't on Saturday. Maybe Sunday?
? has=воскрес/могу: Хорошо, давай в воскресенье. | OK, let's do Sunday.
? q, yes, good: В семь подойдёт? | Does seven work?
? else: Договорились. | Deal.
* Как насчёт…? = How about…?
> Давай в семь. Где встретимся? | Let's say seven. Where shall we meet?
= Давай у входа в торговый центр. | Let's meet at the entrance to the mall.
= Я могу заехать за тобой. | I can pick you up. // «Заехать за кем-то» — to pick someone up by car.
? has=заеха/заберу: Ты {лучший|лучшая}! | You're the best!
? else: Хорошо, договорились. | Good, agreed.
* встретиться = to meet
> Позовём ещё кого-нибудь? | Shall we invite someone else?
= Давай позовём Настю. | Let's invite Nastya.
= Нет, давай вдвоём. | No, let's go just the two of us.
? no, has=вдвоём/вдвоем: Ладно, вдвоём тоже хорошо. | OK, just us is good too.
? else: Отличная идея, чем больше, тем веселее! | Great idea, the more the merrier!
* позвать = to invite, call over
> А после боулинга можно поужинать. Что хочешь — пиццу или суши? | And after bowling we can have dinner. What do you want — pizza or sushi?
= Пиццу! | Pizza!
= Мне всё равно, выбирай ты. | I don't mind, you choose. // «Мне всё равно» — 'I don't mind'.
? has=пицц: Пицца — правильный выбор. | Pizza is the right choice.
? has=суши: Суши так суши! | Sushi it is!
? else: Ладно, решим на месте. | OK, we'll decide there.
* всё равно = (I) don't mind
`;
