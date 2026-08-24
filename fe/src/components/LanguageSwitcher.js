'use client';

import { useTranslation } from '@/lib/i18n/useTranslation';

export default function LanguageSwitcher({ size = 'normal', style = {} }) {
  const { lang, setLang } = useTranslation();
  const isSmall = size === 'small';

  const toggleLanguage = () => {
    setLang(lang === 'id' ? 'en' : 'id');
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/85 backdrop-blur-md border border-slate-200/95 text-slate-900 font-bold shadow-sm hover:shadow-md hover:border-indigo-200 hover:bg-white transition-all duration-200 select-none cursor-pointer ${
        isSmall ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
      }`}
      style={style}
      title={lang === 'id' ? 'Ganti ke English (EN)' : 'Switch to Bahasa Indonesia (ID)'}
    >
      <span className={isSmall ? 'text-sm leading-none' : 'text-base leading-none'}>
        {lang === 'id' ? '🇮🇩' : '🇬🇧'}
      </span>
      <span className="font-extrabold text-slate-700 tracking-wide">
        {lang === 'id' ? 'ID' : 'EN'}
      </span>
    </button>
  );
}
