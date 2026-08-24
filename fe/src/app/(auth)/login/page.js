'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// Shared input classes
const INPUT_CLS =
  'w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-150';
const LABEL_CLS =
  'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // If already logged in, redirect straight to dashboard
  useEffect(() => {
    api
      .get('/api/settings')
      .then(() => router.replace('/dashboard'))
      .catch(() => setCheckingAuth(false));
  }, [router]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/api/auth/login', form);
      router.push('/dashboard');
    } catch (err) {
      const msg =
        err.response?.data?.message || 'Email atau password salah. Silakan coba lagi.';
      Swal.fire({
        icon: 'error',
        title: 'Login Gagal',
        text: msg,
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <div className="relative w-full max-w-md bg-white/90 backdrop-blur-xl border border-white/90 rounded-3xl shadow-[0_20px_60px_-12px_rgba(99,102,241,0.15)] p-8 sm:p-10">

        {/* Language Switcher */}
        <div className="absolute top-5 right-5">
          <LanguageSwitcher size="small" />
        </div>

        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 mb-6 group">
          <div className="w-10 h-10 rounded-xl bg-white border border-indigo-100 p-1 flex items-center justify-center shadow-md shadow-indigo-500/15 overflow-hidden group-hover:scale-105 transition-transform">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="SnapBill Logo" className="w-full h-full object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            Snap<b className="text-indigo-600">Bill</b>
          </span>
        </Link>

        {/* Heading */}
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {t('auth.login_title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1 mb-7 leading-relaxed">
          {t('auth.login_subtitle')}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label htmlFor="email" className={LABEL_CLS}>
              {t('auth.email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className={INPUT_CLS}
              placeholder={t('auth.email_placeholder')}
            />
          </div>

          <div>
            <label htmlFor="password" className={LABEL_CLS}>
              {t('auth.password')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              className={INPUT_CLS}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-500/25 transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              `${t('auth.btn_login')} ➜`
            )}
          </button>
        </form>

        {/* Footer Links */}
        <p className="text-xs text-slate-500 text-center mt-6">
          {t('auth.no_account')}{' '}
          <Link
            href="/register"
            className="text-indigo-600 font-bold hover:underline"
          >
            {t('auth.register_link')}
          </Link>
        </p>

        <div className="mt-5 pt-5 border-t border-slate-200/80 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-semibold hover:text-slate-700 transition-colors duration-150"
          >
            <span>←</span> {t('common.back')}
          </Link>
        </div>
      </div>
    </div>
  );
}
