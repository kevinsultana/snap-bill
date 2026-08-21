'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Swal from 'sweetalert2';

const MAX_BANKS = 5;
const EMPTY_BANK = { bank_name: '', account_number: '', account_holder: '' };

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Midtrans
  const [serverKey, setServerKey] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [showServerKey, setShowServerKey] = useState(false);
  const [showClientKey, setShowClientKey] = useState(false);

  // Business
  const [businessName, setBusinessName] = useState('');

  // Bank accounts
  const [banks, setBanks] = useState([]);

  useEffect(() => {
    api.get('/api/settings')
      .then((res) => {
        const d = res.data;
        setBusinessName(d.business_name || '');
        setServerKey(d.midtrans_server_key || '');
        setClientKey(d.midtrans_client_key || '');
        setBanks(Array.isArray(d.bank_accounts) && d.bank_accounts.length > 0
          ? d.bank_accounts
          : []);
      })
      .catch(() => {
        Swal.fire({ icon: 'error', title: 'Gagal memuat pengaturan', confirmButtonColor: '#6366f1' });
      })
      .finally(() => setLoading(false));
  }, []);

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

  // --- Save ---
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
        midtrans_server_key: serverKey,
        midtrans_client_key: clientKey,
        bank_accounts: banks,
      });
      Swal.fire({
        icon: 'success',
        title: 'Pengaturan tersimpan!',
        text: 'Profil bisnis dan metode pembayaran berhasil diperbarui.',
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: 'swal-custom-popup' },
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan pengaturan.';
      Swal.fire({
        icon: 'error',
        title: 'Gagal',
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
          <p className="page-desc">Kelola profil identitas bisnis, API Midtrans (BYOK), dan rekening bank transfer.</p>
        </div>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 840 }}>

        {/* 1. Profil Bisnis */}
        <div className="glass-card" style={{ padding: 26 }}>
          <h2 className="section-title">
            <span className="section-icon">🏢</span> 1. Identitas Brand / Bisnis
          </h2>
          <div className="form-group">
            <label htmlFor="business_name" className="form-label">Nama Bisnis / Brand</label>
            <input
              id="business_name"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="form-input"
              placeholder="Contoh: Studio Kreatif Nusantara"
            />
            <p className="form-hint">Nama ini akan tercantum di bagian atas faktur invoice PDF dan portal pembayaran klien.</p>
          </div>
        </div>

        {/* 2. Midtrans BYOK */}
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

        {/* 3. Bank Accounts */}
        <div className="glass-card" style={{ padding: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              <span className="section-icon">🏦</span> 3. Rekening Bank Transfer Manual
            </h2>
            <span className="glass-pill" style={{ color: 'var(--text-secondary)' }}>
              {banks.length} / {MAX_BANKS} Rekening
            </span>
          </div>
          <p className="form-hint" style={{ marginBottom: 18 }}>
            Rekening ini akan ditampilkan kepada klien sebagai pilihan transfer langsung dengan fasilitas upload bukti transfer.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {banks.map((bank, idx) => (
              <div key={idx} style={{ background: 'rgba(248, 250, 252, 0.8)', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Nama Bank</label>
                    <input
                      type="text"
                      value={bank.bank_name}
                      onChange={(e) => updateBank(idx, 'bank_name', e.target.value)}
                      className="form-input"
                      placeholder="BCA / Mandiri / BNI"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nomor Rekening</label>
                    <input
                      type="text"
                      value={bank.account_number}
                      onChange={(e) => updateBank(idx, 'account_number', e.target.value)}
                      className="form-input"
                      placeholder="Contoh: 1234567890"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Atas Nama Pemilik</label>
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
                  className="btn-remove-line"
                  style={{ position: 'absolute', top: 12, right: 12 }}
                  title="Hapus rekening ini"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addBank}
            disabled={banks.length >= MAX_BANKS}
            className="btn-add-line"
            style={{ marginTop: 14 }}
          >
            + Tambah Rekening Bank ({banks.length}/{MAX_BANKS})
          </button>
        </div>

        {/* Submit Action */}
        <div>
          <button type="submit" disabled={saving} className="btn-primary" style={{ padding: '14px 28px', fontSize: 15 }}>
            {saving ? (
              <>
                <span className="btn-spinner" /> Menyimpan Pengaturan...
              </>
            ) : (
              '💾 Simpan Seluruh Pengaturan'
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
