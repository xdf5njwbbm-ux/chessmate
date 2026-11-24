// All role-play content, parsed once.
import { parseBank, form } from "./parse.ts";
import { PEOPLE } from "./content/people.ts";
import { TOPICS } from "./content/topics.ts";
import { SCENARIOS_A } from "./content/scenariosA.ts";
import { SCENARIOS_B } from "./content/scenariosB.ts";
import { QUICK } from "./content/quick.ts";
import { low, tokens } from "./understand.ts";
import type { Bank } from "./types.ts";

export const BANK: Bank = parseBank(PEOPLE, SCENARIOS_B, TOPICS, SCENARIOS_A, QUICK);

/** Everyday words that may not appear in the content. */
const EXTRA = `
я ты он она оно мы вы они меня тебя его её ее нас вас их мне тебе ему ей нам вам им мной тобой ним ней нами вами ними себя себе
мой моя моё мое мои твой твоя твоё твое твои наш наша наше наши ваш ваша ваше ваши свой своя своё свое свои
да нет не ни и а но или что как где когда почему зачем кто сколько какой какая какое какие чей куда откуда тоже также ещё еще уже очень
это этот эта эти тот та те то здесь там тут сейчас потом теперь всегда никогда иногда часто редко сегодня вчера завтра утром днём днем вечером ночью
хорошо плохо нормально отлично неплохо так себе ничего спасибо пожалуйста привет пока здравствуйте здравствуй извини извините прости простите
быть был была было были буду будешь будет будем будете будут есть нет могу можешь может можем можете могут хочу хочешь хочет хотим хотите хотят
знаю знаешь знает знаем знаете знают думаю думаешь думает люблю любишь любит любим любите любят иду идёшь идешь идёт идет идём идем идёте идете идут
делаю делаешь делает делаем делаете делают работаю работаешь работает работаем работаете работают живу живёшь живешь живёт живет живём живем живут
говорю говоришь говорит говорим говорите говорят понимаю понимаешь понимает играю играешь играет играем играете играют смотрю смотришь смотрит
читаю читаешь читает слушаю слушаешь слушает учу учишь учит учусь учишься учится сплю спишь спит ем ешь ест едим пью пьёшь пьешь пьёт пьет
хожу ходишь ходит ходим еду едешь едет едем вижу видишь видит видим видел видела видели слышу слышишь слышит
человек люди друг друзья подруга мама папа брат сестра семья дом дома домой работа работе работу день дни неделя месяц год года лет время раз
шахматы шахмат партия ход ходы игра игру игры доска фигура фигуры пешка конь слон ладья ферзь король шах мат ничья белые чёрные черные
машина машины машину город страна америка россия москва флорида русский русская русские английский язык слово слова
большой маленький хороший плохой новый старый молодой красивый интересный трудный лёгкий легкий важный главный последний первый
один два три четыре пять шесть семь восемь девять десять двадцать тридцать сто тысяча много мало немного несколько все всё каждый
можно нужно надо нельзя конечно наверное может быть правда точно вообще просто только даже уже ну вот ладно давай давайте
`;

/** Every word form in the content (both genders) plus everyday words — for spelling and translit. */
export const LEX: Set<string> = (() => {
  const set = new Set<string>();
  const addText = (s: string) => {
    for (const g of ["m", "f"] as const) for (const sp of ["m", "f"] as const) for (const w of tokens(form(s, g, sp))) if (/^[а-я-]+$/.test(w)) set.add(w);
  };
  const beats = [...BANK.scenarios.flatMap((s) => s.beats), ...Object.values(BANK.topics).flatMap((t) => t.beats), ...BANK.openers, ...BANK.quick];
  for (const b of beats) {
    addText(b.ai.ru);
    if (b.easy) addText(b.easy.ru);
    if (b.native) addText(b.native.ru);
    b.models.forEach((m) => addText(m.ru));
    b.reactions.forEach((r) => addText(r.say.ru));
    b.words.forEach((w) => addText(w.ru));
  }
  for (const c of Object.values(BANK.chars)) Object.values(c.answers).forEach((a) => addText(a.ru));
  for (const t of Object.values(BANK.topics)) [...t.react, t.like, t.dislike, t.callback].forEach((x) => x && addText(x.ru));
  for (const w of EXTRA.split(/\s+/)) if (w) set.add(low(w));
  return set;
})();
