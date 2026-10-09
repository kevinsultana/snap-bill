"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  Zap,
  Check,
  X,
  FileText,
  CreditCard,
  Building2,
  Mail,
  Users,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Lock,
  Layers,
  BarChart3,
  Menu,
} from "lucide-react";

export default function LandingPage() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Cek apakah user sudah memiliki sesi login aktif (cookie JWT)
  useEffect(() => {
    api
      .get("/api/settings")
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false));
  }, []);

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const faqs = [
    {
      q: t("landing.faq_1_q"),
      a: t("landing.faq_1_a"),
    },
    {
      q: t("landing.faq_2_q"),
      a: t("landing.faq_2_a"),
    },
    {
      q: t("landing.faq_3_q"),
      a: t("landing.faq_3_a"),
    },
    {
      q: t("landing.faq_4_q"),
      a: t("landing.faq_4_a"),
    },
    {
      q: t("landing.faq_5_q"),
      a: t("landing.faq_5_a"),
    },
    {
      q: t("landing.faq_6_q"),
      a: t("landing.faq_6_a"),
    },
  ];

  return (
    <div className="w-full relative">
      {/* ── 1. Sticky Navigation Bar ───────────────────────────────── */}
      <nav className="sticky top-0 left-0 right-0 z-50 bg-white/95 border-b border-slate-200/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 p-1 flex items-center justify-center shadow-md shadow-indigo-500/10 shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="SnapBill Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">
              Snap<span className="text-indigo-600">Bill</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <a
              href="#fitur"
              className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {t("landing.nav_features")}
            </a>
            <a
              href="#harga"
              className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {t("landing.nav_pricing")}
            </a>
            <a
              href="#faq"
              className="text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
            >
              FAQ
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSwitcher size="small" />

            {/* Desktop Auth Buttons */}
            <div className="hidden sm:flex items-center gap-2">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/15 transition-all"
                >
                  <span>{t("nav.dashboard")}</span>
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-3 sm:px-4 py-2 rounded-xl text-slate-700 hover:text-indigo-600 font-bold text-xs sm:text-sm transition-colors"
                  >
                    {t("auth.btn_login")}
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/15 transition-all"
                  >
                    <span>{t("auth.btn_register")}</span>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Hamburger Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-11 h-11 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 shadow-xl space-y-3">
            <div className="flex flex-col space-y-1">
              <a
                href="#fitur"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-4 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors"
              >
                {t("landing.nav_features")}
              </a>
              <a
                href="#harga"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-4 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors"
              >
                {t("landing.nav_pricing")}
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center px-4 py-3 text-sm font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl transition-colors"
              >
                FAQ
              </a>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md"
                >
                  {t("nav.dashboard")}
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center py-3 rounded-xl border border-slate-200 text-slate-800 font-bold text-sm hover:bg-slate-50"
                  >
                    {t("auth.btn_login")}
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full flex items-center justify-center py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md"
                  >
                    {t("auth.btn_register")}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ── 2. Hero Section ────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 md:pt-20 pb-16 text-center relative z-10">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] mb-6">
          {t("landing.hero_title_1")} <br className="hidden sm:block" />
          <span className="text-indigo-600">{t("landing.hero_title_2")}</span>
        </h1>

        <p className="text-base sm:text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-8 leading-relaxed font-normal">
          {t("landing.hero_desc")}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
          {isLoggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm sm:text-base shadow-md shadow-indigo-500/20 active:scale-[0.99] transition-all"
              >
                <span>
                  {t("dashboard.welcome")} {t("nav.dashboard")}
                </span>
              </Link>
              <Link
                href="/dashboard/invoices/create"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm sm:text-base shadow-xs hover:border-slate-300 transition-all"
              >
                <span>{t("dashboard.btn_create_invoice")}</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm sm:text-base shadow-md shadow-indigo-500/20 active:scale-[0.99] transition-all"
              >
                <span>{t("landing.cta_primary")}</span>
              </Link>
              <a
                href="#harga"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm sm:text-base shadow-xs hover:border-slate-300 transition-all"
              >
                <span>{t("landing.pricing_badge")}</span>
              </a>
            </>
          )}
        </div>

        {/* Metrics Counter Pill */}
        <div className="inline-flex flex-wrap items-center justify-center gap-6 sm:gap-10 px-8 py-3.5 rounded-2xl sm:rounded-full bg-white border border-slate-200 shadow-sm mb-14">
          <div className="flex flex-col items-center">
            <span className="text-lg font-black text-indigo-600 font-mono">
              100%
            </span>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t("landing.hero_stat_gateway")}
            </span>
          </div>
          <div className="hidden sm:block w-px h-7 bg-slate-200" />
          <div className="flex flex-col items-center">
            <span className="text-lg font-black text-indigo-600 font-mono">
              {t("landing.hero_stat_settled")}
            </span>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              {t("landing.brand_tagline")}
            </span>
          </div>
          <div className="hidden sm:block w-px h-7 bg-slate-200" />
          <div className="flex flex-col items-center">
            <span className="text-lg font-black text-indigo-600 font-mono">
              {t("landing.hero_stat_invoices")}
            </span>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Multi-Tenancy
            </span>
          </div>
        </div>

        {/* Hero Interactive Mockup Preview */}
        <div className="max-w-3xl mx-auto rounded-2xl p-1 bg-slate-200/80 shadow-xl">
          <div className="bg-white rounded-[14px] border border-slate-200 overflow-hidden text-left shadow-xs">
            <div className="bg-slate-100/90 px-4 py-3 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-slate-200 text-slate-500 text-xs font-mono">
                <Lock className="w-3 h-3 text-emerald-600" />
                <span>https://snapbill.id/pay/inv-demo-2026</span>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {t("invoices.status_paid")}
              </span>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-slate-100 gap-2 mb-4">
                <div>
                  <p className="text-base font-extrabold text-indigo-950">
                    Invoice #INV-202608-0042
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    Ditujukan ke: PT. Samudera Digital Nusantara
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {t("common.total")}
                  </p>
                  <p className="text-xl font-black text-indigo-600 font-mono">
                    Rp 4.500.000
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                <div className="flex justify-between items-center text-xs sm:text-sm bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-slate-700">
                  <span className="font-medium">
                    Jasa UI/UX Design & Branding SaaS
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    Rp 3.500.000
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs sm:text-sm bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 text-slate-700">
                  <span className="font-medium">
                    Development Next.js & Integrasi Payment
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    Rp 1.000.000
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Terbayar via QRIS Midtrans (Auto-Settled)</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                  <FileText className="w-3.5 h-3.5" />
                  <span>PDF & Kuitansi Terkirim ke Email Klien</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Features Section ─────────────────────────────────────── */}
      <section
        id="fitur"
        className="max-w-6xl mx-auto px-4 sm:px-6 py-20 relative z-10"
      >
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block px-3.5 py-1 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs uppercase tracking-wider mb-3">
            {t("landing.features_badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug mb-4">
            {t("landing.features_title")}
          </h2>
          <p className="text-slate-600 text-base leading-relaxed">
            {t("landing.hero_desc")}
          </p>
        </div>

        {/* Varied Feature Architecture: 2 Flagship Spotlights + 4 Supporting Grid */}
        <div className="space-y-6">
          {/* Spotlight Cards (2 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6">
                <FileText className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Core Engine
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-1 mb-3">
                {t("landing.feat_3_title")}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t("landing.feat_3_desc")}
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6">
                <CreditCard className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                Payment Gateway
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-1 mb-3">
                {t("landing.feat_1_title")}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t("landing.feat_1_desc")}
              </p>
            </div>
          </div>

          {/* Supporting Features (4 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
                <Building2 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1.5">
                {t("landing.feat_2_title")}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("landing.feat_2_desc")}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
                <Mail className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1.5">
                {t("landing.feat_4_title")}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("landing.feat_4_desc")}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1.5">
                {t("landing.feat_5_title")}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("landing.feat_5_desc")}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-1.5">
                {t("landing.feat_6_title")}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t("landing.feat_6_desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Pricing Section (Free vs Pro) ───────────────────────── */}
      <section
        id="harga"
        className="max-w-5xl mx-auto px-4 sm:px-6 py-20 relative z-10"
      >
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block px-3.5 py-1 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs uppercase tracking-wider mb-3">
            {t("landing.pricing_badge")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-snug">
            {t("landing.pricing_title")}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto">
          {/* FREE PLAN */}
          <div className="p-8 rounded-2xl bg-white border border-slate-200 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 mb-1">
                {t("landing.pricing_free_title")}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-6">
                {t("landing.pricing_free_desc")}
              </p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-xl font-bold text-slate-400">Rp</span>
                <span className="text-4xl font-black text-slate-900 font-mono">
                  0
                </span>
                <span className="text-xs font-semibold text-slate-500 ml-1">
                  {t("landing.pricing_free_period")}
                </span>
              </div>

              <div className="h-px bg-slate-100 mb-6" />

              <ul className="space-y-3.5 mb-8 text-sm text-slate-700">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-3" />
                  </div>
                  <span className="font-bold text-slate-900">
                    {t("landing.pricing_free_f1")}
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-3" />
                  </div>
                  <span>{t("landing.pricing_free_f2")}</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-3" />
                  </div>
                  <span>{t("landing.pricing_free_f3")}</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-3" />
                  </div>
                  <span>{t("landing.pricing_free_f4")}</span>
                </li>
                <li className="flex items-center gap-3 text-slate-400 line-through opacity-75">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </div>
                  <span>Unlimited Invoices</span>
                </li>
                <li className="flex items-center gap-3 text-slate-400 line-through opacity-75">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </div>
                  <span>Midtrans Snap BYOK</span>
                </li>
              </ul>
            </div>

            <Link
              href={isLoggedIn ? "/dashboard" : "/register"}
              className="w-full py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm text-center shadow-xs hover:border-slate-300 transition-all min-h-11 flex items-center justify-center"
            >
              {isLoggedIn ? t("nav.dashboard") : t("landing.pricing_free_cta")}
            </Link>
          </div>

          {/* PRO PLAN */}
          <div className="p-8 rounded-2xl bg-white border-2 border-indigo-600 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between relative">
            <div className="absolute -top-3.5 right-6 px-3.5 py-1 rounded-full bg-indigo-600 text-white font-bold text-xs uppercase tracking-wider shadow-sm">
              {t("landing.pricing_pro_badge")}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-2xl font-extrabold text-slate-900">
                  {t("landing.pricing_pro_title")}
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-black tracking-wider">
                  UNLIMITED
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mb-6">
                {t("landing.pricing_pro_desc")}
              </p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-xl font-bold text-slate-400">Rp</span>
                <span className="text-4xl font-black text-indigo-600 font-mono">
                  99.000
                </span>
                <span className="text-xs font-semibold text-slate-500 ml-1">
                  {t("landing.pricing_pro_period")}
                </span>
              </div>

              <div className="h-px bg-slate-100 mb-6" />

              <ul className="space-y-3.5 mb-8 text-sm text-slate-800">
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-3" />
                  </div>
                  <span className="font-bold text-slate-900">
                    {t("landing.pricing_pro_f1")}
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-3" />
                  </div>
                  <span className="font-bold text-slate-900">
                    {t("landing.pricing_pro_f2")}
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-3" />
                  </div>
                  <span>{t("landing.pricing_pro_f3")}</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-3" />
                  </div>
                  <span>{t("landing.pricing_pro_f4")}</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-3" />
                  </div>
                  <span>{t("landing.pricing_pro_f5")}</span>
                </li>
                <li className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-3" />
                  </div>
                  <span>{t("landing.pricing_pro_f6")}</span>
                </li>
              </ul>
            </div>

            <Link
              href={isLoggedIn ? "/dashboard/subscription" : "/register"}
              className="w-full inline-flex items-center justify-center py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 active:scale-[0.99] transition-all min-h-11"
            >
              <span>{t("landing.pricing_pro_cta")}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 5. FAQ Section ─────────────────────────────────────────── */}
      <section
        id="faq"
        className="max-w-3xl mx-auto px-4 sm:px-6 py-16 relative z-10"
      >
        <div className="text-center max-w-xl mx-auto mb-12">
          <span className="inline-block px-3.5 py-1 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs uppercase tracking-wider mb-3">
            FAQ
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {t("landing.faq_title")}
          </h2>
        </div>

        <div className="space-y-3.5">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden transition-all duration-200 hover:border-slate-300"
              >
                <button
                  type="button"
                  className="w-full px-5 py-4 flex items-center justify-between text-left font-bold text-slate-900 hover:text-indigo-600 transition-colors min-h-12"
                  onClick={() => toggleFaq(idx)}
                >
                  <span className="text-sm sm:text-base pr-4">{faq.q}</span>
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ${
                      isOpen
                        ? "bg-indigo-600 text-white rotate-180"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 6. Footer ──────────────────────────────────────────────── */}
      <footer className="mt-20 border-t border-slate-200 bg-white py-14 px-4 sm:px-6 relative z-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-indigo-100 p-1 flex items-center justify-center shadow-xs overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="SnapBill Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-lg font-extrabold text-slate-900 tracking-tight">
                Snap<span className="text-indigo-600">Bill</span>
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm">
              {t("landing.hero_desc")}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-2">
              {t("common.actions")}
            </h4>
            <a
              href="#fitur"
              className="text-sm text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {t("landing.features_badge")}
            </a>
            <a
              href="#harga"
              className="text-sm text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {t("landing.pricing_badge")}
            </a>
            <a
              href="#faq"
              className="text-sm text-slate-600 hover:text-indigo-600 transition-colors"
            >
              FAQ
            </a>
          </div>

          <div className="flex flex-col gap-2.5">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-2">
              SnapBill
            </h4>
            <Link
              href="/login"
              className="text-sm text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {t("auth.btn_login")}
            </Link>
            <Link
              href="/register"
              className="text-sm text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {t("auth.btn_register")}
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-slate-600 hover:text-indigo-600 transition-colors"
            >
              {t("nav.dashboard")}
            </Link>
          </div>
        </div>

        <div className="max-w-6xl mx-auto border-t border-slate-200/60 pt-6 text-center text-xs text-slate-400 font-medium">
          <p>
            &copy; {new Date().getFullYear()} SnapBill SaaS.{" "}
            {t("landing.footer_rights")}
          </p>
        </div>
      </footer>
    </div>
  );
}
