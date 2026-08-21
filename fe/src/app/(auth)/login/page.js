'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Swal from 'sweetalert2';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

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
      const msg = err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.';
      Swal.fire({ icon: 'error', title: 'Login Gagal', text: msg, confirmButtonColor: '#6366f1' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      {/* Logo / Brand */}
      <div className="auth-brand">
        <div className="auth-logo">⚡</div>
        <h1 className="auth-title">Snap<span>Bill</span></h1>
        <p className="auth-subtitle">Invoice Generator SaaS</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <h2 className="form-heading">Masuk ke akun Anda</h2>

        <div className="form-group">
          <label htmlFor="email" className="form-label">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            className="form-input"
            placeholder="you@example.com"
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

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <span className="btn-spinner" /> : 'Masuk'}
        </button>
      </form>

      <p className="auth-footer">
        Belum punya akun?{' '}
        <Link href="/register" className="auth-link">Daftar sekarang</Link>
      </p>
    </div>
  );
}
