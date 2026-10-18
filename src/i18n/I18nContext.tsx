import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Language } from '@/config/languages';
import { defaultLanguage, languages } from '@/config/languages';
import { translate } from '@/i18n/translations';

interface I18nContextValue {
  language: Language;
  dir: 'ltr' | 'rtl';
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  languages: typeof languages;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'zdstudio.language';

function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return defaultLanguage;
  const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null;
  if (stored && languages.some((l) => l.code === stored)) return stored;
  return defaultLanguage;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const dir = useMemo<'ltr' | 'rtl'>(() => (language === 'ar' ? 'rtl' : 'ltr'), [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, lang);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(language, key, params),
    [language]
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.dir = dir;
    }
  }, [language, dir]);

  const value = useMemo<I18nContextValue>(
    () => ({ language, dir, setLanguage, t, languages }),
    [language, dir, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
