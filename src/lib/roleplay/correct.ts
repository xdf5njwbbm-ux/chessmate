// Gentle, rule-based corrections for a learner's Russian answer: the mistakes
// English speakers actually make (я + infinitive, «я имею», «мне N лет»,
// motion vs location, «играть в», gender in the past tense, ты/вы…), common
// misspellings, and naturalness ("и ты?" → "а ты?"). Each fix comes with a
// short explanation in plain English. Minor spelling is shown but never counted
// against the player.

import { low, sim } from "./understand.ts";

export type FixKind = "spelling" | "grammar" | "word" | "formality" | "gender";
export type Fix = { kind: FixKind; from: string; to: string; why: string; soft?: boolean };
export type Checked = { corrected: string; fixes: Fix[] };

type W = { raw: string; l: string; s: number; e: number };
type Edit = { s: number; e: number; to: string; fix: Fix };

// ---------------------------------------------------------------- word lists

const SPELL: Record<string, string> = {
  харашо: "хорошо", харошо: "хорошо", хорашо: "хорошо", хорошё: "хорошо", хорошоо: "хорошо",
  спосибо: "спасибо", спасиба: "спасибо", спосиба: "спасибо", спасбо: "спасибо",
  превет: "привет", привед: "привет", првиет: "привет", прывет: "привет",
  здраствуйте: "здравствуйте", здраствуй: "здравствуй", сдраствуйте: "здравствуйте", здраствуйти: "здравствуйте", здравствуйти: "здравствуйте",
  нармально: "нормально", нормальна: "нормально", нормалъно: "нормально",
  севодня: "сегодня", сиводня: "сегодня", сегодна: "сегодня", сеголня: "сегодня", сегодн: "сегодня",
  ищо: "ещё", исчо: "ещё", ещо: "ещё", ешё: "ещё",
  тожэ: "тоже", тожи: "тоже",
  извените: "извините", извинити: "извините", пожалуста: "пожалуйста", пожалуйсто: "пожалуйста", пажалуйста: "пожалуйста", пожалуйcта: "пожалуйста",
  интиресно: "интересно", интерестно: "интересно", интересна: "интересно",
  отлична: "отлично", атлично: "отлично", отличьно: "отлично",
  вобще: "вообще", вообщем: "в общем", вобщем: "в общем",
  какдела: "как дела", тоесть: "то есть", досвидания: "до свидания", неплоха: "неплохо", неплахо: "неплохо",
 симпатишная: "симпатичная", щастлив: "счастлив", щастлива: "счастлива",
  чуствую: "чувствую", сдесь: "здесь", тагда: "тогда", када: "когда", кагда: "когда",
  сечас: "сейчас", сейчяс: "сейчас", зафтра: "завтра", вчира: "вчера", очинь: "очень", ощень: "очень", оччень: "очень",
  работую: "работаю", роботаю: "работаю", работаеш: "работаешь", делаеш: "делаешь", хочеш: "хочешь", любиш: "любишь",
  можеш: "можешь", знаеш: "знаешь", живеш: "живёшь", будеш: "будешь", играеш: "играешь", думаеш: "думаешь", ходиш: "ходишь",
};
const COLLOQ: Record<string, [string, string]> = {
  щас: ["сейчас", "«Щас» is how it sounds in fast speech; written, it's «сейчас»."],
  чё: ["что", "«Чё» is very casual spoken Russian. «Что» works everywhere."],
  че: ["что", "«Чё» is very casual spoken Russian. «Что» works everywhere."],
  ваще: ["вообще", "«Ваще» is slangy spelling — written, it's «вообще»."],
  ниче: ["ничего", "«Ниче» is slangy spelling — written, it's «ничего»."],
};

const INF: Record<string, string> = {
  работать: "работаю", жить: "живу", любить: "люблю", играть: "играю", хотеть: "хочу", делать: "делаю", читать: "читаю",
  смотреть: "смотрю", ходить: "хожу", учиться: "учусь", говорить: "говорю", знать: "знаю", понимать: "понимаю", думать: "думаю",
  ехать: "еду", идти: "иду", пить: "пью", спать: "сплю", готовить: "готовлю", гулять: "гуляю", отдыхать: "отдыхаю",
  заниматься: "занимаюсь", тренироваться: "тренируюсь", слушать: "слушаю", писать: "пишу", мочь: "могу", быть: "буду",
  изучать: "изучаю", учить: "учу", чувствовать: "чувствую", ездить: "езжу", бегать: "бегаю", плавать: "плаваю", петь: "пою",
  танцевать: "танцую", рисовать: "рисую", звонить: "звоню", ждать: "жду", покупать: "покупаю", продавать: "продаю", помогать: "помогаю",
  нравиться: "нравлюсь", скучать: "скучаю", надеяться: "надеюсь", стараться: "стараюсь", начинать: "начинаю", вставать: "встаю",
};

