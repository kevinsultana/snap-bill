"use client";

import { useTranslation } from "@/lib/i18n/useTranslation";
import { Globe } from "lucide-react";

export default function LanguageSwitcher({ size = "normal", style = {} }) {
  const { lang, setLang } = useTranslation();
  const isSmall = size === "small";

  const toggleLanguage = () => {
    setLang(lang === "id" ? "en" : "id");
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-white border border-slate-200 text-slate-900 font-bold shadow-xs hover:border-indigo-300 hover:bg-slate-50 transition-all select-none cursor-pointer min-h-11 min-w-11 ${
        isSmall ? "px-3 py-2 text-xs" : "px-3.5 py-2.5 text-sm"
      }`}
      style={style}
      title={
        lang === "id"
          ? "Ganti ke English (EN)"
          : "Switch to Bahasa Indonesia (ID)"
      }
    >
      <Globe
        className={
          isSmall ? "w-3.5 h-3.5 text-indigo-600" : "w-4 h-4 text-indigo-600"
        }
      />
      <span className="font-extrabold text-slate-700 tracking-wide">
        {lang === "id" ? "ID" : "EN"}
      </span>
    </button>
  );
}
