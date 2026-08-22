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
      className="btn-lang-toggle"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: isSmall ? '6px 12px' : '7px 14px',
        fontSize: isSmall ? 12 : 13,
        fontWeight: 700,
        borderRadius: 9999,
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(226, 232, 240, 0.95)',
        color: '#1e293b',
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none',
        ...style,
      }}
      title={lang === 'id' ? 'Ganti ke English (EN)' : 'Switch to Bahasa Indonesia (ID)'}
    >
      <span style={{ fontSize: isSmall ? 14 : 15, lineHeight: 1 }}>
        {lang === 'id' ? '🇮🇩' : '🇬🇧'}
      </span>
      <span style={{ fontWeight: 800, color: '#334155', letterSpacing: '0.03em' }}>
        {lang === 'id' ? 'ID' : 'EN'}
      </span>
    </button>
  );
}