const SHORT_ADJ: [string, string][] = [
  ["рад", "рада"], ["занят", "занята"], ["готов", "готова"], ["свободен", "свободна"], ["должен", "должна"], ["уверен", "уверена"],
  ["болен", "больна"], ["согласен", "согласна"], ["доволен", "довольна"], ["счастлив", "счастлива"], ["голоден", "голодна"],
  ["влюблён", "влюблена"], ["знаком", "знакома"], ["одинок", "одинока"], ["недоволен", "недовольна"], ["удивлён", "удивлена"],
  ["расстроен", "расстроена"], ["сыт", "сыта"], ["женат", "замужем"], ["здоров", "здорова"], ["спокоен", "спокойна"],
];
const SPECIAL_PAST: [string, string][] = [
  ["шёл", "шла"], ["пошёл", "пошла"], ["пришёл", "пришла"], ["ушёл", "ушла"], ["нашёл", "нашла"], ["зашёл", "зашла"], ["вышел", "вышла"],
  ["мог", "могла"], ["смог", "смогла"], ["помог", "помогла"], ["лёг", "легла"], ["привык", "привыкла"], ["замерз", "замерзла"],
];
const SELF_START = /^(работал|работала|отдыхал|отдыхала|гулял|гуляла|спал|спала|читал|читала|смотрел|смотрела|играл|играла|учился|училась|занимался|занималась|ходил|ходила|ездил|ездила|готовил|готовила|устал|устала|тренировался|тренировалась|сидел|сидела|проснулся|проснулась|встал|встала|рад|рада|занят|занята)$/;
const CLAUSE_STOP = /^(что|когда|если|который|которая|которое|которые|где|потому|чтобы|как|пока|он|она|оно|мы|вы|они|ты|мама|папа|друг|подруга|брат|сестра|жена|муж|девушка|парень|все|кто|день|погода|фильм|игра|работа|начальник|коллега|сын|дочь|бабушка|дедушка)$/;

const TY2VY: Record<string, string> = {
  ты: "вы", тебя: "вас", тебе: "вам", тобой: "вами", твой: "ваш", твоя: "ваша", твое: "ваше", твои: "ваши",
  твоего: "вашего", твоей: "вашей", твоим: "вашим", твоих: "ваших", твоему: "вашему", твою: "вашу",
};

/** place: [accusative after a motion verb, prepositional for location, preposition] */
const PLACES: Record<string, [string, string, "в" | "на"]> = {
  спортзал: ["спортзал", "спортзале", "в"], зал: ["зал", "зале", "в"], магазин: ["магазин", "магазине", "в"], парк: ["парк", "парке", "в"],
  офис: ["офис", "офисе", "в"], университет: ["университет", "университете", "в"], ресторан: ["ресторан", "ресторане", "в"],
  город: ["город", "городе", "в"], центр: ["центр", "центре", "в"], школа: ["школу", "школе", "в"], библиотека: ["библиотеку", "библиотеке", "в"],
  больница: ["больницу", "больнице", "в"], церковь: ["церковь", "церкви", "в"], бассейн: ["бассейн", "бассейне", "в"], клуб: ["клуб", "клубе", "в"],
  бар: ["бар", "баре", "в"], театр: ["театр", "театре", "в"], музей: ["музей", "музее", "в"], аэропорт: ["аэропорт", "аэропорту", "в"],
  работа: ["работу", "работе", "на"], пляж: ["пляж", "пляже", "на"], дача: ["дачу", "даче", "на"], вечеринка: ["вечеринку", "вечеринке", "на"],
  концерт: ["концерт", "концерте", "на"], рынок: ["рынок", "рынке", "на"], почта: ["почту", "почте", "на"], озеро: ["озеро", "озере", "на"],
};
const PLACE_FORMS = new Map<string, string>();
for (const [k, [acc, loc]] of Object.entries(PLACES)) {
  PLACE_FORMS.set(acc, k);
  PLACE_FORMS.set(loc, k);
  PLACE_FORMS.set(k, k);
}
const MOTION = /^(иду|идти|пошел|пошла|пойду|пойдем|пойдешь|ходил|ходила|хожу|ходить|ходим|ходишь|еду|ехать|поехал|поехала|поеду|поедем|ездил|ездила|езжу|ездим|приехал|приехала|пришел|пришла|зашел|зашла|бегу|побежал|побежала|летим|лечу|полетел|полетела|отправился|отправилась|вернулся|вернулась|переехал|переехала|сходить|съездить|опаздываю|спешу|едешь|идешь|собираюсь)$/;
const LOCATION = /^(был|была|были|буду|будем|работаю|работал|работала|работает|живу|жил|жила|живем|учусь|учился|училась|сижу|сидел|сидела|нахожусь|находился|отдыхал|отдыхала|отдыхаю|гулял|гуляла|гуляю|тренируюсь|тренировался|тренировалась|занимаюсь|занимался|занималась|обедал|обедала|ужинал|ужинала|остался|осталась|остаюсь|встретились|познакомились|провел|провела)$/;

