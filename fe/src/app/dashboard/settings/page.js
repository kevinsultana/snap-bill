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
        Swal.fire({ icon: 'warning', title: 'Data rekening tidak lengkap', text: 'Nama bank dan nomor rekening wajib diisi.', confirmButtonColor: '#6366f1' });
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
      Swal.fire({ icon: 'success', title: 'Pengaturan tersimpan!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, timerProgressBar: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan pengaturan.';
      Swal.fire({ icon: 'error', title: 'Gagal', text: msg, confirmButtonColor: '#6366f1' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner" style={{ margin: '60px auto' }} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Pengaturan</h1>
        <p className="page-desc">Kelola profil bisnis, API Midtrans, dan rekening bank Anda.</p>
      </div>

      <form onSubmit={handleSave} className="settings-form">

        {/* Business Profile */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">🏢</span> Profil Bisnis
          </h2>
          <div className="form-group">
            <label htmlFor="business_name" className="form-label">Nama Bisnis</label>
            <input
              id="business_name"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="form-input"
              placeholder="Contoh: PT. Maju Jaya"
            />
          </div>
        </div>

        {/* Midtrans */}
        <div className="settings-section">
          <h2 className="section-title">
            <span className="section-icon">💳</span> Midtrans API Keys
          </h2>
          <p className="section-desc">
            Gunakan kunci dari dashboard Midtrans Anda. Biarkan kosong jika tidak menggunakan Midtrans.
          </p>

          <div className="form-group">
            <label htmlFor="server_key" className="form-label">Server Key</label>
            <div className="input-with-action">
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
                className="btn-icon"
                onClick={() => setShowServerKey((v) => !v)}
                title={showServerKey ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showServerKey ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="client_key" className="form-label">Client Key</label>
            <div className="input-with-action">
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
                className="btn-icon"
                onClick={() => setShowClientKey((v) => !v)}
                title={showClientKey ? 'Sembunyikan' : 'Tampilkan'}
              >
                {showClientKey ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
        </div>

        {/* Bank Accounts */}
        <div className="settings-section">
          <div className="section-header-row">
            <h2 className="section-title">
              <span className="section-icon">🏦</span> Rekening Bank
            </h2>
            <span className="badge">{banks.length} / {MAX_BANKS}</span>
          </div>
          <p className="section-desc">
            Rekening ini akan ditampilkan ke klien sebagai opsi transfer manual.
          </p>

          <div className="bank-list">
            {banks.map((bank, idx) => (
              <div key={idx} className="bank-row">
                <div className="bank-row-number">{idx + 1}</div>

                <div className="bank-fields">
                  <div className="form-group">
                    <label className="form-label">Nama Bank</label>
                    <input
                      type="text"
                      value={bank.bank_name}
                      onChange={(e) => updateBank(idx, 'bank_name', e.target.value)}
                      className="form-input"
                      placeholder="BCA, BNI, Mandiri..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nomor Rekening</label>
                    <input
                      type="text"
                      value={bank.account_number}
                      onChange={(e) => updateBank(idx, 'account_number', e.target.value)}
                      className="form-input"
                      placeholder="1234567890"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Atas Nama</label>
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
                  className="btn-remove"
                  title="Hapus rekening"
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
            className="btn-add-bank"
          >
            + Tambah Rekening
            {banks.length >= MAX_BANKS && <span className="badge-max"> (Maks. {MAX_BANKS})</span>}
          </button>
        </div>

        {/* Submit */}
        <div className="form-actions">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <span className="btn-spinner" /> : '💾 Simpan Pengaturan'}
          </button>
        </div>

      </form>
    </div>
  );
}
