'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import id from './dictionaries/id';
import en from './dictionaries/en';

const dictionaries = { id, en };

export const LanguageContext = createContext({
  lang: 'id',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('id');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('app_lang');
      if (savedLang && (savedLang === 'id' || savedLang === 'en')) {
        setLangState(savedLang);
      }
    }
  }, []);

  const setLang = useCallback((newLang) => {
    if (newLang !== 'id' && newLang !== 'en') return;
    setLangState(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('app_lang', newLang);
      document.documentElement.lang = newLang;
    }
  }, []);

  const t = useCallback(
    (keyPath, params = {}) => {
      if (!keyPath) return '';
      const keys = keyPath.split('.');
      
      let current = dictionaries[lang] || dictionaries.id;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          // Fallback to id dictionary
          let fallback = dictionaries.id;
          for (const fbKey of keys) {
            if (fallback && typeof fallback === 'object' && fbKey in fallback) {
              fallback = fallback[fbKey];
            } else {
              fallback = keyPath;
              break;
            }
          }
          current = fallback;
          break;
        }
      }

      if (typeof current !== 'string') {
        return keyPath;
      }

      // Replace interpolation params like {count}, {name}, etc.
      let result = current;
      if (params && typeof params === 'object') {
        Object.keys(params).forEach((paramKey) => {
          result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(params[paramKey]));
        });
      }

      return result;
    },
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