const GAMES = new Set(["шахматы", "футбол", "баскетбол", "теннис", "волейбол", "хоккей", "карты", "игры", "видеоигры", "покер", "бильярд", "гольф", "бейсбол", "приставку", "плейстейшн", "шашки", "нарды", "боулинг"]);
const INSTR: Record<string, string> = { гитару: "гитаре", гитара: "гитаре", пианино: "пианино", фортепиано: "фортепиано", барабаны: "барабанах", скрипку: "скрипке", скрипка: "скрипке", укулеле: "укулеле", саксофон: "саксофоне", флейту: "флейте" };
const PLAY = /^(играю|играть|играл|играла|играем|играешь|играет|играют|поиграть|поиграем|сыграем|сыграть|сыграл|сыграла|играли)$/;

const JOBS: Record<string, string> = {
  продавец: "продавцом", менеджер: "менеджером", учитель: "учителем", программист: "программистом", врач: "врачом", инженер: "инженером",
  водитель: "водителем", официант: "официантом", дизайнер: "дизайнером", юрист: "юристом", бухгалтер: "бухгалтером", консультант: "консультантом",
  повар: "поваром", медсестра: "медсестрой", учительница: "учительницей", продавщица: "продавщицей", администратор: "администратором",
  механик: "механиком", строитель: "строителем", тренер: "тренером", кассир: "кассиром", охранник: "охранником", фотограф: "фотографом",
  журналист: "журналистом", переводчик: "переводчиком", архитектор: "архитектором", студент: "студентом", стажер: "стажёром", сантехник: "сантехником",
};
const WORKV = /^(работаю|работал|работала|работает|работаешь|работаем)$/;

/** place name: [from (genitive), in (prepositional)] */
const NAMES: Record<string, [string, string | null]> = {
  америка: ["Америки", "Америке"], россия: ["России", "России"], украина: ["Украины", null], флорида: ["Флориды", "Флориде"],
  канада: ["Канады", "Канаде"], англия: ["Англии", "Англии"], германия: ["Германии", "Германии"], франция: ["Франции", "Франции"],
  италия: ["Италии", "Италии"], испания: ["Испании", "Испании"], москва: ["Москвы", "Москве"], "нью-йорк": ["Нью-Йорка", "Нью-Йорке"],
  джексонвилл: ["Джексонвилла", "Джексонвилле"], техас: ["Техаса", "Техасе"], калифорния: ["Калифорнии", "Калифорнии"], лондон: ["Лондона", "Лондоне"],
  париж: ["Парижа", "Париже"], "санкт-петербург": ["Санкт-Петербурга", "Санкт-Петербурге"], питер: ["Питера", "Питере"], мексика: ["Мексики", "Мексике"],
  джорджия: ["Джорджии", "Джорджии"], огайо: ["Огайо", "Огайо"], польша: ["Польши", "Польше"], казахстан: ["Казахстана", "Казахстане"],
  бостон: ["Бостона", "Бостоне"], атланта: ["Атланты", "Атланте"], европа: ["Европы", "Европе"], азия: ["Азии", "Азии"], япония: ["Японии", "Японии"], китай: ["Китая", "Китае"],
};
const LIVEV = /^(живу|жил|жила|живем|живешь|работаю|работал|работала|учусь|учился|училась|родился|родилась|вырос|выросла|был|была|были|нахожусь|отдыхал|отдыхала)$/;

const ADV2ADJ: Record<string, string> = { хорошо: "хороший", плохо: "плохой", отлично: "отличный", интересно: "интересный", скучно: "скучный", классно: "классный", нормально: "нормальный", ужасно: "ужасный", прекрасно: "прекрасный", замечательно: "замечательный", длинно: "длинный", трудно: "трудный", тяжело: "тяжёлый" };
const MASC_THINGS = /^(день|вечер|фильм|уикенд|ужин|обед|завтрак|отпуск|матч|урок|концерт|сериал|разговор)$/;

