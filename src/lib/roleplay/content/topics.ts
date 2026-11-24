// Topics the conversation can follow when you mention them ("…потом пошёл в спортзал"
// → "Ты часто ходишь в спортзал?"). Stems match the start of a word; "=word" matches
// the whole word. like/dislike are the partner's own opinion; callback brings the topic
// back later ("you mentioned…"). {m|f} = your form, {{m|f}} = the partner's.

export const TOPICS = String.raw`
@topic chess
stems: шахмат, партию, партия, партии, ферз, дебют, гроссмейстер, эндшпил, рокиров, =мат, =шах
react: О, шахматы — это моё! | Oh, chess — that's my thing!
react: Шахматы — отличная тренировка для мозга. | Chess is great training for the brain.
like: Я тоже обожаю шахматы. Особенно быстрые партии. | I love chess too. Especially fast games.
dislike: Честно говоря, я больше люблю быстрые партии, чем долгие. | Honestly, I prefer fast games to long ones.
callback: Слушай, а ты давно играешь в шахматы? | Listen, have you been playing chess for long?
> [A1] Ты часто играешь в шахматы? | Do you often play chess?
= Да, почти каждый день. | Yes, almost every day. // «Почти каждый день» — a handy phrase for frequency.
= Не очень часто, раз в неделю. | Not very often, once a week.
? yes, number: Ого! Тогда мне надо быть {{осторожным|осторожной}}. | Wow! Then I need to be careful.
? no: Ничего, главное — удовольствие. | No problem, the main thing is to enjoy it.
* часто = often
> [A2] А кто тебя научил играть? | And who taught you to play?
= Меня научил папа, когда я был{|а} маленьк{им|ой}. | My dad taught me when I was little. // «Когда я был маленьким» — 'when I was little'.
= Я научил{ся|ась} сам{|а}, по интернету. | I taught myself, online.
? has=пап/отец/дед: Как здорово! Семейная традиция. | How lovely! A family tradition.
? has=сам/интернет/ютуб/приложени: Сам{|а}? Уважаю! | Yourself? Respect!
? else: Здорово! Хороший учитель — это важно. | Great! A good teacher matters.
* научить = to teach
> [A2] Какой твой любимый дебют? | What's your favourite opening?
= Мне нравится итальянская партия. | I like the Italian Game. // Openings are «партия» or «защита»: итальянская партия, сицилианская защита.
= Я обычно играю е4, а дальше как получится. | I usually play e4, and then however it goes.
? else: Интересно! А я люблю сицилианскую защиту. | Interesting! And I love the Sicilian Defence.
* дебют = opening
> [B1] Что тебе больше нравится — атаковать или защищаться? | What do you like more — attacking or defending?
= Конечно, атаковать! Защищаться скучно. | Attacking, of course! Defending is boring.
= Я больше люблю спокойную позиционную игру. | I prefer a calm positional game.
? has=атак: Я так и {{думал|думала}}! Агрессивный игрок. | I thought so! An aggressive player.
? has=защищ/спокойн/позицион: Мудро. Терпение — сила. | Wise. Patience is strength.
? else: Понятно. У каждого свой стиль. | I see. Everyone has their own style.

@topic gym
stems: спортзал, =зал, =зале, =зал, тренир, качал, качаюсь, фитнес, штанг, гантел, =спорт, спортом, бегаю, бегал, пробежк, бассейн, плаваю, плавал, =йогу, =йога, йогой
react: Здорово! Спорт — это класс. | Great! Sport is awesome.
react: Молодец! Я тоже стараюсь заниматься спортом. | Well done! I try to do sport too.
like: Я тоже люблю спорт — после тренировки всегда отличное настроение. | I love sport too — after a workout I'm always in a great mood.
dislike: А я, честно говоря, {{ленивый|ленивая}} — в зал хожу редко. | Honestly, I'm lazy — I rarely go to the gym.
callback: Кстати, ты сегодня ещё пойдёшь в спортзал? | By the way, are you going to the gym again today?
> [A1] Ты часто ходишь в спортзал? | Do you go to the gym often?
- Ты часто ходишь в спортзал? Часто = often. | Do you go to the gym often? Часто = often.
~ И часто ты в зал ходишь? | And do you hit the gym often?
= Да, стараюсь ходить пять раз в неделю. | Yes, I try to go five times a week. // «Стараюсь» (I try to) makes it sound natural and modest.
= Нет, только два раза в неделю. | No, only twice a week.
? number, yes: Отлично! Это серьёзно. | Great! That's serious.
? no: Ну, два раза — это тоже неплохо! | Well, twice is not bad either!
* раз в неделю = once a week
* стараться = to try
> [A2] А что ты обычно тренируешь? | And what do you usually train?
= Обычно ноги и спину. | Usually legs and back.
= Я делаю кардио и немного штангу. | I do cardio and a bit of barbell.
? has=ног: О, день ног — самый тяжёлый! | Oh, leg day — the hardest!
? else: Понятно. Главное — без травм! | I see. The main thing is no injuries!
* тренировать = to train
> [A2] Сколько времени длится твоя тренировка? | How long does your workout last?
= Примерно час. | About an hour. // «Примерно» = about, roughly.
= Полтора часа, иногда два. | An hour and a half, sometimes two.
? number: Серьёзно! Ты настоящий спортсмен. | Serious! You're a real athlete.
? else: Хорошо! Главное — регулярно. | Good! The main thing is regularity.
* примерно = about, roughly
> [B1] Как ты себя мотивируешь, когда совсем не хочется идти? | How do you motivate yourself when you really don't feel like going?
= Я просто говорю себе: десять минут, а потом посмотрим. | I just tell myself: ten minutes, and then we'll see.
= Музыка помогает. И мысль о том, как хорошо будет потом. | Music helps. And thinking about how good it'll feel afterwards.
? else: Отличный совет, надо попробовать! | Great advice, I should try it!
* мотивировать = to motivate

@topic work
stems: работ, офис, смена, смену, смены, начальник, коллег, клиент, продаж, продаю, продал, продавц, покупател, зарплат, =босс, совещани, дилерск
react: Работа — это важно. | Work matters.
react: Понятно, рабочий день. | I see, a working day.
like: Я тоже люблю свою работу, хотя устаю. | I love my work too, though I get tired.
dislike: А мне иногда кажется, что работа — это вся моя жизнь. Надо больше отдыхать! | Sometimes I feel work is my whole life. I need to rest more!
callback: Как там у тебя на работе, кстати? Много клиентов было? | How's work going, by the way? Many customers?
> [A1] Кем ты работаешь? | What do you do for work?
- Кем ты работаешь? (What is your job?) | What do you do for work?
= Я работаю в продажах. | I work in sales. // «Работать в продажах» — to work in sales.
= Я продаю машины. | I sell cars.
? has=продаж/продаю/машин: О, продажи! Это непросто. Надо уметь говорить с людьми. | Oh, sales! That's not easy. You need to know how to talk to people.
? else: Интересно! | Interesting!
* продажи = sales
> [A2] Тебе нравится твоя работа? | Do you like your job?
= Да, мне нравится общаться с людьми. | Yes, I like talking with people. // «Общаться» — to talk, socialise; a key word.
= В целом да, но иногда очень устаю. | Overall yes, but sometimes I get very tired.
? yes, like, good: Это главное — когда работа в радость. | That's the main thing — when work is a joy.
? no, dislike, bad, tired: Понимаю. Иногда работа выматывает. | I understand. Sometimes work wears you out.
* общаться = to talk, socialise
> [A2] А какие у тебя коллеги? | And what are your coworkers like?
= Коллеги хорошие, мы часто шутим. | My coworkers are good, we often joke around.
= Разные. Есть хорошие, есть не очень. | Different. Some are good, some not so much.
? good, has=хорош/друж/весел/шут: Повезло! С хорошими коллегами и работать легче. | Lucky! With good coworkers, work is easier.
? else: Да, так везде. | Yes, it's like that everywhere.
* коллега = coworker
> [B1] Что самое трудное в твоей работе? | What's the hardest thing about your job?
= Самое трудное — когда клиент не знает, чего хочет. | The hardest thing is when a customer doesn't know what they want.
= Долгие смены. Иногда я работаю по десять часов. | Long shifts. Sometimes I work ten hours.
? has=клиент: Ха, знакомо! Клиенты бывают разные. | Ha, familiar! Customers come in all kinds.
? has=смен/час: Это много. Надо беречь себя. | That's a lot. You need to look after yourself.
? else: Понимаю. В каждой работе есть свои трудности. | I understand. Every job has its difficulties.
* самое трудное = the hardest thing

@topic study
stems: учусь, учеба, учебу, университет, универ, курсы, курсах, урок, экзамен, студент, =учу, учила, =учил, изуча, =русский, русского, русскому, =язык, языки
react: Учиться — это всегда полезно. | Learning is always useful.
react: О, учёба! Молодец. | Oh, studying! Well done.
like: Я тоже люблю учить новое. | I love learning new things too.
callback: Кстати, а как твой русский? Что сейчас учишь? | By the way, how's your Russian? What are you learning now?
> [A1] Почему ты учишь русский? | Why are you learning Russian?
= Мне нравится русский язык и культура. | I like the Russian language and culture.
= Я хочу говорить с друзьями по-русски. | I want to speak Russian with my friends. // «По-русски» — in Russian (with «говорить»).
? has=друз/подруг/девушк: Отличная причина! Друзья будут рады. | Great reason! Your friends will be happy.
? else: Здорово! У тебя уже хорошо получается. | Great! You're already doing well.
* по-русски = in Russian
> [A2] Что для тебя самое трудное в русском? | What's the hardest thing about Russian for you?
= Падежи! Их слишком много. | Cases! There are too many of them. // Every learner says this — «падежи» are the cases.
= Произношение и ударение. | Pronunciation and stress.
? has=падеж: Ха, падежи — это страшно только сначала. | Ha, cases are scary only at first.
? has=произнош/ударен: Да, ударение — это хитро. Но ты справишься! | Yes, stress is tricky. But you'll manage!
? else: Понимаю. Шаг за шагом! | I understand. Step by step!
* падеж = grammatical case
* ударение = stress (in a word)
> [A2] Сколько времени ты учишь русский каждый день? | How much time do you study Russian every day?
= Примерно полчаса в день. | About half an hour a day.
= Каждый день, пока играю в шахматы! | Every day, while I play chess!
? has=шахмат: Ха, отличная идея — и мозг, и язык! | Ha, great idea — brain and language!
? else: Хорошо! Главное — каждый день. | Good! The main thing is every day.
* полчаса = half an hour

@topic food
stems: =ел, =ела, =ем, поел, поела, поесть, еда, едой, обед, ужин, завтрак, пицц, суп, борщ, шашлык, бургер, суши, пасту, паста, салат, мясо, рыбу, курицу, готовлю, готовил, приготов, вкусн, голоден, голодна, пельмен, блины, блинчик
react: М-м, вкусно! | Mmm, tasty!
react: Ой, теперь я тоже хочу есть! | Oh, now I'm hungry too!
like: Я тоже это обожаю! | I love that too!
dislike: А я, честно говоря, не очень люблю это. Я больше люблю домашнюю еду. | Honestly, I don't really like that. I prefer home-made food.
callback: Слушай, а ты сегодня уже ел{|а}? | Listen, have you eaten today?
> [A1] Что ты ел{|а} на обед? | What did you have for lunch?
= Я ел{|а} суп и салат. | I had soup and salad. // «Ел/ела на обед» — what you had for lunch.
= Сегодня я ел{|а} пиццу. | Today I had pizza.
? has=пицц: Пицца — это всегда хорошая идея! | Pizza is always a good idea!
? has=суп/борщ/салат: Полезно! Молодец. | Healthy! Well done.
? else: Вкусно! | Tasty!
* обед = lunch
> [A1] Ты любишь готовить? | Do you like to cook?
= Да, я люблю готовить мясо. | Yes, I like cooking meat.
= Нет, я не умею готовить. | No, I can't cook. // «Не умею» — I don't know how to (a skill).
? yes, like: Здорово! Значит, когда-нибудь ты меня угостишь! | Great! So one day you'll treat me!
? no, dislike: Ничего, я тоже готовлю только яичницу! | No worries, I only make fried eggs too!
* готовить = to cook
* уметь = to know how to
> [A2] Ты пробовал{|а} русскую кухню? | Have you tried Russian food?
= Да, я пробовал{|а} борщ и пельмени. Очень вкусно! | Yes, I've tried borscht and pelmeni. Very tasty!
= Ещё нет, но очень хочу. | Not yet, but I really want to.
? yes, has=борщ/пельмен/блин: Отличный выбор! Пельмени — моя любовь. | Great choice! Pelmeni are my love.
? no: Обязательно попробуй пельмени со сметаной! | Definitely try pelmeni with sour cream!
? else: Обязательно попробуй! | You must try it!
* пробовать = to try (food)
> [B1] Какое блюдо ты мог{|ла} бы есть каждый день? | What dish could you eat every day?
= Пиццу. Никогда не надоест! | Pizza. It'll never get old!
= Наверное, мамин суп. | Probably my mum's soup.
? has=мам: Мамина еда — самая вкусная, это правда. | Mum's food is the tastiest, that's true.
? else: Хороший выбор! | Good choice!
* надоесть = to get tired of

@topic coffee
stems: кофе, =чай, =чаю, капучино, латте, эспрессо, кофейн
react: О, кофе — это святое! | Oh, coffee is sacred!
like: Я тоже не могу жить без кофе. | I can't live without coffee either.
dislike: А я больше люблю чай. Кофе мне слишком крепкий. | I prefer tea. Coffee's too strong for me.
callback: Кстати, сколько чашек кофе ты уже выпил{|а} сегодня? | By the way, how many cups of coffee have you had today?
> [A1] Ты пьёшь кофе или чай? | Do you drink coffee or tea?
= Я пью кофе каждое утро. | I drink coffee every morning.
= Я больше люблю чай. | I prefer tea. // «Больше люблю» — I prefer (literally 'love more').
? has=кофе: Я тоже! Без кофе я не человек. | Me too! Without coffee I'm not a person.
? has=чай: Чай — это уютно. Я люблю с лимоном. | Tea is cosy. I like it with lemon.
* пить = to drink
> [A2] Сколько чашек кофе ты пьёшь в день? | How many cups of coffee do you drink a day?
= Две чашки: утром и после обеда. | Two cups: in the morning and after lunch.
= Слишком много! Наверное, четыре. | Too many! Probably four.
? number: Ого! Сердце не болит? | Wow! Doesn't your heart hurt?
? else: Понятно, кофеман! | I see, a coffee addict!
* чашка = cup

@topic walk
stems: гуля, прогул, =парк, парке, пляж, =море, морю, природ, озер
react: Гулять — это прекрасно. | Walks are lovely.
react: Свежий воздух — это то, что нужно. | Fresh air is just what you need.
like: Я тоже люблю гулять, особенно вечером. | I love walking too, especially in the evening.
callback: Ты сегодня уже гулял{|а}? Погода хорошая? | Have you been for a walk today? Is the weather nice?
> [A1] Где ты любишь гулять? | Where do you like to walk?
= Я люблю гулять на пляже. | I like walking on the beach.
= В парке рядом с домом. | In the park near my house.
? has=пляж/мор: Пляж! Как я тебе завидую. | The beach! I'm so jealous.
? has=парк: Парк рядом с домом — это удобно. | A park near home — that's convenient.
? else: Звучит отлично! | Sounds great!
* рядом с = next to, near
> [A2] Ты гуляешь один{|а} или с кем-то? | Do you walk alone or with someone?
= Обычно с другом. | Usually with a friend.
= Один{|а}, мне так легче думать. | Alone, it's easier to think that way.
? has=один/одна: Понимаю. Иногда хорошо побыть одному. | I get it. Sometimes it's good to be alone.
? else: Вдвоём веселее! | It's more fun together!

@topic movies
stems: фильм, =кино, сериал, нетфликс, мультфильм, мультик, комеди, ужастик, фантастик, =смотрю, смотрел, смотрела
react: О, кино! Я тоже люблю. | Oh, films! I love them too.
like: Я тоже люблю смотреть фильмы по вечерам. | I love watching films in the evening too.
dislike: А я сериалы не очень люблю — слишком долго. Мне больше нравятся фильмы. | I don't really like series — too long. I prefer films.
callback: Кстати, ты досмотрел{|а} тот фильм? | By the way, did you finish that film?
> [A1] Какие фильмы ты любишь? | What films do you like?
= Я люблю комедии и боевики. | I like comedies and action films.
= Мне нравятся фантастические фильмы. | I like sci-fi films.
? has=комед: Комедии — это лучшее после трудного дня. | Comedies are the best after a hard day.
? has=фантаст: Я тоже фанат фантастики! | I'm a sci-fi fan too!
? has=ужас: Ужастики? Я бы не {{смог|смогла}} уснуть! | Horror? I wouldn't be able to sleep!
? else: Хороший вкус! | Good taste!
* боевик = action film
> [A2] Что ты смотрел{|а} в последний раз? | What did you watch last?
= Вчера я смотрел{|а} новый сериал. | Yesterday I watched a new series.
= Я давно ничего не смотрел{|а}. Нет времени. | I haven't watched anything for a long time. No time.
? has=сериал: Надо будет тоже посмотреть! | I'll have to watch it too!
? no, has=времени/давно: Понимаю. Надо найти время для себя! | I get it. You need to find time for yourself!
? else: Интересно! Надо посмотреть. | Interesting! I should watch it.
* в последний раз = last time
> [B1] Ты смотрел{|а} какие-нибудь русские фильмы? | Have you watched any Russian films?
= Да, «Брат». Это классика! | Yes, "Brother". It's a classic!
= Нет, а что посоветуешь? | No, what would you recommend? // «Что посоветуешь?» — great for keeping a conversation going.
? q: Посмотри «Иронию судьбы» — все русские смотрят её на Новый год! | Watch "The Irony of Fate" — all Russians watch it at New Year!
? yes: Ого, ты знаешь русское кино! | Wow, you know Russian cinema!
? else: Посмотри «Иронию судьбы» — это классика! | Watch "The Irony of Fate" — it's a classic!
* посоветовать = to recommend

@topic music
stems: музык, песн, гитар, концерт, =пою, =пел, =пела, слушаю, слушал, =рэп, =рок, джаз, плейлист, спотифай
react: Музыка — это жизнь! | Music is life!
like: Я тоже не могу без музыки. | I can't live without music either.
dislike: А я, честно, рэп не очень понимаю. Я больше по року. | Honestly, I don't really get rap. I'm more into rock.
callback: Кстати, что ты сейчас слушаешь? | By the way, what are you listening to now?
> [A1] Какую музыку ты слушаешь? | What music do you listen to?
= Я слушаю рок и поп. | I listen to rock and pop.
= Разную, но чаще всего рэп. | All sorts, but most often rap.
? has=рок: Рок! Тогда тебе точно понравится группа «Кино». | Rock! Then you'll definitely like the band Kino.
? has=рэп: Рэп — это энергия! | Rap is energy!
? else: Классно! | Cool!
* чаще всего = most often
> [A2] Ты играешь на каком-нибудь инструменте? | Do you play an instrument?
= Да, я немного играю на гитаре. | Yes, I play the guitar a little. // Instruments take «на»: играть на гитаре.
= Нет, но всегда хотел{|а} научиться. | No, but I've always wanted to learn.
? yes, has=гитар: Здорово! Когда-нибудь сыграешь мне что-нибудь. | Great! Someday you'll play me something.
? no: Никогда не поздно начать! | It's never too late to start!
* инструмент = instrument

@topic reading
stems: книг, читаю, читал, =читать, чтени, роман
react: Читать — это здорово. | Reading is great.
like: Я тоже люблю читать перед сном. | I love reading before bed too.
callback: Кстати, что ты сейчас читаешь? | By the way, what are you reading now?
> [A1] Ты любишь читать? | Do you like reading?
= Да, я читаю каждый вечер. | Yes, I read every evening.
= Не очень, я больше слушаю аудиокниги. | Not really, I listen to audiobooks more.
? yes, like: Здорово! Книги — лучшие друзья. | Great! Books are the best friends.
? else: Аудиокниги — тоже чтение! | Audiobooks count as reading too!
> [B1] Какую книгу ты бы посоветовал{|а} прочитать? | Which book would you recommend reading?
= «Мастер и Маргарита». Это шедевр! | "The Master and Margarita". It's a masterpiece!
= Я сейчас читаю книгу про бизнес — очень полезная. | I'm reading a business book now — very useful.
? has=мастер/булгаков/толст/достоевск/чехов: Ого, русская классика! Уважаю. | Wow, Russian classics! Respect.
? else: Спасибо, запишу! | Thanks, I'll note it down!
* посоветовать = to recommend

@topic games
stems: видеоигр, приставк, плейстейшн, иксбокс, компьютерн, =игры, =игру, =игр, фифа, доту, майнкрафт
react: О, игры! Я тоже иногда играю. | Oh, games! I play sometimes too.
like: Я тоже люблю видеоигры. | I love video games too.
callback: Ты всё ещё играешь в ту игру? | Are you still playing that game?
> [A1] В какие игры ты играешь? | What games do you play?
= Я играю в ФИФА с друзьями. | I play FIFA with friends.
= В шахматы, конечно! | Chess, of course!
? has=шахмат: Ха, это я {{заметил|заметила}}! | Ha, I noticed!
? else: Круто! Я в такие игры почти не играю. | Cool! I hardly play games like that.

@topic friends
stems: друз, =друг, =друга, =другом, =другу, подруг, тусов, вечеринк, компани
react: Друзья — это важно. | Friends matter.
react: Как здорово, что у тебя хорошие друзья. | How great that you have good friends.
like: Я тоже люблю проводить время с друзьями. | I love spending time with friends too.
callback: Как там твой друг, кстати? | How's your friend doing, by the way?
> [A1] Как зовут твоего лучшего друга? | What's your best friend's name?
= Моего лучшего друга зовут Тре. | My best friend's name is Tre. // «Зовут» works for other people too: «Его зовут…».
= Его зовут Майк. Мы дружим с детства. | His name is Mike. We've been friends since childhood.
? else: Красивое имя! Хорошо, когда есть такой друг. | Nice name! It's good to have a friend like that.
* лучший друг = best friend
> [A2] Что вы обычно делаете вместе? | What do you usually do together?
= Мы смотрим футбол и играем в игры. | We watch football and play games.
= Ходим в бар или просто гуляем. | We go to a bar or just walk around.
? else: Звучит весело! | Sounds fun!
* вместе = together
> [B1] Что для тебя самое важное в дружбе? | What's most important for you in friendship?
= Доверие. Друг должен быть честным. | Trust. A friend has to be honest. // «Доверие» — trust.
= Чтобы можно было позвонить в любое время. | That you can call at any time.
? else: {{Согласен|Согласна}}. Настоящих друзей мало. | I agree. There are few real friends.
* доверие = trust

@topic family
stems: =мама, =маму, =мамой, =маме, =мамы, =папа, =папу, =папой, родител, =брат, брата, братом, сестр, семь, =сын, сына, =дочь, дочк, детей, =дети, бабушк, дедушк, =жена, =жену, =женой, =муж, =мужем
react: Семья — это главное. | Family is the main thing.
react: Как приятно, что ты говоришь о семье. | How nice that you talk about your family.
like: Я тоже очень люблю свою семью. | I love my family very much too.
callback: Как там твоя семья, кстати? Все здоровы? | How's your family, by the way? Is everyone well?
> [A1] У тебя большая семья? | Do you have a big family?
= Нет, небольшая: мама, папа и брат. | No, small: mum, dad and a brother.
= Да, у меня два брата и сестра. | Yes, I have two brothers and a sister.
? yes, has=два/три/братья/сестры: Большая семья — это весело! | A big family is fun!
? no: Небольшая семья — это уютно. | A small family is cosy.
? else: Здорово! | Great!
* семья = family
> [A2] Ты часто видишься с семьёй? | Do you see your family often?
= Не очень, они живут далеко. | Not very often, they live far away.
= Да, каждые выходные. | Yes, every weekend.
? has=далеко: Понимаю. Наверное, ты скучаешь. | I understand. You probably miss them.
? yes: Как здорово! | How lovely!
* видеться = to see each other
> [A2] У тебя есть братья или сёстры? | Do you have brothers or sisters?
= Да, у меня есть младший брат. | Yes, I have a younger brother. // «Младший» = younger, «старший» = older.
= Нет, я единственный ребёнок. | No, I'm an only child.
? yes, has=брат/сестр: Здорово, когда есть брат или сестра. | It's great to have a brother or sister.
? no, has=единствен: О, тебя, наверное, баловали! | Oh, you were probably spoiled!
* младший = younger
* старший = older

@topic rest
stems: =спал, =спала, выспал, =сон, отдыха, отдохнул, =дома, лежал, ленил, сериальчик, =диван, =диване
react: Отдыхать тоже нужно. | You need to rest too.
like: Я тоже люблю иногда ничего не делать. | I like doing nothing sometimes too.
callback: Ты сегодня хоть немного отдохнул{|а}? | Did you get any rest today?
> [A1] Сколько ты обычно спишь? | How much do you usually sleep?
= Обычно семь часов. | Usually seven hours.
= Мало. Часов пять-шесть. | Not much. Five or six hours.
? has=мало/пять/шесть/четыре: Это мало! Тебе надо больше спать. | That's not much! You need to sleep more.
? number: Неплохо! | Not bad!
* спать = to sleep
> [A2] Как ты любишь отдыхать? | How do you like to relax?
= Я люблю лежать на диване и смотреть фильмы. | I like lying on the sofa watching films.
= Я отдыхаю, когда играю в шахматы. | I relax when I play chess.
? has=шахмат: Для тебя шахматы — это отдых? Интересно! | For you chess is relaxation? Interesting!
? else: Хороший способ! | A good way!
* отдыхать = to rest, relax

@topic travel
stems: путешеств, поездк, ездил, ездила, летал, летала, отпуск, самолет, заграниц, туризм, =страну, =страны, турци, итали, испани, франци, грузи
react: Путешествия — это лучшее! | Travelling is the best!
like: Я тоже обожаю путешествовать. | I love travelling too.
dislike: А я не люблю долгие перелёты. Я лучше на поезде! | I don't like long flights. I'd rather take the train!
callback: Кстати, куда ты хочешь поехать в следующий раз? | By the way, where do you want to go next time?
> [A1] Ты любишь путешествовать? | Do you like to travel?
= Да, очень люблю! | Yes, I love it!
= Люблю, но редко получается. | I do, but it rarely works out. // «Редко получается» — 'it rarely works out'.
? yes, like: Здорово! Путешествия меняют людей. | Great! Travel changes people.
? else: Понимаю. Работа, время… | I understand. Work, time…
* путешествовать = to travel
> [A2] В какой стране ты хочешь побывать? | Which country do you want to visit?
= Я хочу поехать в Россию. | I want to go to Russia. // «Поехать в Россию» — motion verb + accusative.
= Мне очень хочется в Японию. | I really want to go to Japan.
? has=росси: Ура! Я буду твоим гидом! | Hooray! I'll be your guide!
? else: Отличный выбор! | Great choice!
* побывать = to visit, to have been
> [B1] Расскажи про самую интересную поездку. | Tell me about your most interesting trip.
= Однажды я ездил{|а} в горы. Было холодно, но очень красиво. | Once I went to the mountains. It was cold, but very beautiful.
= Мы с друзьями ездили на машине через всю страну. | My friends and I drove across the whole country.
? else: Вау! Звучит как приключение. | Wow! Sounds like an adventure.
* однажды = once, one day

@topic shopping
stems: магазин, =купил, =купила, покупк, шопинг, мебел, торгов, скидк, =купить
react: О, покупки! | Oh, shopping!
like: Я тоже люблю ходить по магазинам. | I love going shopping too.
dislike: А я ненавижу магазины! Покупаю всё в интернете. | I hate shops! I buy everything online.
callback: Ну что, купил{|а} то, что хотел{|а}? | So, did you buy what you wanted?
> [A1] Что ты купил{|а}? | What did you buy?
= Я купил{|а} новую куртку. | I bought a new jacket.
= Ничего особенного, продукты. | Nothing special, groceries.
? else: Отлично! Обожаю новые вещи. | Great! I love new things.
* купить = to buy
> [A2] Ты любишь ходить по магазинам? | Do you like going shopping?
= Нет, я быстро устаю в магазинах. | No, I get tired quickly in shops.
= Да, особенно когда есть скидки. | Yes, especially when there are sales. // «Скидки» — discounts, sales.
? no, dislike: Я тоже! Лучше онлайн. | Me too! Better online.
? yes, like: Скидки — это святое! | Sales are sacred!
* скидка = discount

@topic love
stems: девушк, =парень, =парнем, свидани, любим, влюб, отношени, =жена, =жене
react: Ой, как романтично! | Oh, how romantic!
like: Любовь — это прекрасно. | Love is wonderful.
callback: Как там твоя вторая половинка? | How's your other half?
> [A2] Как вы познакомились? | How did you meet?
= Мы познакомились на работе. | We met at work.
= Через друзей. | Through friends.
? has=работ: Служебный роман! Как в кино. | An office romance! Like in a film.
? has=друз: Это самый лучший способ. | That's the best way.
? has=интернет/приложени/онлайн: Сейчас так многие знакомятся. | Lots of people meet that way now.
? else: Как мило! | How sweet!
* познакомиться = to meet (for the first time)
> [B1] Что вы любите делать вместе? | What do you love doing together?
= Мы любим готовить вместе и смотреть фильмы. | We love cooking together and watching films.
= Гулять и путешествовать. | Walking and travelling.
? else: Как здорово! | How lovely!

@topic car
stems: машин, =авто, автомобил, субару, тачк, =ездить, джип, кроссовер
react: О, машины! | Oh, cars!
like: Я тоже люблю машины. Мечтаю о хорошей машине. | I love cars too. I dream of a good car.
callback: Ну как, много машин продал{|а} на этой неделе? | So, did you sell many cars this week?
> [A1] Какая у тебя машина? | What car do you have?
= У меня «Субару». | I have a Subaru.
= У меня старая «Тойота», но она хорошая. | I have an old Toyota, but it's good.
? has=субару: «Субару» — надёжная машина! | Subaru is a reliable car!
? else: Хорошая машина! | Nice car!
> [A2] Ты любишь водить? | Do you like driving?
= Да, особенно ночью, когда нет пробок. | Yes, especially at night when there's no traffic. // «Пробки» — traffic jams, a word every Russian uses daily.
= Не очень, в городе много пробок. | Not really, there's a lot of traffic in the city.
? has=пробк: Ох, пробки — это ужас. В Москве тоже! | Oh, traffic is awful. In Moscow too!
? else: Понятно! | I see!
* пробка = traffic jam
* водить = to drive

@topic pets
stems: собак, кошк, =кот, =кота, котик, щен, питом, попуга, хомяк
react: Ой, обожаю животных! | Oh, I love animals!
like: Животные делают дом уютным. | Pets make a home cosy.
callback: Как там твой питомец? | How's your pet?
> [A1] У тебя есть собака или кошка? | Do you have a dog or a cat?
= Да, у меня есть собака. | Yes, I have a dog.
= Нет, но я хочу кошку. | No, but I want a cat.
? yes, has=собак: Собаки — лучшие друзья! | Dogs are the best friends!
? yes, has=кош/кот: Обожаю кошек! | I adore cats!
? no: Кошка — это хорошая идея! | A cat is a good idea!
* собака = dog
* кошка = cat

@topic weather
stems: погод, =жарко, =жара, жары, холодн, =холод, дожд, =снег, снега, солнц, =тепло
react: Погода — вечная тема! | Weather — the eternal topic!
like: Я люблю, когда тепло и солнечно. | I love it when it's warm and sunny.
callback: Как у вас там погода сегодня? | How's the weather there today?
> [A1] Какая у вас сегодня погода? | What's the weather like there today?
= Жарко и солнечно. | Hot and sunny.
= Идёт дождь. | It's raining. // «Идёт дождь» — literally 'rain is walking'.
? has=жарк/солнц/тепл: Везёт! А у нас холодно. | Lucky! It's cold here.
? has=дожд/холод/снег: Сиди дома и пей чай! | Stay home and drink tea!
* погода = weather
* дождь = rain
> [A2] Тебе больше нравится лето или зима? | Do you like summer or winter more?
= Лето! Я не люблю холод. | Summer! I don't like the cold.
= Зима, когда есть снег. | Winter, when there's snow.
? has=лет: Я тоже летний человек! | I'm a summer person too!
? has=зим: Настоящий русский! | A true Russian!
* лето = summer
* зима = winter
`;
