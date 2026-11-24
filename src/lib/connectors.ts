/** Linking words taught in the conversation lessons (same list as scripts/build-content.mjs). */
export const CONNECTORS: { ru: string; en: string }[] = [
  { ru: "потому что", en: "because" }, { ru: "поэтому", en: "so, that's why" }, { ru: "например", en: "for example" },
  { ru: "кстати", en: "by the way" }, { ru: "на самом деле", en: "actually" }, { ru: "сначала", en: "first" },
  { ru: "потом", en: "then" }, { ru: "после этого", en: "after that" }, { ru: "хотя", en: "although" },
  { ru: "если", en: "if" }, { ru: "кроме того", en: "besides" }, { ru: "в общем", en: "all in all" },
  { ru: "честно говоря", en: "to be honest" }, { ru: "с одной стороны", en: "on the one hand" }, { ru: "с другой стороны", en: "on the other hand" },
];

const norm = (t: string) => ` ${t.toLowerCase().replace(/́/g, "").replace(/ё/g, "е").replace(/[^а-яa-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim()} `;

/** The linking words that appear in a piece of Russian text. */
export const connectorsIn = (text: string) => CONNECTORS.filter((c) => norm(text).includes(norm(c.ru)));
