"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  LANGUAGE_COOKIE_KEY,
  LANGUAGE_STORAGE_KEY,
  getSiteTitle,
  isLocale,
  type Locale,
} from "@/lib/i18n";
import { messages, type MessageKey } from "@/lib/i18n-messages";
import { translateEnglishSource } from "@/lib/i18n-source-messages";

type LanguageContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey | string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);
const LANGUAGE_CHANGE_EVENT = "cube-language-change";

function readStoredLocale(fallback: Locale) {
  if (typeof window === "undefined") return fallback;
  try {
    const savedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLocale(savedLocale) ? savedLocale : fallback;
  } catch {
    return fallback;
  }
}

export function LanguageProvider({ children, initialLocale }: { children: ReactNode; initialLocale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();
  const subscribeLocale = useCallback((onStoreChange: () => void) => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LANGUAGE_STORAGE_KEY) onStoreChange();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(LANGUAGE_CHANGE_EVENT, onStoreChange);
    };
  }, []);
  const getLocaleSnapshot = useCallback(() => readStoredLocale(initialLocale), [initialLocale]);
  const getServerLocaleSnapshot = useCallback(() => initialLocale, [initialLocale]);
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getServerLocaleSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    const isArticle = pathname.startsWith("/articles/");
    if (!isArticle) document.title = getSiteTitle(locale);
  }, [locale, pathname]);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    setLocale(nextLocale) {
      try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale);
      } catch {
        // localStorage can be unavailable in restricted browsing modes.
      }
      window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT));
      document.cookie = `${LANGUAGE_COOKIE_KEY}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.refresh();
    },
    t(key) {
      if (key in messages[locale]) return messages[locale][key as MessageKey];
      if (locale === "en") return translateEnglishSource(key);
      return key;
    },
  }), [locale, router]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