const LANG: Record<string, string> = { русский: "по-русски", английский: "по-английски", украинский: "по-украински", испанский: "по-испански", немецкий: "по-немецки", французский: "по-французски", китайский: "по-китайски", итальянский: "по-итальянски" };
const SPEAK = /^(говорю|говоришь|говорит|говорим|говорите|говорят|говорил|говорила|разговариваю)$/;

// ---------------------------------------------------------------- helpers

const yearWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? "год" : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? "года" : "лет");

function m2f(w: string): string | null {
  for (const [m, f] of SHORT_ADJ) if (w === low(m)) return f;
  for (const [m, f] of SPECIAL_PAST) if (w === low(m)) return f;
  if (/[аеиоуыя]лся$/.test(w)) return w.slice(0, -3) + "лась";
  if (/[аеиоуыя]л$/.test(w) && w.length >= 2) return w + "а";
  return null;
}
function f2m(w: string): string | null {
  for (const [m, f] of SHORT_ADJ) if (w === f) return m;
  for (const [m, f] of SPECIAL_PAST) if (w === f) return m;
  if (/[аеиоуыя]лась$/.test(w)) return w.slice(0, -4) + "лся";
  if (/[аеиоуыя]ла$/.test(w) && w.length >= 3) return w.slice(0, -1);
  return null;
}
const isPastM = (w: string) => /[аеиоуыя]л(ся)?$/.test(w) || SHORT_ADJ.some(([m]) => low(m) === w) || SPECIAL_PAST.some(([m]) => low(m) === w);
const isPastF = (w: string) => /[аеиоуыя]ла(сь)?$/.test(w) || SHORT_ADJ.some(([, f]) => f === w) || SPECIAL_PAST.some(([, f]) => f === w);
const NOT_VERB = new Set(["сериал", "финал", "материал", "журнал", "канал", "вокзал", "идеал", "капитал", "сигнал", "скандал", "карнавал", "персонал", "оригинал", "интервал", "генерал", "адмирал", "бокал", "подвал", "квартал", "ритуал", "укол", "посол", "глагол", "протокол", "стул", "отдел", "раздел", "предел", "пробел", "крокодил", "тыл", "металл", "стол", "пол", "мол", "гол", "зал", "бал", "футбол", "баскетбол", "волейбол", "сила", "мила", "школа", "игла", "вилла", "дела", "смела", "весела", "мала", "цела", "бела", "тепла", "светла", "кола", "пчела", "скала", "стрела", "мгла", "тела", "земля", "сел", "села"]);
const PREP = /^(в|во|на|из|с|со|к|ко|от|до|у|о|об|про|за|под|над|для|без|по|через|после|перед)$/;

function keepCase(orig: string, to: string) {
  return /^[A-ZА-ЯЁ]/.test(orig) ? to[0].toUpperCase() + to.slice(1) : to;
}

// ---------------------------------------------------------------- the checker

