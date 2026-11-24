// Role-play scenarios: chess talk, feelings, asking how someone is, B1–B2 situations,
// and one where you're the salesperson.

export const SCENARIOS_B = String.raw`
@char sergey m vy
name: Сергей | Sergey
about: A customer at your car dealership — friendly but careful with money. You call him вы.
hay: Спасибо, хорошо. Вот, машину ищу. | Thanks, fine. Looking for a car, you see.
day: С утра езжу по салонам. Устал уже! | I've been driving round dealerships since morning. Tired already!
new: Да вот, жена сказала — пора менять машину. | Well, my wife said it's time to change the car.
feel: Нормально, спасибо. | Fine, thank you.
from: Я местный. | I'm local.
live: Тут недалеко, минут двадцать. | Not far, about twenty minutes.
job: Я инженер на заводе. | I'm an engineer at a factory.
work_how: Работа как работа. | Work is work.
myname: Меня зовут Сергей. | My name's Sergey.
age: Сорок лет. | Forty.
hobby: Рыбалка! В выходные всегда на озере. | Fishing! At weekends I'm always at the lake.
sport: Раньше играл в хоккей. | I used to play hockey.
weekend: С детьми поеду на дачу. | I'll go to the dacha with the kids.
chess: С сыном иногда играю. Он меня обыгрывает! | Sometimes I play with my son. He beats me!
family: Жена и двое детей — сын и дочка. | My wife and two kids — a son and a daughter.
food: Жена отлично готовит пельмени. | My wife makes excellent pelmeni.
film: Боевики люблю. | I like action films.
music: Радио в машине — вот и вся музыка. | The radio in the car — that's all my music.
pets: Собака есть, овчарка. | We have a dog, a German shepherd.
travel: Летом ездим на море на машине. Поэтому нужна большая! | In summer we drive to the sea. That's why we need a big one!
love: Я женат, у меня жена. | I'm married, I have a wife.
generic: Хороший вопрос. Не знаю! | Good question. I don't know!

@scenario chess A2 ty dima
title: Поговорим о шахматах | Talking about chess
about: Between moves, Дима chats about chess — how you started, your favourite piece, your heroes.
goal: Chess words in Russian: партия, ход, фигура, ферзь, конь, ничья, реванш
end: Ладно, хватит болтать — давай играть. Удачи! | OK, enough chatting — let's play. Good luck!
> Ну что, как тебе эта партия? | So, how do you like this game?
~ Ну чё, как партия? | So, how's the game going?
= Интересная! Но ты играешь сильно. | Interesting! But you play strongly.
= Пока всё хорошо. Посмотрим! | All good so far. We'll see!
? good, has=интересн: Мне тоже нравится. Напряжённо! | I like it too. Tense!
? has=сильно/играешь: Спасибо! Ты тоже. | Thanks! You too.
? else: Посмотрим, посмотрим! | We'll see, we'll see!
* партия = a game (of chess)
> Как давно ты играешь в шахматы? | How long have you been playing chess?
= С детства. | Since childhood. // «С детства» — since childhood.
= Уже пять лет, но серьёзно — только год. | Five years already, but seriously only one.
? has=детств: Видно опыт! | The experience shows!
? number: Для пяти лет — очень хорошо! | For five years — very good!
? else: Понятно! | I see!
* с детства = since childhood
> Какая фигура тебе нравится больше всего? | Which piece do you like most?
= Конь. Он ходит необычно. | The knight. It moves in an unusual way.
= Ферзь, конечно. Он самый сильный. | The queen, of course. It's the strongest. // «Ферзь» is masculine in Russian!
= Слон — я люблю длинные диагонали. | The bishop — I love long diagonals.
? has=кон: Конь — хитрая фигура. Мне тоже нравится! | The knight is a sly piece. I like it too!
? has=ферз: Ферзь — это сила! | The queen is power!
? has=слон: Слоны — для любителей атаки. | Bishops are for attack lovers.
? has=пешк: Пешка?! Оригинально! | A pawn?! Original!
? else: Интересный выбор! | Interesting choice!
* фигура = piece
* конь = knight
* ферзь = queen
* слон = bishop
> Ты играешь в турнирах? | Do you play in tournaments?
= Нет, только онлайн и с друзьями. | No, just online and with friends.
= Иногда, в местном клубе. | Sometimes, at a local club.
? yes, has=клуб/иногда: Круто! Какой у тебя рейтинг? | Cool! What's your rating?
? else: Онлайн — тоже отличная практика. | Online is great practice too.
* турнир = tournament
> Кто твой любимый шахматист? | Who's your favourite chess player?
= Магнус Карлсен. | Magnus Carlsen.
= Каспаров — легенда! | Kasparov — a legend!
? has=каспаров/карпов/таль/ботвинник/крамник/алехин: Русская школа! Уважаю. | The Russian school! Respect.
? has=карлсен/магнус: Карлсен — гений, конечно. | Carlsen is a genius, of course.
? else: Хороший выбор! | Good choice!
* шахматист = chess player
> Что ты делаешь, когда проигрываешь? | What do you do when you lose?
= Анализирую партию и учусь. | I analyse the game and learn.
= Злюсь, а потом играю ещё! | I get angry, and then I play again!
? has=злюсь/злой/зл: Ха, честно! Я тоже. | Ha, honest! Me too.
? has=анализ/учусь: Правильно, так растут. | Right, that's how you improve.
? else: Главное — не сдаваться! | The main thing is not to give up!
* проигрывать = to lose
* выигрывать = to win
> Скажи честно: я хорошо играю? | Tell me honestly: do I play well?
= Неплохо, но я сильнее! | Not bad, but I'm stronger!
= Очень хорошо! Ты меня удивил. | Very well! You surprised me.
? has=сильнее/лучше: Ну, это мы ещё посмотрим! | Well, we'll see about that!
? good: Спасибо, приятно! | Thanks, that's nice!
? else: Ха, дипломатично! | Ha, diplomatic!
* честно = honestly

@scenario howfeel A2 ty ira
title: Как ты себя чувствуешь? | Asking someone how they're feeling
about: Your friend Ира is ill. This time YOU ask the questions — show you care and offer help.
goal: «Что случилось?», «Как ты себя чувствуешь?», offering help, «Выздоравливай!»
end: Спасибо, что ты есть! Пока! | Thank you for being you! Bye!
> [ask] Привет… Я сегодня что-то совсем расклеилась. | Hi… I've completely fallen apart today.
- Привет… Мне сегодня плохо. (Ask her: «Что случилось?») | Hi… I feel bad today. (Ask what happened.)
= Ой, что случилось? | Oh, what happened? // «Что случилось?» — the first thing to ask.
= Привет! Что с тобой? | Hi! What's wrong with you?
? q: Я заболела. Голова болит, всё болит. | I've got ill. My head hurts, everything hurts.
? else: …Ты даже не спросишь, что со мной? | …Aren't you even going to ask what's wrong?
* расклеиться = to fall apart (feel unwell)
* Что случилось? = What happened?
! Ask «Что случилось?» or «Что с тобой?» — then «Как ты себя чувствуешь?»
> [ask] Да вот, температура тридцать восемь. | Well, a temperature of thirty-eight.
= Ты была у врача? | Have you been to the doctor?
= Ты пьёшь лекарства? | Are you taking medicine? // Russians «пьют» (drink) medicine — even tablets.
= Бедная! Как ты себя чувствуешь? | Poor thing! How are you feeling?
? has=врач: Да, вчера была. Сказал — простуда. | Yes, I went yesterday. He said it's a cold.
? has=лекарств/таблет: Да, пью, но пока не помогает. | Yes, I am, but it's not helping yet.
? has=чувству: Слабость, но уже лучше, чем вчера. | Weak, but better than yesterday.
? q: Ничего, жить буду! | It's nothing, I'll live!
? else: Да… Неприятно. | Yeah… Unpleasant.
* температура = temperature
* лекарство = medicine
> [ask] Мне так скучно дома одной… | I'm so bored at home alone…
= Хочешь, я приду к тебе? | Do you want me to come over?
= Тебе что-нибудь нужно? Я могу купить. | Do you need anything? I can buy it. // Offering help: «Тебе что-нибудь нужно?»
? has=приду/приеду/прийти/приехать/зайду: Правда? Ты {лучший|лучшая}! | Really? You're the best!
? has=нужно/купить/куплю/принести/принесу: Ой, спасибо! Ты {настоящий друг|настоящая подруга}. | Oh, thank you! You're a real friend.
? q: Спасибо, что спрашиваешь. | Thanks for asking.
? else: Да уж… | Yeah…
* скучно = bored, boring
> Да, если можно, купи мне апельсины и чай. | Yes, if you can, buy me oranges and tea.
= Конечно! Что-нибудь ещё? | Of course! Anything else?
= Без проблем, скоро буду. | No problem, I'll be there soon.
? q: Нет, больше ничего. Только ты! | No, nothing else. Just you!
? else: Спасибо огромное! | Thank you so much!
* без проблем = no problem
> [ask] Ты не представляешь, как я рада. Спасибо тебе! | You can't imagine how glad I am. Thank you!
= Не за что! Выздоравливай скорее! | You're welcome! Get well soon! // «Выздоравливай!» — 'Get well!'
= Ну что ты! Для этого и нужны друзья. | Oh, come on! That's what friends are for.
? has=выздоравл/поправл/здоров: Спасибо! С тобой мне уже лучше. | Thanks! I already feel better with you here.
? else: Ты правда {лучший друг|лучшая подруга}. | You really are the best friend.
* Выздоравливай! = Get well!
* Не за что = You're welcome
> Слушай, мне уже лучше, правда. | Listen, I'm feeling better already, really.
= Я рад{|а}! Береги себя. | I'm glad! Take care of yourself.
= Отлично! Отдыхай и пей больше воды. | Great! Rest and drink more water.
? else: Обязательно! | I will!
* Береги себя = take care of yourself

@scenario movies B1 ty dima
title: Кино и сериалы | Movies and TV
about: Дима loves to argue about films. Tell him what you watch — and say if you disagree.
goal: Describing a plot, giving opinions, agreeing and disagreeing
end: Отлично, посмотрю на выходных! Спасибо! | Great, I'll watch it at the weekend! Thanks!
> Ты смотрел{|а} что-нибудь интересное в последнее время? | Have you watched anything interesting lately?
= Да, я посмотрел{|а} новый фильм про космос. | Yes, I watched a new film about space.
= Я смотрю сериал «Во все тяжкие» второй раз. | I'm watching Breaking Bad for the second time.
? has=космос: Космос — моя тема! | Space is my thing!
? has=сериал/тяжкие: Классика! Я тоже смотрел. | A classic! I watched it too.
? else: Интересно! | Interesting!
* в последнее время = lately
> О чём этот фильм? | What's that film about?
= Это фильм про космос и время. | It's a film about space and time.
= Это комедия про двух друзей, которые едут в Россию. | It's a comedy about two friends who go to Russia.
? has=комед: Звучит смешно! | Sounds funny!
? else: Звучит интересно. | Sounds interesting.
* О чём…? = What's … about?
> Тебе понравился конец? | Did you like the ending?
= Да, конец был неожиданный. | Yes, the ending was unexpected.
= Нет, я ожидал{|а} большего. | No, I expected more. // «Ожидал большего» — 'expected more'; a polite way to say you were disappointed.
? yes, good, like: Люблю неожиданные концовки! | I love unexpected endings!
? no, bad: Да, такое бывает. Обидно. | Yeah, that happens. Annoying.
? else: Ясно. | Got it.
* неожиданный = unexpected
> Какой твой любимый фильм всех времён? | What's your favourite film of all time?
= «Крёстный отец». | "The Godfather".
= Сложно выбрать, но, наверное, «Интерстеллар». | Hard to choose, but probably Interstellar.
? has=интерстеллар: Серьёзно? Мой тоже! | Seriously? Mine too!
? else: Хороший вкус! | Good taste!
* всех времён = of all time
> Ты любишь смотреть фильмы дома или в кино? | Do you like watching films at home or at the cinema?
= Дома, с попкорном и под одеялом. | At home, with popcorn and under a blanket.
= В кино, там атмосфера. | At the cinema, there's atmosphere.
? has=дома/дом: А я, наоборот, люблю кино — большой экран! | I'm the opposite, I love the cinema — the big screen!
? has=кино/кинотеатр: Согласен, в кино совсем другие ощущения. | Agreed, the cinema feels completely different.
? else: Понятно. | I see.
* наоборот = the opposite
> По-моему, сериалы сейчас лучше, чем фильмы. Ты согласен{|на}? | In my opinion, series are better than films now. Do you agree?
= Согласен{|на}, сериалы стали очень качественными. | I agree, series have become really high quality.
= Не совсем. Хороший фильм — это искусство. | Not quite. A good film is art. // «Не совсем» — 'not quite'; a soft way to disagree.
? disagree: Хм, может, ты и прав{|а}. Но я останусь при своём мнении! | Hmm, maybe you're right. But I'll stick to my opinion!
? agree, yes: Вот! Я знал, что ты поймёшь. | See! I knew you'd understand.
? else: Интересная мысль. | Interesting thought.
* по-моему = in my opinion
* согласен = (I) agree
> Что посоветуешь посмотреть на выходных? | What would you recommend watching at the weekend?
= Посмотри «Брат» — это русская классика. | Watch "Brother" — it's a Russian classic.
= Советую новый сериал про шахматы — «Ход королевы». | I recommend the series about chess — The Queen's Gambit.
? has=королев: Ха, конечно! Для шахматиста — обязательно. | Ha, of course! A must for a chess player.
? else: Запишу, спасибо! | I'll note it down, thanks!
* советовать = to advise, recommend

@scenario travel B1 ty nastya
title: Путешествия | Discussing travel
about: Настя is planning her next trip and wants your stories and advice.
goal: Past trips, preferences, «Если бы…» (if I could…)
end: Надеюсь, когда-нибудь поедем вместе! | I hope one day we'll go together!
> Ты много путешествовал{|а}? | Have you travelled a lot?
= Не очень много, но я был{|а} в Мексике и в Канаде. | Not a lot, but I've been to Mexico and Canada.
= Да, я люблю путешествовать. Был{|а} в десяти странах. | Yes, I love travelling. I've been to ten countries.
? has=мексик/канад: Ого! Как там? | Wow! How was it?
? number: Десять стран — это много! | Ten countries — that's a lot!
? else: Понятно! | I see!
* путешествовать = to travel
> Какое место тебе понравилось больше всего и почему? | Which place did you like most, and why?
= Мне понравилась Мексика, потому что там очень вкусная еда. | I liked Mexico, because the food there is very tasty. // «Потому что» — because; it carries your reason.
= Горы в Колорадо. Там очень красиво и спокойно. | The mountains in Colorado. It's very beautiful and calm there.
? has=ед/вкусн: Еда — лучшая причина путешествовать! | Food is the best reason to travel!
? has=гор: Обожаю горы! | I love mountains!
? else: Звучит прекрасно. | Sounds wonderful.
* потому что = because
> Ты любишь путешествовать один{|а} или с компанией? | Do you like travelling alone or with company?
= С друзьями, так веселее. | With friends, it's more fun.
= Один{|а}. Так я чувствую себя свободнее. | Alone. That way I feel freer.
? has=один/одна: Смело! Я бы побоялась. | Brave! I'd be scared.
? else: Согласна, вместе веселее. | Agreed, it's more fun together.
* веселее = more fun
> Что ты обычно берёшь с собой в поездку? | What do you usually take with you on a trip?
= Только рюкзак — я путешествую налегке. | Just a backpack — I travel light.
= Слишком много одежды! | Too many clothes!
? has=налегке/рюкзак: Респект! Я так не умею. | Respect! I can't do that.
? has=одежд/много: Ха, я тоже. Всегда беру лишнее. | Ha, me too. I always take too much.
? else: Понятно. | I see.
* налегке = travelling light
> Если бы ты мог{|ла} поехать куда угодно завтра, куда бы ты поехал{|а}? | If you could go anywhere tomorrow, where would you go?
= Я бы поехал{|а} в Японию. | I'd go to Japan. // «Бы» + past tense = 'would'.
= Я бы поехал{|а} в Москву, чтобы практиковать русский! | I'd go to Moscow, to practise my Russian!
? has=москв/росси/питер: Ура! Я буду твоим гидом! | Hooray! I'll be your guide!
? else: Отличный выбор! | Great choice!
* куда угодно = anywhere
! «Если бы я мог…, я бы…» — 'If I could…, I would…'. The verb after «бы» is always past tense.
> А в России ты хотел{|а} бы побывать? Где? | And would you like to visit Russia? Where?
= Да, в Москве и на Байкале. | Yes, in Moscow and on Lake Baikal.
= Очень! Хочу увидеть Петербург. | Very much! I want to see Petersburg.
? has=питер/петербург: Это мой город! Покажу тебе всё. | That's my city! I'll show you everything.
? has=байкал: Байкал — это мечта. | Baikal is a dream.
? else: Здорово! | Great!
* побывать = to visit

@scenario feelings B1 ty nastya
title: Чувства и отношения | Feelings and relationships
about: A quiet, honest conversation with Настя about how you really are and who you rely on.
goal: Describing feelings, «мне кажется», «я переживаю», supporting someone
end: Обнимаю! Береги себя. | Hugs! Take care of yourself.
> Как ты себя чувствуешь в последнее время? Только честно. | How have you been feeling lately? Honestly.
= Честно говоря, немного устал{|а} от всего. | Honestly, a bit tired of everything. // «Честно говоря» — 'to be honest'.
= Хорошо! Я чувствую себя спокойнее, чем раньше. | Good! I feel calmer than before.
? bad, tired: Понимаю. Спасибо, что говоришь честно. | I understand. Thank you for being honest.
? good: Как я рада это слышать! | I'm so glad to hear that!
? else: Понятно. | I see.
* в последнее время = lately
* честно говоря = to be honest
> Что тебя радует сейчас больше всего? | What makes you happiest right now?
= Мои друзья и шахматы. | My friends and chess.
= Что я учу русский и вижу прогресс. | That I'm learning Russian and seeing progress.
? has=русск: А мне радостно, что ты учишь мой язык! | And it makes me happy that you're learning my language!
? else: Как хорошо, когда есть такие вещи. | How good it is to have things like that.
* радовать = to make happy
> А что тебя беспокоит? | And what's bothering you?
= Я переживаю из-за работы. | I'm worried about work. // «Переживать из-за…» — to worry about.
= Ничего особенного, всё нормально. | Nothing special, everything's fine.
? has=работ: Работа — это не вся жизнь. Помни об этом. | Work isn't your whole life. Remember that.
? has=ничего/нормально: Хорошо. Но если что — я рядом. | Good. But if anything happens — I'm here.
? else: Понимаю. Это нормально — переживать. | I understand. It's normal to worry.
* беспокоить = to bother, worry
* переживать = to worry
> С кем ты можешь поговорить, когда тебе грустно? | Who can you talk to when you're sad?
= С лучшим другом или с мамой. | With my best friend or my mum.
= С девушкой. Она всегда меня поддерживает. | With my girlfriend. She always supports me.
? has=девушк/жен/подруг: Как здорово, что у тебя есть такой человек. | How great that you have someone like that.
? else: Хорошо, что такие люди есть. | It's good that you have people like that.
* поддерживать = to support
> Тебе легко говорить о своих чувствах? | Is it easy for you to talk about your feelings?
= Не очень. Мне легче показать, чем сказать. | Not really. It's easier for me to show than to say.
= Да, я думаю, это важно. | Yes, I think it's important.
? no: Это нормально. Главное — что ты чувствуешь. | That's normal. What matters is what you feel.
? yes: Это редкость. Уважаю. | That's rare. Respect.
? else: Понимаю. | I understand.
* чувства = feelings
> Мне кажется, мужчины реже говорят о чувствах. Ты согласен{|на}? | It seems to me that men talk about feelings less often. Do you agree?
= Да, наверное. Нас так воспитали. | Yes, probably. That's how we were raised.
= Не совсем. Мне кажется, это зависит от человека. | Not quite. I think it depends on the person. // «Это зависит от…» — 'it depends on…'.
? disagree: Хм, ты прав{|а}. Наверное, я обобщаю. | Hmm, you're right. I'm probably generalising.
? agree, yes: Вот видишь. Но это можно изменить! | You see. But that can change!
? else: Интересная мысль. | Interesting thought.
* мне кажется = it seems to me
* зависеть от = to depend on
> Спасибо, что поделился{|ась}. Мне это правда важно. | Thank you for sharing. It really matters to me.
= Тебе спасибо, что выслушала. | Thank you for listening.
= Мне тоже было важно поговорить. | It was important for me to talk too.
? else: Всегда пожалуйста. | Any time.
* поделиться = to share

@scenario goals B1 ty nastya
title: Цели и мечты | Talking about future goals
about: Настя asks where you see yourself in a few years — and what's stopping you.
goal: Future plans, «хочу», «надеюсь», «если бы…»
end: У тебя всё получится. Я в тебя верю! | You'll make it. I believe in you!
> Кем ты видишь себя через пять лет? | Where do you see yourself in five years?
= Я хочу открыть свой бизнес. | I want to open my own business.
= Надеюсь, я буду свободно говорить по-русски! | I hope I'll speak Russian fluently! // «Надеюсь» — 'I hope'.
? has=бизнес: Смело! А какой бизнес? | Bold! What kind of business?
? has=русск: Ура! Обязательно будешь. | Hooray! You definitely will.
? else: Отличная цель! | Great goal!
* через пять лет = in five years
> Что тебе нужно, чтобы этого достичь? | What do you need to achieve that?
= Много работать и учиться. | To work hard and study.
= Время и немного удачи. | Time and a bit of luck.
? has=удач: Удача любит тех, кто работает! | Luck loves those who work!
? else: Правильно. | That's right.
* достичь = to achieve
> Чего ты хочешь добиться в этом году? | What do you want to achieve this year?
= Хочу поднять рейтинг в шахматах. | I want to raise my chess rating.
= Хочу сдать экзамен по русскому. | I want to pass a Russian exam.
? has=рейтинг/шахмат: Тогда играй со мной почаще! | Then play with me more often!
? has=экзамен: Я помогу тебе готовиться! | I'll help you prepare!
? else: Отличный план. | Great plan.
* добиться = to achieve
> А что тебе мешает? | And what's getting in your way?
= Иногда лень. | Sometimes laziness.
= Не хватает времени. | There isn't enough time. // «Не хватает» + genitive — 'there isn't enough…'.
? has=лен: Ха, честно! Лень — главный враг. | Ha, honest! Laziness is the main enemy.
? has=времен/время: Время всегда можно найти. Хотя бы десять минут в день. | You can always find time. Even ten minutes a day.
? else: Понимаю. | I understand.
* мешать = to get in the way
* не хватает = there isn't enough
> Как ты думаешь, деньги — это главное? | Do you think money is the most important thing?
= Нет, но без них трудно. | No, but it's hard without it.
= Не главное. Главное — здоровье и семья. | Not the most important. Health and family come first.
? no, disagree: Согласна. Но и без денег — грустно! | Agreed. But without money it's sad!
? yes, agree: Хм, а я думаю, что счастье важнее. | Hmm, but I think happiness is more important.
? else: Интересно. | Interesting.
* главное = the main thing
> [B2] Если бы ты знал{|а}, что не можешь проиграть, что бы ты сделал{|а}? | If you knew you couldn't lose, what would you do?
= Я бы открыл{|а} свою компанию. | I'd start my own company.
= Я бы переехал{|а} в другую страну. | I'd move to another country.
? else: Вот это мечта! Тогда начинай уже сейчас. | Now that's a dream! Then start now.
! «Если бы я знал…, я бы…» — the Russian conditional uses «бы» + past tense in both halves.

@scenario jokes B2 ty dima
title: Шутки и подколы | Jokes and teasing
about: Дима teases you about your moves. Tease him back — with a smile.
goal: Playful Russian: «Спорим?», «Мечтай!», «Ну ты даёшь!», jokes and comebacks
end: Ладно, шутки в сторону — играем! | OK, jokes aside — let's play!
> Слушай, ты сегодня играешь как гроссмейстер. Кто тебя подменил? | Listen, you're playing like a grandmaster today. Who swapped you?
~ Ты чё, гроссмейстер? Кто тебя подменил? | What are you, a grandmaster? Who swapped you?
= Ха! Я всегда так играю, просто ты не замечал. | Ha! I always play like this, you just didn't notice.
= Я тренировал{ся|ась} всю ночь! | I trained all night!
? has=тренир: Ага, конечно. С Карлсеном, наверное? | Yeah, right. With Carlsen, probably?
? else: Ну-ну! Посмотрим, что дальше. | Well, well! We'll see what's next.
* подменить = to swap (someone)
> Твой последний ход был… смелый. Ты специально отдал{|а} пешку? | Your last move was… brave. Did you give away the pawn on purpose?
= Конечно! Это гамбит, ты просто не понимаешь. | Of course! It's a gambit, you just don't understand. // Confident humour — very Russian.
= Ой, не напоминай… | Oh, don't remind me…
? has=гамбит/специально/конечно: Гамбит, говоришь? Ну-ну. | A gambit, you say? Well, well.
? has=напомин: Ха-ха, ладно, молчу! | Ha-ha, fine, I'll keep quiet!
? else: Ха! | Ha!
* специально = on purpose
> Знаешь анекдот? Почему шахматист не ходит на свидания? Боится получить мат! | Know the joke? Why doesn't a chess player go on dates? He's afraid of getting mated!
= Ха-ха, смешно! Но мне не страшно. | Ha-ha, funny! But I'm not scared.
= Ужасная шутка. Но я смеюсь! | Terrible joke. But I'm laughing! // Mock criticism + laughing — a perfect comeback.
? has=ужасн/плох: Зато честно! | But it's honest!
? else: Я знал, что тебе понравится. | I knew you'd like it.
* анекдот = joke (a short funny story)
> Ты сегодня {такой серьёзный|такая серьёзная}. Улыбнись! | You're so serious today. Smile!
= Я не серьёзн{ый|ая}, я сосредоточенн{ый|ая}! | I'm not serious, I'm focused!
= Улыбнусь, когда выиграю. | I'll smile when I win.
? has=выигра: Тогда ты будешь {серьёзным|серьёзной} очень долго! | Then you'll be serious for a very long time!
? else: Ну-ну, {сосредоточенный|сосредоточенная}. | Sure, focused.
* сосредоточенный = focused
> Спорим, ты проиграешь за двадцать ходов? | Bet you'll lose in twenty moves?
= Спорим! На что? | Let's bet! On what?
= Мечтай-мечтай! | Keep dreaming! // «Мечтай» — 'dream on'.
? q, has=спорим: На пиццу! | For a pizza!
? has=мечта: Ха! Ну посмотрим. | Ha! Well, we'll see.
? else: Посмотрим! | We'll see!
* Спорим? = Wanna bet?
> Ладно, если выиграешь — я покупаю пиццу. | OK, if you win — I'm buying pizza.
= Договорились! Готовь деньги. | Deal! Get your money ready.
= Тогда закажи большую! | Then order a big one!
? else: Ха, не торопись! | Ha, don't rush!
* договорились = deal, agreed
> Ты вообще когда-нибудь проигрываешь? | Do you ever lose at all?
= Только когда играю с тобой из вежливости. | Only when I play with you out of politeness.
= Бывает, но редко! | It happens, but rarely!
? has=вежлив: Ой, всё! Ну ты даёшь! | Oh, come on! You're something else!
? else: Скромно! | Modest!
* Ну ты даёшь! = You're something else!

@scenario disagree B2 vy olga
title: Вежливо не соглашаться | Disagreeing politely
about: Ольга Петровна, a senior colleague, proposes weekend work. Disagree — politely — and find a solution.
goal: Softeners: «Боюсь, что…», «Я понимаю, но…», «По-моему…», «Давайте…»
end: Спасибо за конструктивный разговор. | Thank you for the constructive conversation.
> Я думаю, нам нужно работать по субботам, чтобы закончить проект. Как вы считаете? | I think we need to work Saturdays to finish the project. What do you think?
= Я понимаю, но, по-моему, это не лучшая идея. | I understand, but in my opinion that's not the best idea. // «Я понимаю, но…» acknowledges her first — key to polite disagreement.
= Боюсь, я не совсем соглас{ен|на}. Люди устанут. | I'm afraid I don't quite agree. People will get tired.
? disagree, has=понима/боюсь: Хорошо, я вас слушаю. | All right, I'm listening.
? agree, yes: Отлично, значит, решено. Хотя… вы уверены? | Great, so it's decided. Although… are you sure?
? else: Понятно. Объясните подробнее. | I see. Explain in more detail.
* по-моему = in my opinion
* боюсь, что… = I'm afraid that…
! Soften disagreement: «Я понимаю, но…», «Боюсь, что…», «Мне кажется…». A flat «Нет» sounds rude.
> Почему вы так думаете? | Why do you think so?
= Потому что, когда люди устают, они делают больше ошибок. | Because when people get tired, they make more mistakes.
= Мне кажется, лучше распределить задачи по-другому. | I think it's better to divide the tasks differently.
? has=ошиб: Справедливо. | Fair.
? has=распредел/задач: Интересно. Как именно? | Interesting. How exactly?
? else: Понимаю. | I understand.
* распределить = to distribute
> Хорошо. А что вы предлагаете? | All right. And what do you propose?
= Я предлагаю нанять ещё одного человека. | I propose hiring one more person.
= Давайте перенесём срок на неделю. | Let's move the deadline by a week. // «Давайте…» — 'let's…'; polite and constructive.
? has=срок/перенес: Но клиент ждёт. Мы не можем перенести срок. | But the client is waiting. We can't move the deadline.
? has=нанять/человек: Это дорого, но я подумаю. | That's expensive, but I'll think about it.
? else: Хм. Интересно. | Hmm. Interesting.
* предлагать = to propose
* срок = deadline
> Но клиент очень ждёт. Что будем делать? | But the client is waiting. What shall we do?
= Я понимаю. Тогда, может быть, хотя бы одна суббота? | I understand. Then maybe at least one Saturday?
= Давайте спросим клиента. Возможно, он согласится. | Let's ask the client. Perhaps he'll agree.
? has=спрос/клиент: Хорошая мысль. Я позвоню ему. | Good thought. I'll call him.
? has=хотя/суббот: Компромисс. Мне нравится. | A compromise. I like it.
? else: Подумаем. | We'll think about it.
* хотя бы = at least
* компромисс = compromise
> Знаете, вы меня убедили. Но кто будет отвечать за результат? | You know, you've convinced me. But who'll be responsible for the result?
= Я готов{|а} взять ответственность. | I'm ready to take responsibility.
= Предлагаю делить ответственность в команде. | I suggest sharing responsibility within the team.
? has=готов/возьму: Ценю это. | I appreciate that.
? else: Разумно. | Sensible.
* ответственность = responsibility
* убедить = to convince
> Хорошо. Давайте обсудим это с командой завтра. | All right. Let's discuss it with the team tomorrow.
= Отлично, спасибо, что выслушали. | Great, thank you for hearing me out.
= Договорились. Я подготовлю план. | Agreed. I'll prepare a plan.
? else: Отлично. | Excellent.
* выслушать = to hear out

@scenario date B1 ty katya
title: Первое свидание | Getting to know someone romantically
about: Your first date with Катя at a cosy café. Be curious, be yourself.
goal: Talking about yourself, values, dreams; showing interest
end: Тогда до пятницы! | Until Friday, then!
> Я так рада, что мы наконец встретились! Как прошёл твой день? | I'm so glad we finally met up! How was your day?
= Хорошо, но я весь день ждал{|а} нашей встречи. | Good, but I was waiting all day for our date. // A warm, simple compliment.
= Нормально, немного устал{|а}. Но сейчас уже отлично! | Fine, a bit tired. But now it's great!
? has=ждал: Ой, как мило! Я тоже. | Oh, how sweet! Me too.
? else: Я рада! | I'm glad!
* встреча = meeting, date
> Тебе нравится это кафе? Я его очень люблю. | Do you like this café? I love it.
= Да, здесь очень уютно. | Yes, it's very cosy here. // «Уютно» — cosy; hard to translate, Russians love it.
= Очень! У тебя хороший вкус. | Very much! You have good taste.
? has=вкус: Спасибо! | Thank you!
? else: Я знала, что тебе понравится. | I knew you'd like it.
* уютно = cosy
> Расскажи о себе. Какой ты человек? | Tell me about yourself. What kind of person are you?
= Я {спокойный|спокойная}, но люблю приключения. | I'm calm, but I love adventures.
= Мне кажется, я {весёлый|весёлая} и немного {упрямый|упрямая}. | I think I'm cheerful and a little stubborn.
? has=упрям: {Упрямый|Упрямая}? Это я заметила в шахматах! | Stubborn? I noticed that in chess!
? has=приключ: Люблю людей, которые любят приключения. | I like people who love adventures.
? else: Интересно! | Interesting!
* упрямый = stubborn
* приключение = adventure
> Что для тебя важно в отношениях? | What's important to you in a relationship?
= Для меня важны честность и доверие. | Honesty and trust matter to me.
= Чтобы с человеком было интересно и легко. | That it's interesting and easy to be with the person.
? has=честн/довер: Полностью согласна. | I completely agree.
? else: Красиво сказано. | Beautifully said.
* отношения = relationship
* доверие = trust
> А ты романтик? | Are you a romantic?
= Немного. Я люблю делать сюрпризы. | A little. I like making surprises.
= Да, я люблю цветы и прогулки под луной. | Yes, I love flowers and walks under the moon.
? has=сюрприз: Ой, я обожаю сюрпризы! | Oh, I love surprises!
? no: Ничего, романтику можно выучить! | That's OK, romance can be learned!
? else: Как мило! | How sweet!
* сюрприз = surprise
> О чём ты мечтаешь? | What do you dream of?
= Я мечтаю путешествовать по миру. | I dream of travelling the world.
= Хочу свой бизнес и большую семью. | I want my own business and a big family.
? else: Хорошая мечта. | A lovely dream.
* мечтать = to dream
> [ask] А тебе не интересно, о чём мечтаю я? | And aren't you curious what I dream of?
= Конечно, интересно! О чём ты мечтаешь? | Of course I'm curious! What do you dream of?
= Очень интересно. Расскажи! | Very. Tell me!
? q, yes: Я мечтаю жить у моря и открыть свою языковую школу. | I dream of living by the sea and opening my own language school.
? else: Я мечтаю жить у моря. | I dream of living by the sea.
> Мне было очень хорошо с тобой. Увидимся ещё? | I had a really lovely time with you. Shall we see each other again?
= Конечно! Я буду очень рад{|а}. | Of course! I'll be very glad.
= Обязательно. Может, в пятницу? | Definitely. Maybe on Friday?
? has=пятниц/суббот/завтра: Давай! | Let's!
? else: Я тоже очень хочу. | I really want to as well.
* увидеться = to see each other

@scenario sell B1 vy sergey
title: Вы продавец | You're the salesperson
about: Сергей walks into your dealership. You lead: greet him, ask what he needs, and close the deal.
goal: Asking customers questions politely, prices, test drives, handling «дорого»
end: Спасибо, вы мне очень помогли! До свидания! | Thank you, you've helped me a lot! Goodbye!
> [ask] Здравствуйте! Я хочу посмотреть машины. | Hello! I'd like to look at some cars.
= Здравствуйте! Конечно. Что вас интересует? | Hello! Of course. What are you interested in? // «Что вас интересует?» — the standard sales opener.
= Добрый день! Какую машину вы ищете? | Good afternoon! What kind of car are you looking for?
? q: Мне нужна семейная машина, надёжная. | I need a family car, a reliable one.
? else: Мне нужна семейная машина. | I need a family car.
* Что вас интересует? = What are you interested in?
> У нас двое детей и собака. Что вы посоветуете? | We have two kids and a dog. What would you recommend?
= Посмотрите на этот кроссовер. Он очень просторный. | Have a look at this crossover. It's very spacious.
= Для семьи я советую «Аутбэк». В нём много места. | For a family I recommend the Outback. There's lots of room in it.
? has=простор/места/больш: Да, места много. Это важно. | Yes, there's lots of room. That's important.
? q: Вот это мне и нужно узнать от вас! | That's exactly what I need to find out from you!
? else: Хм, интересно. | Hmm, interesting.
* просторный = spacious
* советовать = to recommend
> А сколько она стоит? | And how much does it cost?
= Тридцать две тысячи долларов. | Thirty-two thousand dollars.
= Сейчас она стоит тридцать две тысячи, и есть хорошая скидка. | Right now it's thirty-two thousand, and there's a good discount.
? number: Хм, это дороговато. | Hmm, that's a bit pricey.
? else: Понятно. | I see.
> Это дороговато. Можно дешевле? | That's a bit pricey. Can it be cheaper?
= Я могу предложить скидку пять процентов. | I can offer a five per cent discount.
= Давайте посмотрим, что можно сделать. | Let's see what can be done. // Buys time without saying no.
? has=скидк/процент: Уже лучше! | That's better!
? else: Хорошо, посмотрим. | All right, let's see.
* предложить = to offer
* дешевле = cheaper
> А можно сделать тест-драйв? | Can I take a test drive?
= Конечно! Можно ваши права? | Of course! May I have your driving licence?
= Да, давайте прямо сейчас. | Yes, let's do it right now.
? has=прав: Вот, пожалуйста. | Here you are.
? else: Отлично! | Great!
* права = driving licence
> Машина мне понравилась. Но мне нужно посоветоваться с женой. | I liked the car. But I need to talk it over with my wife.
= Конечно, я понимаю. Вот моя визитка. | Of course, I understand. Here's my card.
= Может, приедете вместе в субботу? | Maybe you'll come together on Saturday? // Proposing the next step is how you close.
? has=суббот/вместе: Хорошая идея. Приедем в субботу утром. | Good idea. We'll come on Saturday morning.
? else: Спасибо, я вам позвоню. | Thanks, I'll call you.
* посоветоваться = to consult, talk over
* визитка = business card
`;
