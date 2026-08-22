'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';
import LanguageSwitcher from '@/components/LanguageSwitcher';

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

  // Jika sudah login dan memiliki cookie sesi, langsung arahkan ke dashboard
  useEffect(() => {
    api.get('/api/settings')
      .then(() => {
        router.replace('/dashboard');
      })
      .catch(() => {
        setCheckingAuth(false);
      });
  }, [router]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validasi Password
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

    // 2. Validasi Format Nomor Telepon
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
        title: '🎉 Registrasi Berhasil!',
        text: 'Selamat datang di SnapBill! Akun Anda aktif dengan paket Free (10 invoice/bulan).',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      router.push('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Terjadi kesalahan saat pendaftaran. Silakan coba lagi.';
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
      <div className="auth-page-container">
        <div className="loading-screen" style={{ minHeight: 'auto' }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-container">
      <div className="auth-glass-card" style={{ maxWidth: 480, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, right: 16 }}>
          <LanguageSwitcher size="small" />
        </div>

        {/* Brand */}
        <div className="auth-brand">
          <div className="sidebar-logo" style={{ width: 40, height: 40, fontSize: 20 }}>⚡</div>
          <span className="sidebar-name" style={{ fontSize: 22 }}>Snap<b>Bill</b></span>
        </div>

        <h1 className="auth-title">{t('auth.register_title')}</h1>
        <p className="auth-subtitle">{t('auth.register_subtitle')}</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              {t('auth.email')} <span className="req">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className="form-input"
              placeholder={t('auth.email_placeholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">
              {t('auth.phone')} <span className="req">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              autoComplete="tel"
              value={form.phone}
              onChange={handleChange}
              className="form-input"
              placeholder={t('auth.phone_placeholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="business_name" className="form-label">
              {t('auth.business_name')} ({t('common.optional')})
            </label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              value={form.business_name}
              onChange={handleChange}
              className="form-input"
              placeholder={t('auth.business_name_placeholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              {t('auth.password')} <span className="req">*</span>
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
              className="form-input"
              placeholder={t('auth.password_placeholder')}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirm" className="form-label">
              Konfirmasi {t('auth.password')} <span className="req">*</span>
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
              className="form-input"
              placeholder={t('auth.password_placeholder')}
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '13px', marginTop: 8 }}>
            {loading ? <span className="btn-spinner" /> : `🚀 ${t('auth.btn_register')} ➜`}
          </button>
        </form>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 20 }}>
          {t('auth.has_account')}{' '}
          <Link href="/login" className="auth-link">{t('auth.login_link')}</Link>
        </p>

        <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(226, 232, 240, 0.8)', textAlign: 'center' }}>
          <Link
            href="/"
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'none',
              fontWeight: 600,
              transition: 'color 0.2s',
            }}
          >
            <span>←</span> {t('common.back')}
          </Link>
        </div>
      </div>
    </div>
  );
}
