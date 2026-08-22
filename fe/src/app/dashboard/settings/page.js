'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';

const MAX_BANKS = 5;
const EMPTY_BANK = { bank_name: '', account_number: '', account_holder: '' };

export default function SettingsPage() {
  const { t } = useTranslation();
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
  const [userTier, setUserTier] = useState('free');
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState(null);

  // Bank accounts
  const [banks, setBanks] = useState([]);

  const fileInputRef = useRef(null);

  const isPro = userTier === 'pro' && (!subscriptionEndsAt || new Date(subscriptionEndsAt) > new Date());

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
        setUserTier(d.tier || 'free');
        setSubscriptionEndsAt(d.subscription_ends_at || null);
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

  // Handle Instant Upgrade to Pro via Midtrans Snap
  const handleUpgradeToPro = async () => {
    try {
      Swal.fire({
        title: 'Menyiapkan Pembayaran...',
        text: 'Membuka Midtrans Snap langganan Paket Pro...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
        customClass: { popup: 'swal-custom-popup' },
      });

      const res = await api.post('/api/subscriptions/create-snap');
      Swal.close();

      if (res.data?.redirect_url) {
        window.location.href = res.data.redirect_url;
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memproses Upgrade',
        text: err.response?.data?.message || 'Terjadi kesalahan saat memproses langganan Pro.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    }
  };

  // --- Logo Upload Handler ---
  const handleLogoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validasi ukuran file (maks 5MB)
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'Ukuran File Terlalu Besar',
        text: 'Maksimal ukuran logo adalah 5MB.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      return;
    }

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await api.post('/api/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setLogoUrl(res.data.logo_url);
      Swal.fire({
        icon: 'success',
        title: 'Logo Berhasil Diunggah!',
        text: 'Logo usaha Anda akan langsung tampil di seluruh invoice PDF dan portal pembayaran.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mengunggah Logo',
        text: err.response?.data?.message || 'Terjadi kesalahan saat mengunggah file ke MinIO Storage.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    const confirm = await Swal.fire({
      title: 'Hapus Logo Bisnis?',
      text: 'Logo yang dihapus tidak akan ditampilkan lagi pada faktur PDF dan portal klien.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus Logo',
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
    });

    if (confirm.isConfirmed) {
      setUploadingLogo(true);
      try {
        await api.delete('/api/settings/logo');
        setLogoUrl('');
        Swal.fire({
          icon: 'success',
          title: 'Logo Dihapus',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Menghapus Logo',
          text: err.response?.data?.message || 'Terjadi kesalahan saat menghapus logo.',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
      } finally {
        setUploadingLogo(false);
      }
    }
  };

  // --- Bank Account Handlers ---
  const addBank = () => {
    if (banks.length >= MAX_BANKS) return;
    setBanks((prev) => [...prev, { ...EMPTY_BANK }]);
  };

  const removeBank = (idx) => {
    setBanks((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateBank = (idx, field, value) => {
    setBanks((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  };

  // --- Submit Settings ---
  const handleSave = async (e) => {
    e.preventDefault();

    if (!businessName.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Nama Bisnis Diperlukan',
        text: 'Harap isi nama bisnis atau brand Anda.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      return;
    }

    // Validasi rekening bank yang tidak lengkap
    const validBanks = banks.filter((b) => b.bank_name.trim() || b.account_number.trim() || b.account_holder.trim());
    for (const b of validBanks) {
      if (!b.bank_name.trim() || !b.account_number.trim()) {
        Swal.fire({
          icon: 'warning',
          title: 'Data Rekening Belum Lengkap',
          text: 'Nama bank dan nomor rekening wajib diisi untuk setiap rekening aktif.',
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
        email,
        phone,
        address,
        midtrans_server_key: isPro ? serverKey : undefined,
        midtrans_client_key: isPro ? clientKey : undefined,
        bank_accounts: validBanks,
      });

      Swal.fire({
        icon: 'success',
        title: 'Pengaturan Tersimpan! ✨',
        text: 'Semua perubahan data bisnis dan rekening bank berhasil diperbarui.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menyimpan',
        text: err.response?.data?.message || 'Terjadi kesalahan saat menyimpan pengaturan.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-desc">{t('settings.desc')}</p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 880 }}>

        {/* ── 1. Identitas Brand & Logo ─────────────────────────────── */}
        <div className="glass-card" style={{ padding: 26 }}>
          <h2 className="section-title">
            <span className="section-icon">🏢</span> 1. {t('settings.tab_profile')}
          </h2>
          <p className="form-hint" style={{ marginBottom: 20 }}>
            {t('settings.logo_label')}
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
                {t('settings.logo_label')}
              </h4>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--text-muted)' }}>
                Format: PNG, JPG, WebP (Maks. 5MB).
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
                      <span className="btn-spinner" style={{ borderColor: 'rgba(99, 102, 241, 0.3)', borderTopColor: 'var(--indigo)' }} /> {t('common.saving')}
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
                    🗑️ {t('common.delete')}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields: Business Name, Email, Phone, Address */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label htmlFor="business_name" className="form-label">
                {t('settings.business_name')} <span className="req">*</span>
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
                  {t('auth.email')} <span className="req">*</span>
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
                  {t('settings.phone')}
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
                {t('settings.address')}
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
            </div>
          </div>
        </div>

        {/* ── 2. Midtrans BYOK ──────────────────────────────────────── */}
        <div className="glass-card" style={{ padding: 26, position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              <span className="section-icon">💳</span> 2. {t('settings.midtrans_title')}
            </h2>
            {isPro ? (
              <span className="status-badge badge-emerald" style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px' }}>
                👑 PRO ACTIVE
              </span>
            ) : (
              <span className="status-badge badge-amber" style={{ fontSize: 11, fontWeight: 800, padding: '4px 10px' }}>
                🔒 {t('subscription.midtrans_inactive')}
              </span>
            )}
          </div>

          {!isPro ? (
            <div style={{ background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.75), rgba(254, 249, 195, 0.75))', border: '1px solid #fde047', borderRadius: 14, padding: '16px 18px', margin: '14px 0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 240 }}>
                <span style={{ fontSize: 26 }}>🔒</span>
                <div>
                  <h4 style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 800, color: '#854d0e' }}>
                    {t('subscription.midtrans_inactive')}
                  </h4>
                  <p style={{ margin: 0, fontSize: 12, color: '#a16207', lineHeight: 1.5 }}>
                    {t('subscription.midtrans_inactive_desc')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleUpgradeToPro}
                className="btn-primary"
                style={{ padding: '9px 18px', fontSize: 13, whiteSpace: 'nowrap' }}
              >
                {t('subscription.btn_upgrade_hero')}
              </button>
            </div>
          ) : (
            <p className="form-hint" style={{ marginBottom: 18 }}>
              {t('settings.midtrans_desc')}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: isPro ? 1 : 0.5, pointerEvents: isPro ? 'auto' : 'none' }}>
            <div className="form-group">
              <label htmlFor="server_key" className="form-label">
                {t('settings.server_key')} {!isPro && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(Terkunci)</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="server_key"
                  type={showServerKey ? 'text' : 'password'}
                  value={serverKey}
                  disabled={!isPro}
                  onChange={(e) => setServerKey(e.target.value)}
                  className="form-input"
                  placeholder={isPro ? "SB-Mid-server-..." : "Fitur ini khusus untuk paket Pro"}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!isPro}
                  onClick={() => setShowServerKey((v) => !v)}
                  title={showServerKey ? 'Sembunyikan' : 'Tampilkan'}
                  style={{ padding: '0 14px' }}
                >
                  {showServerKey ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="client_key" className="form-label">
                {t('settings.client_key')} {!isPro && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(Terkunci)</span>}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="client_key"
                  type={showClientKey ? 'text' : 'password'}
                  value={clientKey}
                  disabled={!isPro}
                  onChange={(e) => setClientKey(e.target.value)}
                  className="form-input"
                  placeholder={isPro ? "SB-Mid-client-..." : "Fitur ini khusus untuk paket Pro"}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!isPro}
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
              <span className="section-icon">🏦</span> 3. {t('settings.bank_section_title')}
            </h2>
            <span className="glass-pill" style={{ color: 'var(--text-secondary)' }}>
              {banks.length} / {MAX_BANKS} Rekening
            </span>
          </div>
          <p className="form-hint" style={{ marginBottom: 18 }}>
            {t('settings.bank_section_desc')}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {banks.map((bank, idx) => (
              <div key={idx} style={{ background: 'rgba(248, 250, 252, 0.8)', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 48px 18px 18px', position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">{t('settings.bank_name')} <span className="req">*</span></label>
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
                    <label className="form-label">{t('settings.acc_number')} <span className="req">*</span></label>
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
                    <label className="form-label">{t('settings.acc_holder')}</label>
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
                {t('settings.btn_add_bank')} ({banks.length}/{MAX_BANKS})
              </button>
            )}
          </div>
        </div>

        {/* ── Submit Button ────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '14px 32px', fontSize: 15 }}>
            {saving ? <><span className="btn-spinner" /> {t('common.saving')}</> : `💾 ${t('settings.btn_save_profile')} ➜`}
          </button>
        </div>

      </form>
    </div>
  );
}
