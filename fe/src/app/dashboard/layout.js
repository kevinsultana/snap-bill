'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Gem,
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';

function DashboardLayoutContent({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const [user, setUser] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [checking, setChecking] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NAV_ITEMS = [
    { href: '/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/dashboard/clients', label: t('nav.clients'), icon: Users },
    { href: '/dashboard/items', label: t('nav.items'), icon: Package },
    { href: '/dashboard/invoices', label: t('nav.invoices'), icon: FileText },
    { href: '/dashboard/subscription', label: t('nav.subscription'), icon: Gem },
    { href: '/dashboard/settings', label: t('nav.settings'), icon: Settings },
  ];

  const fetchUserData = useCallback(() => {
    return Promise.all([
      api.get('/api/settings'),
      api.get('/api/subscriptions/status').catch(() => ({ data: null })),
    ])
      .then(([settingsRes, subRes]) => {
        setUser(settingsRes.data);
        if (subRes.data) setSubStatus(subRes.data);
      })
      .catch(() => router.push('/login'))
      .finally(() => setChecking(false));
  }, [router]);

  useEffect(() => {
    fetchUserData();
  }, [pathname, searchParams, fetchUserData]);

  useEffect(() => {
    const handleSubUpdate = () => {
      fetchUserData();
    };
    window.addEventListener('subscription_updated', handleSubUpdate);
    return () => window.removeEventListener('subscription_updated', handleSubUpdate);
  }, [fetchUserData]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const handleUpgradePro = () => {
    router.push('/dashboard/subscription');
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: t('nav.logout_confirm_title'),
      text: t('nav.logout_confirm_text'),
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: t('nav.logout_confirm_btn'),
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
    });
    if (result.isConfirmed) {
      await api.post('/api/auth/logout');
      router.push('/login');
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const isPro = subStatus?.tier === 'pro' || user?.tier === 'pro';

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative z-10 w-full bg-slate-50">

      {/* ── Desktop Floating Glass Sidebar ────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 h-[calc(100vh-2rem)] sticky top-4 ml-4 my-4 p-5 rounded-3xl bg-white/80 backdrop-blur-xl border border-white/90 shadow-[0_10px_30px_-5px_rgba(99,102,241,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] z-30 shrink-0">

        {/* Brand Header */}
        <div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-200/70">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-white border border-indigo-100 p-1 flex items-center justify-center shadow-md shadow-indigo-500/10 shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="SnapBill Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              Snap<b className="text-indigo-600">Bill</b>
            </span>
          </Link>
          <LanguageSwitcher size="small" />
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-50/90 text-indigo-700 shadow-xs border border-indigo-200/60 font-bold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Subscription Tier Card in Sidebar */}
        <div className="mt-auto pt-3 mb-3 border-t border-slate-200/70">
          {isPro ? (
            <Link
              href="/dashboard/subscription"
              className="p-3 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/80 border border-amber-200/80 shadow-xs block transition hover:border-amber-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{t('nav.pro_active')}</span>
                </div>
                <span className="text-[10px] text-amber-700 font-bold">{t('common.view')} ↗</span>
              </div>
              <span className="text-[11px] text-amber-800 font-semibold block mt-1">Unlimited Invoices</span>
            </Link>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-50/90 border border-slate-200/80">
              <div className="flex justify-between items-center mb-1 text-xs">
                <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">
                  {t('nav.free_package')}
                </span>
                <span className="text-indigo-600 font-bold text-[11px]">
                  {subStatus?.invoiceCountThisMonth ?? 0} / 10 inv
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden my-2">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, ((subStatus?.invoiceCountThisMonth ?? 0) / 10) * 100)}%`,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleUpgradePro}
                disabled={upgrading}
                className="w-full mt-1 py-1.5 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{upgrading ? t('common.loading') : t('nav.upgrade_pro')}</span>
              </button>
            </div>
          )}
        </div>

        {/* User Profile & Logout Footer */}
        <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
              {user?.business_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate leading-tight">
                {user?.business_name || user?.email}
              </p>
              <p className={`text-[11px] font-semibold ${isPro ? 'text-amber-700' : 'text-indigo-600'}`}>
                {isPro ? t('nav.pro_member') : t('nav.free_plan')}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
            title={t('nav.logout')}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Header (< md screens) ─────────────────────────── */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white border border-indigo-100 p-0.5 flex items-center justify-center shadow-xs overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="SnapBill Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Snap<b className="text-indigo-600">Bill</b>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher size="small" />
          <button
            type="button"
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 transition-opacity duration-300 md:hidden ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Drawer Sidebar */}
      <div
        className={`fixed top-0 left-0 bottom-0 w-72 bg-white/95 backdrop-blur-2xl p-5 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80">
          <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white border border-indigo-100 p-1 flex items-center justify-center shadow-xs overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="SnapBill Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              Snap<b className="text-indigo-600">Bill</b>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {user?.business_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {user?.business_name || user?.email}
                </p>
                <p className={`text-[11px] font-semibold ${isPro ? 'text-amber-700' : 'text-indigo-600'}`}>
                  {isPro ? t('nav.pro_member') : t('nav.free_plan')}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title={t('nav.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Dashboard Content ────────────────────────────────────── */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
        {children}
      </main>

    </div>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
