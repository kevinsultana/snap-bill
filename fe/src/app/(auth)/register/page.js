'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Swal from 'sweetalert2';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      Swal.fire({ icon: 'warning', title: 'Password tidak cocok', text: 'Pastikan konfirmasi password sama.', confirmButtonColor: '#6366f1' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/api/auth/register', { email: form.email, password: form.password });
      await Swal.fire({ icon: 'success', title: 'Registrasi Berhasil!', text: 'Akun Anda telah dibuat. Silakan masuk.', confirmButtonColor: '#6366f1' });
      router.push('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Terjadi kesalahan. Coba lagi.';
      Swal.fire({ icon: 'error', title: 'Registrasi Gagal', text: msg, confirmButtonColor: '#6366f1' });
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
        <h2 className="form-heading">Buat akun baru</h2>

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
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            className="form-input"
            placeholder="Min. 8 karakter"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirm" className="form-label">Konfirmasi Password</label>
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
            placeholder="••••••••"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? <span className="btn-spinner" /> : 'Daftar'}
        </button>
      </form>

      <p className="auth-footer">
        Sudah punya akun?{' '}
        <Link href="/login" className="auth-link">Masuk di sini</Link>
      </p>
    </div>
  );
}
