'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Swal from 'sweetalert2';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
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
    setLoading(true);
    try {
      await api.post('/api/auth/login', form);
      router.push('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Email atau password salah. Silakan coba lagi.';
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
      <div className="auth-page-container">
        <div className="loading-screen" style={{ minHeight: 'auto' }}>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page-container">
      <div className="auth-glass-card">
        {/* Brand */}
        <div className="auth-brand">
          <div className="sidebar-logo" style={{ width: 40, height: 40, fontSize: 20 }}>⚡</div>
          <span className="sidebar-name" style={{ fontSize: 22 }}>Snap<b>Bill</b></span>
        </div>

        <h1 className="auth-title">Masuk ke Dashboard</h1>
        <p className="auth-subtitle">Kelola tagihan bisnis Anda dengan praktis dan otomatis.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email" className="form-label">Email Terdaftar</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className="form-input"
              placeholder="nama@perusahaan.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              className="form-input"
              placeholder="••••••••"
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary" style={{ padding: '13px', marginTop: 6 }}>
            {loading ? <span className="btn-spinner" /> : 'Masuk ke Akun ➜'}
          </button>
        </form>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 20 }}>
          Belum memiliki akun?{' '}
          <Link href="/register" className="auth-link">Daftar Akun Gratis</Link>
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
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--indigo-dark)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <span>←</span> Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}
