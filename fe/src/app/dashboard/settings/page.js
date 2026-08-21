'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import Swal from 'sweetalert2';

const MAX_BANKS = 5;
const EMPTY_BANK = { bank_name: '', account_number: '', account_holder: '' };

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Business Identity
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Midtrans BYOK
  const [serverKey, setServerKey] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [showServerKey, setShowServerKey] = useState(false);
  const [showClientKey, setShowClientKey] = useState(false);

  // Bank accounts
  const [banks, setBanks] = useState([]);

  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get('/api/settings')
      .then((res) => {
        const d = res.data;
        setBusinessName(d.business_name || '');
        setEmail(d.email || '');
        setPhone(d.phone || '');
        setAddress(d.address || '');
        setLogoUrl(d.logo_url || '');
        setServerKey(d.midtrans_server_key || '');
        setClientKey(d.midtrans_client_key || '');
        setBanks(Array.isArray(d.bank_accounts) && d.bank_accounts.length > 0
          ? d.bank_accounts
          : []);
      })
      .catch(() => {
        Swal.fire({
          icon: 'error',
          title: 'Gagal memuat pengaturan',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
      })
      .finally(() => setLoading(false));
  }, []);

  // --- Logo Upload Handler ---
  const handleLogoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi ukuran file (maks 5MB)
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'Ukuran File Terlalu Besar',
        text: 'Ukuran logo maksimal 5 MB.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    setUploadingLogo(true);
    try {
      const res = await api.post('/api/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setLogoUrl(res.data.logo_url);
      Swal.fire({
        icon: 'success',
        title: 'Logo Berhasil Diunggah!',
        text: 'Logo akan otomatis muncul di kop invoice PDF dan portal pembayaran.',
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: 'swal-custom-popup' },
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal mengunggah logo ke MinIO.';
      Swal.fire({
        icon: 'error',
        title: 'Gagal Upload Logo',
        text: msg,
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    const result = await Swal.fire({
      title: 'Hapus Logo Bisnis?',
      text: 'Logo akan dihapus dari header faktur PDF invoice Anda.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#64748b',
      customClass: { popup: 'swal-custom-popup' },
    });

    if (!result.isConfirmed) return;

    try {
      await api.delete('/api/settings/logo');
      setLogoUrl('');
      Swal.fire({
        icon: 'success',
        title: 'Logo Berhasil Dihapus',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'swal-custom-popup' },
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menghapus Logo',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    }
  };

  // --- Bank helpers ---
  const addBank = () => {
    if (banks.length >= MAX_BANKS) return;
    setBanks((prev) => [...prev, { ...EMPTY_BANK }]);
  };

  const removeBank = (idx) => {
    setBanks((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateBank = (idx, field, value) => {
    setBanks((prev) => prev.map((b, i) => i === idx ? { ...b, [field]: value } : b));
  };

  // --- Save All Settings ---
  const handleSave = async (e) => {
    e.preventDefault();

    // Validasi bank: pastikan field wajib terisi
    for (const b of banks) {
      if (!b.bank_name.trim() || !b.account_number.trim()) {
        Swal.fire({
          icon: 'warning',
          title: 'Data rekening tidak lengkap',
          text: 'Nama bank dan nomor rekening wajib diisi.',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
        return;
      }
    }

    setSaving(true);
    try {
      await api.put('/api/settings', {
        business_name: businessName,
        email: email,
        phone: phone,
        address: address,
        midtrans_server_key: serverKey,
        midtrans_client_key: clientKey,
        bank_accounts: banks,
      });

      Swal.fire({
        icon: 'success',
        title: 'Pengaturan Tersimpan! 🎉',
        text: 'Profil identitas brand, kontak, dan metode pembayaran berhasil diperbarui.',
        timer: 2200,
        showConfirmButton: false,
        customClass: { popup: 'swal-custom-popup' },
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan pengaturan.';
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: msg,
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-screen">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Pengaturan Bisnis</h1>
          <p className="page-desc">Kelola identitas brand, logo PDF, kontak, Midtrans (BYOK), dan rekening bank transfer.</p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 880 }}>

        {/* ── 1. Identitas Brand & Logo ─────────────────────────────── */}
        <div className="glass-card" style={{ padding: 26 }}>
          <h2 className="section-title">
            <span className="section-icon">🏢</span> 1. Identitas Brand & Logo Usaha
          </h2>
          <p className="form-hint" style={{ marginBottom: 20 }}>
            Informasi dan logo ini akan dicantumkan secara profesional pada kop surat faktur invoice PDF dan halaman portal pembayaran klien.
          </p>

          {/* Logo Uploader */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap', marginBottom: 24, padding: '16px 20px', background: 'rgba(248, 250, 252, 0.8)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 16,
                border: '2px dashed #c7d2fe',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.08)',
              }}
            >
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logoUrl}
                  alt="Logo Bisnis"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 6 }}
                />
              ) : (
                <span style={{ fontSize: 32, opacity: 0.5 }}>🏢</span>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                Logo Bisnis / Perusahaan
              </h4>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                Format didukung: PNG, JPG, WebP. Ukuran maksimal 5MB (Rekomendasi rasio landscape/kotak).
              </p>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoSelect}
                accept="image/png, image/jpeg, image/webp"
                style={{ display: 'none' }}
              />

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ padding: '7px 14px', fontSize: 13 }}
                >
                  {uploadingLogo ? (
                    <>
                      <span className="btn-spinner" style={{ borderColor: 'rgba(99, 102, 241, 0.3)', borderTopColor: 'var(--indigo)' }} /> Mengunggah...
                    </>
                  ) : (
                    <>📁 {logoUrl ? 'Ganti Logo' : 'Upload Logo'}</>
                  )}
                </button>

                {logoUrl && (
                  <button
                    type="button"
                    className="btn-action btn-delete"
                    disabled={uploadingLogo}
                    onClick={handleDeleteLogo}
                    style={{ padding: '7px 14px', fontSize: 13 }}
                  >
                    🗑️ Hapus Logo
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields: Business Name, Email, Phone, Address */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label htmlFor="business_name" className="form-label">
                Nama Bisnis / Brand <span className="req">*</span>
              </label>
              <input
                id="business_name"
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="form-input"
                placeholder="Contoh: Studio Kreatif Nusantara"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email Bisnis / Kontak <span className="req">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-input"
                  placeholder="kontak@perusahaan.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone" className="form-label">
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="form-input"
                  placeholder="081234567890"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="address" className="form-label">
                Alamat Kantor / Domisili Usaha
              </label>
              <textarea
                id="address"
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="form-input"
                placeholder="Contoh: Gedung Artha Lantai 5, Jl. Sudirman No. 45, Jakarta Selatan"
                style={{ resize: 'vertical' }}
              />
              <p className="form-hint">Alamat ini akan dicantumkan pada bagian kop atas faktur PDF invoice Anda.</p>
            </div>
          </div>
        </div>

        {/* ── 2. Midtrans BYOK ──────────────────────────────────────── */}
        <div className="glass-card" style={{ padding: 26 }}>
          <h2 className="section-title">
            <span className="section-icon">💳</span> 2. Integrasi Midtrans (BYOK)
          </h2>
          <p className="form-hint" style={{ marginBottom: 18 }}>
            Gunakan API Keys Midtrans Snap Anda untuk menerima pembayaran otomatis QRIS, GoPay, dan Virtual Account langsung ke rekening Anda. Biarkan kosong jika hanya menggunakan transfer manual.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label htmlFor="server_key" className="form-label">Midtrans Server Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="server_key"
                  type={showServerKey ? 'text' : 'password'}
                  value={serverKey}
                  onChange={(e) => setServerKey(e.target.value)}
                  className="form-input"
                  placeholder="SB-Mid-server-..."
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowServerKey((v) => !v)}
                  title={showServerKey ? 'Sembunyikan' : 'Tampilkan'}
                  style={{ padding: '0 14px' }}
                >
                  {showServerKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="client_key" className="form-label">Midtrans Client Key</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="client_key"
                  type={showClientKey ? 'text' : 'password'}
                  value={clientKey}
                  onChange={(e) => setClientKey(e.target.value)}
                  className="form-input"
                  placeholder="SB-Mid-client-..."
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowClientKey((v) => !v)}
                  title={showClientKey ? 'Sembunyikan' : 'Tampilkan'}
                  style={{ padding: '0 14px' }}
                >
                  {showClientKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. Rekening Bank Transfer Manual ─────────────────────── */}
        <div className="glass-card" style={{ padding: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 10 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              <span className="section-icon">🏦</span> 3. Rekening Bank Transfer Manual
            </h2>
            <span className="glass-pill" style={{ color: 'var(--text-secondary)' }}>
              {banks.length} / {MAX_BANKS} Rekening
            </span>
          </div>
          <p className="form-hint" style={{ marginBottom: 18 }}>
            Rekening ini akan ditampilkan kepada klien sebagai pilihan transfer langsung dengan fasilitas upload bukti transfer MinIO.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {banks.map((bank, idx) => (
              <div key={idx} style={{ background: 'rgba(248, 250, 252, 0.8)', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 48px 18px 18px', position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Nama Bank <span className="req">*</span></label>
                    <input
                      type="text"
                      value={bank.bank_name}
                      onChange={(e) => updateBank(idx, 'bank_name', e.target.value)}
                      className="form-input"
                      placeholder="BCA / Mandiri / BNI"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nomor Rekening <span className="req">*</span></label>
                    <input
                      type="text"
                      value={bank.account_number}
                      onChange={(e) => updateBank(idx, 'account_number', e.target.value)}
                      className="form-input"
                      placeholder="Contoh: 1234567890"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Atas Nama (A/N)</label>
                    <input
                      type="text"
                      value={bank.account_holder}
                      onChange={(e) => updateBank(idx, 'account_holder', e.target.value)}
                      className="form-input"
                      placeholder="Nama pemilik rekening"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeBank(idx)}
                  className="btn-action btn-delete"
                  style={{ position: 'absolute', top: 16, right: 14, padding: '6px 10px', fontSize: 13 }}
                  title="Hapus rekening ini"
                >
                  ✕
                </button>
              </div>
            ))}

            {banks.length < MAX_BANKS && (
              <button
                type="button"
                className="btn-secondary"
                onClick={addBank}
                style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed', padding: 12 }}
              >
                + Tambah Rekening Bank ({banks.length}/{MAX_BANKS})
              </button>
            )}
          </div>
        </div>

        {/* ── Submit Button ────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '14px 32px', fontSize: 15 }}>
            {saving ? <><span className="btn-spinner" /> Menyimpan...</> : '💾 Simpan Seluruh Pengaturan ➜'}
          </button>
        </div>

      </form>
    </div>
  );
}
