import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { en, type MessageKey } from "./en";
import { it } from "./it";

/**
 * Typed, dependency-free i18n. `en` is the source of truth for the key set;
 * `it` is typed as Record<MessageKey, string>, so a missing translation is a
 * compile error, not a runtime hole. Numbers and dates stay it-IT everywhere
 * (domain spec G12) — only the copy switches.
 */

export type Locale = "en" | "it";
export type LocalePreference = "auto" | Locale;

const STORAGE_KEY = "ds-locale";

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, it };

export type TranslateParams = Record<string, string | number>;

export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  const template = dictionaries[locale][key] ?? en[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

function detectLocale(): Locale {
  return navigator.language?.toLowerCase().startsWith("it") ? "it" : "en";
}

function readPreference(): LocalePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "en" || stored === "it" ? stored : "auto";
}

export interface LocaleContextValue {
  locale: Locale;
  preference: LocalePreference;
  setPreference: (preference: LocalePreference) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
}

// Default value keeps components (and tests) working outside the provider.
const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  preference: "auto",
  setPreference: () => undefined,
  t: (key, params) => translate("en", key, params),
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>(readPreference);
  const locale: Locale = preference === "auto" ? detectLocale() : preference;

  const setPreference = useCallback((next: LocalePreference) => {
    setPreferenceState(next);
    if (next === "auto") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      preference,
      setPreference,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale, preference, setPreference],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}

/** Runtime guard for dynamically-built keys (e.g. `costItem.${id}`). */
export function isMessageKey(key: string): key is MessageKey {
  return key in en;
}

export type { MessageKey };
