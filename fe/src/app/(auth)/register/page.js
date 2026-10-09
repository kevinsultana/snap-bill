'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// Shared input classes
const INPUT_CLS =
  'w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-150';
const LABEL_CLS =
  'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [form, setForm] = useState({
    email: '',
    phone: '',
    business_name: '',
    password: '',
    confirm: '',
  });
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // If already logged in, redirect to dashboard
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

    // 1. Validate Password length
    if (form.password.length < 8) {
      Swal.fire({
        icon: 'warning',
        title: 'Password',
        text: 'Password minimal harus 8 karakter.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      return;
    }

    if (form.password !== form.confirm) {
      Swal.fire({
        icon: 'warning',
        title: 'Password',
        text: 'Pastikan konfirmasi password sama dengan password yang dimasukkan.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      return;
    }

    // 2. Validate phone format
    if (form.phone && form.phone.trim() !== '') {
      const cleanPhone = form.phone.trim().replace(/[\s-]/g, '');
      const phoneRegex = /^(?:\+?62|0)8[1-9][0-9]{6,11}$/;
      const generalPhoneRegex = /^\+?[0-9]{9,15}$/;
      if (!phoneRegex.test(cleanPhone) && !generalPhoneRegex.test(cleanPhone)) {
        Swal.fire({
          icon: 'warning',
          title: 'Phone',
          text: 'Gunakan format nomor telepon yang valid, contoh: 08123456789 atau +628123456789.',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
        return;
      }
    }

    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        email: form.email,
        phone: form.phone,
        business_name: form.business_name,
        password: form.password,
      });

      await Swal.fire({
        icon: 'success',
        title: 'Registrasi Berhasil!',
        text: 'Selamat datang di SnapBill! Akun Anda aktif dengan paket Free (10 invoice/bulan).',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      router.push('/dashboard');
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Terjadi kesalahan saat pendaftaran. Silakan coba lagi.';
      Swal.fire({
        icon: 'error',
        title: 'Registrasi Gagal',
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
      <div className="relative w-full max-w-lg bg-white border border-slate-200/80 rounded-2xl shadow-xs p-8 sm:p-10">

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
          {t('auth.register_title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1 mb-7 leading-relaxed">
          {t('auth.register_subtitle')}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className={LABEL_CLS}>
              {t('auth.email')} <span className="text-rose-500">*</span>
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

          {/* Phone */}
          <div>
            <label htmlFor="phone" className={LABEL_CLS}>
              {t('auth.phone')} <span className="text-rose-500">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              value={form.phone}
              onChange={handleChange}
              className={INPUT_CLS}
              placeholder={t('auth.phone_placeholder')}
            />
          </div>

          {/* Business Name */}
          <div>
            <label htmlFor="business_name" className={LABEL_CLS}>
              {t('auth.business_name')}{' '}
              <span className="text-slate-400 font-normal normal-case">
                ({t('common.optional')})
              </span>
            </label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              value={form.business_name}
              onChange={handleChange}
              className={INPUT_CLS}
              placeholder={t('auth.business_name_placeholder')}
            />
          </div>

          {/* Password Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className={LABEL_CLS}>
                {t('auth.password')} <span className="text-rose-500">*</span>
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.password}
                onChange={handleChange}
                className={INPUT_CLS}
                placeholder={t('auth.password_placeholder')}
              />
            </div>
            <div>
              <label htmlFor="confirm" className={LABEL_CLS}>
                Konfirmasi {t('auth.password')} <span className="text-rose-500">*</span>
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={form.confirm}
                onChange={handleChange}
                className={INPUT_CLS}
                placeholder={t('auth.password_placeholder')}
              />
            </div>
          </div>

          {/* Password strength hint */}
          {form.password.length > 0 && form.password.length < 8 && (
            <p className="text-xs text-rose-500 font-semibold -mt-1">
              Minimal 8 karakter ({8 - form.password.length} karakter lagi)
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold flex items-center justify-center gap-2 shadow-md shadow-indigo-500/25 transition-all duration-150 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              t('auth.btn_register')
            )}
          </button>
        </form>

        {/* Footer Links */}
        <p className="text-xs text-slate-500 text-center mt-6">
          {t('auth.has_account')}{' '}
          <Link href="/login" className="text-indigo-600 font-bold hover:underline">
            {t('auth.login_link')}
          </Link>
        </p>

        <div className="mt-5 pt-5 border-t border-slate-200/80 text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center min-h-11 px-3 py-1.5 text-xs text-slate-500 font-semibold hover:text-slate-800 transition-colors duration-150"
          >
            {t('common.back')}
          </Link>
        </div>
      </div>
    </div>
  );
}
