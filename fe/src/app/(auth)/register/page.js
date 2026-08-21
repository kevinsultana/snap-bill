'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Swal from 'sweetalert2';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    phone: '',
    business_name: '',
    password: '',
    confirm: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1. Validasi Password
    if (form.password.length < 8) {
      Swal.fire({
        icon: 'warning',
        title: 'Password Terlalu Pendek',
        text: 'Password minimal harus 8 karakter.',
        confirmButtonColor: '#6366f1',
      });
      return;
    }

    if (form.password !== form.confirm) {
      Swal.fire({
        icon: 'warning',
        title: 'Password Tidak Cocok',
        text: 'Pastikan konfirmasi password sama dengan password yang dimasukkan.',
        confirmButtonColor: '#6366f1',
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
          title: 'Nomor Telepon Tidak Valid',
          text: 'Gunakan format nomor telepon yang valid, contoh: 08123456789 atau +628123456789.',
          confirmButtonColor: '#6366f1',
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
      });
      router.push('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Terjadi kesalahan saat pendaftaran. Silakan coba lagi.';
      Swal.fire({
        icon: 'error',
        title: 'Registrasi Gagal',
        text: msg,
        confirmButtonColor: '#6366f1',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card" style={{ maxWidth: 460 }}>
      {/* Logo / Brand */}
      <div className="auth-brand">
        <div className="auth-logo">⚡</div>
        <h1 className="auth-title">Snap<span>Bill</span></h1>
        <p className="auth-subtitle">Invoice Generator SaaS</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <h2 className="form-heading">Mulai Akun Gratis Anda</h2>
        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: -8, marginBottom: 4 }}>
          Paket Free mencakup 10 invoice/bulan. Tanpa kartu kredit.
        </p>

        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email Bisnis / Pribadi <span className="req">*</span>
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
            placeholder="nama@bisnisanda.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone" className="form-label">
            Nomor WhatsApp / Telepon <span className="req">*</span>
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
            placeholder="081234567890"
          />
        </div>

        <div className="form-group">
          <label htmlFor="business_name" className="form-label">
            Nama Bisnis / Brand (Opsional)
          </label>
          <input
            id="business_name"
            name="business_name"
            type="text"
            value={form.business_name}
            onChange={handleChange}
            className="form-input"
            placeholder="Contoh: Studio Kreatif Nusantara"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">
            Password <span className="req">*</span>
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
            placeholder="Minimal 8 karakter"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirm" className="form-label">
            Konfirmasi Password <span className="req">*</span>
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
            placeholder="Ulangi password di atas"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: 8 }}>
          {loading ? <span className="btn-spinner" /> : '🚀 Buat Akun Sekarang'}
        </button>
      </form>

      <p className="auth-footer">
        Sudah memiliki akun?{' '}
        <Link href="/login" className="auth-link">Masuk ke Dashboard</Link>
      </p>
    </div>
  );
}