export function check(text: string, o: { forms: "m" | "f"; vy: boolean; lex?: Set<string> }): Checked {
  const ws: W[] = [];
  for (const m of text.matchAll(/[\p{L}\p{N}-]+/gu)) {
    const raw = m[0].replace(/^-+|-+$/g, "");
    if (!raw) continue;
    const s = m.index! + m[0].indexOf(raw);
    ws.push({ raw, l: low(raw), s, e: s + raw.length });
  }
  const edits: Edit[] = [];
  const add = (i: number, j: number, to: string, fix: Omit<Fix, "from" | "to">) => {
    const s = ws[i].s;
    const e = ws[j].e;
    if (edits.some((x) => !(e <= x.s || s >= x.e))) return;
    const from = text.slice(s, e);
    const out = keepCase(ws[i].raw, to);
    if (low(from) === low(out)) return;
    edits.push({ s, e, to: out, fix: { ...fix, from, to: out } });
  };
  const L = (i: number) => ws[i]?.l ?? "";
  /** Sentence punctuation between word k-1 and word k. */
  const brk = (k: number) => k > 0 && !!ws[k] && /[.!?;:—]/.test(text.slice(ws[k - 1].e, ws[k].s));

  for (let i = 0; i < ws.length; i++) {
    const w = L(i);

    // --- phrases first (they span several words)

    // «я есть студент» → «я студент»
    if (w === "я" && L(i + 1) === "есть" && ws[i + 2] && !/^(хочу|буду|будешь|не|ли|у)$/.test(L(i + 2)))
      add(i, i + 1, "я", { kind: "grammar", why: "Russian drops «am/is/are» in the present: «Я студент» — no «есть» needed." });

    // «я нравится» → «мне нравится»
    if (w === "я" && /^(нравится|нравятся)$/.test(L(i + 1)))
      add(i, i + 1, `мне ${ws[i + 1].raw.toLowerCase()}`, { kind: "grammar", why: "«Нравится» works backwards: the thing you like is the subject, and you're «мне» — «Мне нравится…» (literally 'to me it is pleasing')." });

    // «я имею собаку» → «у меня есть собака»
    if (w === "я" && L(i + 1) === "имею") {
      const obj = ws[i + 2];
      let tail = "";
      if (obj) tail = " " + (/у$/.test(obj.l) && obj.l.length > 3 ? obj.raw.slice(0, -1) + "а" : /ю$/.test(obj.l) && obj.l.length > 3 ? obj.raw.slice(0, -1) + "я" : obj.raw);
      add(i, obj ? i + 2 : i + 1, `у меня есть${tail}`, { kind: "grammar", why: "To say you have something, Russians say «У меня есть…» (literally 'by me there is'). «Я имею» sounds like a legal document." });
    }

    // age: «я 25 лет», «у меня 25 лет» → «мне 25 лет»; and год/года/лет
    if ((w === "я" || (w === "у" && L(i + 1) === "меня")) && ws[i + 1]) {
      const k = w === "я" ? i + 1 : L(i + 2) === "есть" ? i + 3 : i + 2;
      const n = Number(L(k));
      if (Number.isInteger(n) && n > 0 && /^(лет|год|года)$/.test(L(k + 1)))
        add(i, k + 1, `мне ${n} ${yearWord(n)}`, { kind: "grammar", why: "Age uses «мне» (to me): «Мне 25 лет» — literally 'to me are 25 years'." });
    }
    if (/^\d+$/.test(w) && /^(лет|год|года)$/.test(L(i + 1))) {
      const n = Number(w);
      if (L(i + 1) !== yearWord(n)) add(i + 1, i + 1, yearWord(n), { kind: "grammar", why: `After ${n}: «${yearWord(n)}». (1, 21, 31… → год; 2–4 → года; 5–20 and the rest → лет.)` });
    }

    // «я работать» → «я работаю»
    if (w === "я") {
      const k = L(i + 1) === "не" ? i + 2 : i + 1;
      const v = L(k);
      if (v in INF)
        add(k, k, INF[v], { kind: "grammar", why: `After «я» the verb needs its «I» form: «я ${INF[v]}». The «-ть» form is the dictionary form, used after words like «хочу» or «люблю».` });
    }

    // «люблю тебе» → «люблю тебя»
    if (/^(люблю|обожаю|жду|вижу|знаю|понимаю|слышу)$/.test(w) && /^(тебе|ты)$/.test(L(i + 1)))
      add(i + 1, i + 1, "тебя", { kind: "grammar", why: `«${w}» takes «тебя»: «${w} тебя».` });

    // «скучаю тебя» → «скучаю по тебе»
    if (/^(скучаю|скучал|скучала|скучаем)$/.test(w) && L(i + 1) !== "по") {
      const MAP: Record<string, string> = { тебя: "по тебе", тебе: "по тебе", ты: "по тебе", вас: "по вам", вам: "по вам", его: "по нему", ему: "по нему", ее: "по ней", ей: "по ней", маму: "по маме", семью: "по семье", дом: "по дому", россию: "по России" };
      if (MAP[L(i + 1)]) add(i + 1, i + 1, MAP[L(i + 1)], { kind: "grammar", why: "«Скучать» needs «по»: «Я скучаю по тебе» (literally 'I'm bored along you')." });
    }

    // «играю шахматы» → «играю в шахматы»; «играю гитару» → «играю на гитаре»
    if (PLAY.test(w) && ws[i + 1]) {
      const n1 = L(i + 1);
      if (GAMES.has(n1)) add(i + 1, i + 1, `в ${ws[i + 1].raw}`, { kind: "grammar", why: "Games and sports take «в»: «играть в шахматы», «играть в футбол»." });
      else if (n1 in INSTR) add(i + 1, i + 1, `на ${INSTR[n1]}`, { kind: "grammar", why: "Instruments take «на» + prepositional: «играть на гитаре»." });
      else if (n1 === "в" && L(i + 2) in INSTR) add(i + 1, i + 2, `на ${INSTR[L(i + 2)]}`, { kind: "grammar", why: "Instruments take «на», not «в»: «играть на гитаре». («В» is for games: «в шахматы».)" });
    }

    // «работаю как продавец» / «работаю продавец» → «работаю продавцом»
    if (WORKV.test(w)) {
      const k = L(i + 1) === "как" ? i + 2 : i + 1;
      if (JOBS[L(k)]) add(i + 1, k, JOBS[L(k)], { kind: "grammar", why: `Jobs after «работать» take the instrumental case, with no «как»: «работаю ${JOBS[L(k)]}».` });
    }

    // «говорю русский» → «говорю по-русски»
    if (SPEAK.test(w) && L(i + 1) in LANG)
      add(i + 1, i + 1, LANG[L(i + 1)], { kind: "grammar", why: `"Speak a language" is «говорить ${LANG[L(i + 1)]}» (or «на русском»), not the plain adjective.` });

    // motion vs location: «иду в спортзале» → «в спортзал»; «был в спортзал» → «в спортзале»; дома/домой
    if (MOTION.test(w) || LOCATION.test(w)) {
      const motion = MOTION.test(w);
      for (let k = i + 1; k <= Math.min(i + 3, ws.length - 1); k++) {
        const p = L(k);
        if (brk(k) || MOTION.test(p) || LOCATION.test(p) || /ть(ся)?$/.test(p)) break;
        if (p === "дома" && motion) { add(k, k, "домой", { kind: "grammar", why: "Going home is «домой» (to where?). «Дома» means 'at home' (where?)." }); break; }
        if (p === "домой" && !motion) { add(k, k, "дома", { kind: "grammar", why: "Being at home is «дома» (where?). «Домой» means 'home' as a direction (to where?)." }); break; }
        if ((p === "в" || p === "на") && ws[k + 1]) {
          const base = PLACE_FORMS.get(L(k + 1));
          if (!base) break;
          const [acc, loc, prep] = PLACES[base];
          const want = motion ? acc : loc;
          if (L(k + 1) !== want || p !== prep) {
            const why = motion
              ? `With a verb of going (where to?), use the accusative: «${prep} ${acc}».${p !== prep ? ` And it's «${prep}», not «${p}», for this place.` : ""}`
              : `Being somewhere (where?) takes the prepositional: «${prep} ${loc}».${p !== prep ? ` And it's «${prep}», not «${p}», for this place.` : ""}`;
            add(k, k + 1, `${prep} ${want}`, { kind: "grammar", why });
          }
          break;
        }
      }
    }

    // «из Америка» → «из Америки»; «живу в Флорида» → «во Флориде»
    if ((w === "из" || w === "в" || w === "во") && ws[i + 1] && NAMES[L(i + 1)]) {
      const [gen, prep] = NAMES[L(i + 1)];
      if (w === "из" && L(i + 1) !== low(gen)) add(i + 1, i + 1, gen, { kind: "grammar", why: `«Из» (from) takes the genitive: «из ${gen}».` });
      if (w !== "из" && prep && L(i + 1) !== low(prep) && (LIVEV.test(L(i - 1)) || LIVEV.test(L(i - 2)))) {
        const v = /^[вф]/i.test(prep) ? "во" : "в";
        add(i, i + 1, `${v} ${prep}`, { kind: "grammar", why: `Being in a place takes the prepositional: «${v} ${prep}».` });
      }
    }

    // «день был хорошо» → «день был хороший»
    if (MASC_THINGS.test(w) && L(i + 1) === "был" && ADV2ADJ[L(i + 2)])
      add(i + 2, i + 2, ADV2ADJ[L(i + 2)], { kind: "grammar", why: `Describing a thing needs an adjective: «${w} был ${ADV2ADJ[L(i + 2)]}» — or say «${w === "день" ? "день прошёл" : w + " прошёл"} ${L(i + 2)}».` });

    // «я чувствую хорошо» → «я чувствую себя хорошо»
    if (/^(чувствую|чувствовал|чувствовала|чувствуешь)$/.test(w) && /^(хорошо|плохо|отлично|нормально|лучше|хуже|прекрасно|ужасно|странно|уставшим|уставшей|усталым|счастливым|счастливой)$/.test(L(i + 1)))
      add(i, i, `${ws[i].raw} себя`, { kind: "grammar", why: "To say how you feel, add «себя»: «Я чувствую себя хорошо» (literally 'I feel myself well')." });

    // «мой имя» → «моё имя»
    if (/^(мой|моя|мои)$/.test(w) && L(i + 1) === "имя")
      add(i, i, "моё", { kind: "grammar", why: "«Имя» is neuter: «моё имя». (Even more natural: «Меня зовут…».)" });

    // «как твой дела» → «как твои дела»
    if (/^(твой|твоя|твое|ваш|ваша|ваше)$/.test(w) && L(i + 1) === "дела")
      add(i, i, w.startsWith("тво") ? "твои" : "ваши", { kind: "grammar", why: "«Дела» is plural: «как твои дела?» / «как ваши дела?»." });

    // «добрый утро» → «доброе утро»
    if (/^(добрый|доброе|добрая|доброй)$/.test(w) && /^(утро|день|вечер|ночь|ночи)$/.test(L(i + 1))) {
      const want: Record<string, string> = { утро: "доброе", день: "добрый", вечер: "добрый", ночь: "спокойной", ночи: "доброй" };
      const n2 = L(i + 1);
      const fixed = n2 === "ночь" ? "спокойной ночи" : `${want[n2]} ${ws[i + 1].raw}`;
      if (n2 === "ночь" || w !== want[n2]) add(i, i + 1, fixed, { kind: "grammar", why: n2 === "ночь" ? "Good night is «Спокойной ночи» (or «Доброй ночи»)." : `«${ws[i + 1].raw}» is ${n2 === "утро" ? "neuter" : "masculine"}, so it's «${want[n2]} ${n2}».` });
    }

    // «очень спасибо» → «большое спасибо»
    if (/^(очень|много)$/.test(w) && L(i + 1) === "спасибо")
      add(i, i + 1, "большое спасибо", { kind: "word", why: "'Thanks a lot' is «большое спасибо» (a big thank-you). «Очень спасибо» is a word-for-word translation." });

    // «сколько ты лет» → «сколько тебе лет»
    if (w === "сколько" && L(i + 1) === "ты" && L(i + 2) === "лет")
      add(i + 1, i + 1, "тебе", { kind: "grammar", why: "Age uses the dative: «Сколько тебе лет?»." });

    // «как твоё имя» / «как называется тебя» → «как тебя зовут»
    if (w === "как" && ((/^(твое|ваше)$/.test(L(i + 1)) && L(i + 2) === "имя") || (L(i + 1) === "называется" && /^(тебя|вас)$/.test(L(i + 2)))))
      add(i, i + 2, `как ${/ваше|вас/.test(L(i + 1) + L(i + 2)) ? "вас" : "тебя"} зовут`, { kind: "word", why: "Russians ask «Как тебя зовут?» (literally 'how do they call you?'). «Как твоё имя?» sounds translated." });

    // «и ты?» at the end → «а ты?»
    if (w === "и" && i >= ws.length - 3 && ((/^(ты|вы)$/.test(L(i + 1)) && i + 1 === ws.length - 1) || (L(i + 1) === "у" && /^(тебя|вас)$/.test(L(i + 2)) && i + 2 === ws.length - 1)))
      add(i, i, "а", { kind: "word", why: "To ask back, Russians say «А ты?» / «А у тебя?». «И ты» sounds like 'you too'." });
  }

  // --- gender agreement for «я» (past tense, short adjectives)
  const other = o.forms === "m" ? isPastF : isPastM;
  const conv = o.forms === "m" ? f2m : m2f;
  const genderFix = (k: number) => {
    const w = L(k);
    if (NOT_VERB.has(w) || !other(w)) return;
    const to = conv(w);
    if (!to) return;
    const why = o.forms === "m"
      ? `As a man, say «${to}». «${w}» is the feminine form.`
      : `As a woman, say «${to}». «${w}» is the masculine form.`;
    add(k, k, to, { kind: "gender", why: w === "женат" || w === "замужем" ? (o.forms === "f" ? "A woman is «замужем» (married); «женат» is for men." : "A man is «женат» (married); «замужем» is for women.") : why });
  };
  for (let i = 0; i < ws.length; i++) {
    if (L(i) !== "я") continue;
    // after a present-tense or infinitive verb, what follows is its object — until «и», «потом»…
    let object = false;
    for (let k = i + 1; k <= Math.min(i + 6, ws.length - 1); k++) {
      if (brk(k) || CLAUSE_STOP.test(L(k)) || /^[А-ЯЁ]/.test(ws[k].raw)) break;
      if (/^(и|потом|затем|но|а)$/.test(L(k))) {
        object = false;
        continue;
      }
      if (!object && !PREP.test(L(k - 1))) genderFix(k);
      if (/[^аеиоуыэ][ую]$|ть(ся)?$|юсь$/.test(L(k)) && L(k).length > 2) object = true;
    }
  }
  if (ws[0] && SELF_START.test(L(0)) && !ws.some((x) => x.l === "я")) genderFix(0);

  // --- ты/вы with the person you're talking to
  if (o.vy) {
    const why = "You're on «вы» with this person (polite/formal), so use вы-forms: «вы», «вас», «ваш» — and verbs in «-ете/-ите» (посоветуете, хотите).";
    for (let i = 0; i < ws.length; i++) {
      const w = L(i);
      if (TY2VY[w]) add(i, i, TY2VY[w], { kind: "formality", why });
      // ты-form verbs → вы-form: посоветуешь → посоветуете, говоришь → говорите
      else if (w.length > 4 && /(ешь|ишь|ешься|ишься)$/.test(w) && !/^(вешь|мышь|тишь|глушь|чушь)$/.test(w)) {
        const vy = w === "хочешь" ? "хотите" : w.replace(/ешься$/, "етесь").replace(/ишься$/, "итесь").replace(/ешь$/, "ете").replace(/ишь$/, "ите");
        add(i, i, vy.replace(/^(.*)е(те|тесь)$/, (x) => x), { kind: "formality", why });
      }
    }
    if (L(0) === "привет") add(0, 0, "здравствуйте", { kind: "formality", why: "«Привет» is for friends. With someone you call «вы», say «Здравствуйте» or «Добрый день»." });
  } else {
    const ix = ws.findIndex((x, i) => (x.l === "вы" || x.l === "вас") && (L(i - 1) === "а" || L(i - 2) === "а" || L(i - 1) === "как"));
    if (ix >= 0) add(ix, ix, ws[ix].l === "вы" ? "ты" : "тебя", { kind: "formality", soft: true, why: "You're on «ты» with this person — «А у тебя?» / «А ты?» sounds warmer than «вы»." });
  }

  // --- spelling (never counted against you)
  for (let i = 0; i < ws.length; i++) {
    const w = L(i);
    if (SPELL[w] && SPELL[w] !== w) {
      add(i, i, SPELL[w], { kind: "spelling", soft: true, why: /[еи]ш$/.test(w) ? "«ты»-forms of verbs end in «-шь» (with a soft sign)." : "Small spelling slip — still understood." });
      continue;
    }
    if (COLLOQ[w]) {
      add(i, i, COLLOQ[w][0], { kind: "spelling", soft: true, why: COLLOQ[w][1] });
      continue;
    }
    if (/[жш]ы|[чщ]я|[чщ]ю/.test(w) && !/брошюр|парашют|жюри/.test(w)) {
      const to = w.replace(/([жш])ы/g, "$1и").replace(/([чщ])я/g, "$1а").replace(/([чщ])ю/g, "$1у");
      add(i, i, to, { kind: "spelling", soft: true, why: "Spelling rule: after ж/ш write «и» (жи, ши), after ч/щ write «а» and «у» (ча, ща, чу, щу)." });
      continue;
    }
    if (o.lex && w.length >= 4 && /^[а-я-]+$/.test(w) && !o.lex.has(w)) {
      // a known word that's one slip away — but not just another ending of a known word
      const stem = w.slice(0, Math.max(3, w.length - 2));
      let inflection = false;
      for (const x of o.lex) if (x.startsWith(stem) && x.length >= stem.length) { inflection = true; break; }
      if (inflection) continue;
      let best = "";
      let bs = 0;
      for (const x of o.lex) {
        if (Math.abs(x.length - w.length) > 1) continue;
        if (x[0] !== w[0] && !(/[ао]/.test(x[0]) && /[ао]/.test(w[0])) && !(/[еия]/.test(x[0]) && /[еия]/.test(w[0]))) continue;
        const s = sim(x, w);
        if (s > bs) [bs, best] = [s, x];
      }
      if (best && bs >= 0.8) add(i, i, best, { kind: "spelling", soft: true, why: "Small spelling slip — still understood." });
    }
  }

  edits.sort((a, b) => b.s - a.s);
  let corrected = text;
  for (const x of edits) corrected = corrected.slice(0, x.s) + x.to + corrected.slice(x.e);
  edits.sort((a, b) => a.s - b.s);
  return { corrected, fixes: edits.map((x) => x.fix) };
}

/** Fixes that count as mistakes (spelling and tone notes don't). */
export const realFixes = (fixes: Fix[]) => fixes.filter((f) => !f.soft);
