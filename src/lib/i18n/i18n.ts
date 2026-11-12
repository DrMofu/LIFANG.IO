export const SUPPORTED_LOCALES = ["zh", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LANGUAGE_COOKIE_KEY = "cube-language";
export const LANGUAGE_STORAGE_KEY = "cube-language";

const PAGE_TITLES = {
  home: { zh: "魔方练习与公式学习", en: "Cube Practice and Algorithm Learning" },
  practice: { zh: "魔方在线练习与计时", en: "Online Cube Practice and Timer" },
  trainer: { zh: "魔方CFOP专项练习", en: "Cube CFOP Training" },
  formulas: { zh: "魔方公式库", en: "Cube Algorithm Library" },
  articles: { zh: "教程", en: "Tutorials" },
  settings: { zh: "设置", en: "Settings" },
  stats: { zh: "魔方练习可视化统计", en: "Cube Practice Statistics and Visualization" },
} as const;

export function getPageTitle(locale: Locale, page: keyof typeof PAGE_TITLES) {
  return PAGE_TITLES[page][locale];
}

export function getSiteTitle(locale: Locale) {
  return `${locale === "zh" ? "立方" : "LIFANG.IO"} | ${getPageTitle(locale, "home")}`;
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

export function detectLocale(language: string | null | undefined): Locale {
  const normalized = language?.trim().toLowerCase() ?? "";
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("en")) return "en";
  return "en";
}
