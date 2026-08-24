'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';

const MAX_BANKS = 5;
const EMPTY_BANK = { bank_name: '', account_number: '', account_holder: '' };

const INPUT_CLS = 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';
const LABEL_CLS = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';

export default function SettingsPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [serverKey, setServerKey] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [showServerKey, setShowServerKey] = useState(false);
  const [showClientKey, setShowClientKey] = useState(false);
  const [userTier, setUserTier] = useState('free');
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState(null);
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
        setBanks(Array.isArray(d.bank_accounts) && d.bank_accounts.length > 0 ? d.bank_accounts : []);
      })
      .catch(() => Swal.fire({ icon: 'error', title: 'Gagal memuat pengaturan', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } }))
      .finally(() => setLoading(false));
  }, []);

  const handleUpgradeToPro = async () => {
    try {
      Swal.fire({ title: 'Menyiapkan Pembayaran...', text: 'Membuka Midtrans Snap langganan Paket Pro...', allowOutsideClick: false, didOpen: () => Swal.showLoading(), customClass: { popup: 'swal-custom-popup' } });
      const res = await api.post('/api/subscriptions/create-snap');
      Swal.close();
      if (res.data?.redirect_url) window.location.href = res.data.redirect_url;
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Memproses Upgrade', text: err.response?.data?.message || 'Terjadi kesalahan saat memproses langganan Pro.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
    }
  };

  const handleLogoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({ icon: 'warning', title: 'Ukuran File Terlalu Besar', text: 'Maksimal ukuran logo adalah 5MB.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
      return;
    }
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const res = await api.post('/api/settings/logo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setLogoUrl(res.data.logo_url);
      Swal.fire({ icon: 'success', title: 'Logo Berhasil Diunggah!', text: 'Logo usaha Anda akan langsung tampil di seluruh invoice PDF dan portal pembayaran.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Mengunggah Logo', text: err.response?.data?.message || 'Terjadi kesalahan saat mengunggah file.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
    } finally { setUploadingLogo(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const handleDeleteLogo = async () => {
    const confirm = await Swal.fire({ title: 'Hapus Logo Bisnis?', text: 'Logo yang dihapus tidak akan ditampilkan lagi pada faktur PDF.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Ya, Hapus Logo', cancelButtonText: t('common.cancel'), confirmButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8', customClass: { popup: 'swal-custom-popup' } });
    if (confirm.isConfirmed) {
      setUploadingLogo(true);
      try { await api.delete('/api/settings/logo'); setLogoUrl(''); Swal.fire({ icon: 'success', title: 'Logo Dihapus', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } }); }
      catch (err) { Swal.fire({ icon: 'error', title: 'Gagal Menghapus Logo', text: err.response?.data?.message || 'Terjadi kesalahan.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } }); }
      finally { setUploadingLogo(false); }
    }
  };

  const addBank = () => { if (banks.length < MAX_BANKS) setBanks((prev) => [...prev, { ...EMPTY_BANK }]); };
  const removeBank = (idx) => setBanks((prev) => prev.filter((_, i) => i !== idx));
  const updateBank = (idx, field, value) => setBanks((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) {
      Swal.fire({ icon: 'warning', title: 'Nama Bisnis Diperlukan', text: 'Harap isi nama bisnis atau brand Anda.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
      return;
    }
    const validBanks = banks.filter((b) => b.bank_name.trim() || b.account_number.trim() || b.account_holder.trim());
    for (const b of validBanks) {
      if (!b.bank_name.trim() || !b.account_number.trim()) {
        Swal.fire({ icon: 'warning', title: 'Data Rekening Belum Lengkap', text: 'Nama bank dan nomor rekening wajib diisi untuk setiap rekening aktif.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
        return;
      }
    }
    setSaving(true);
    try {
      await api.put('/api/settings', { business_name: businessName, email, phone, address, midtrans_server_key: isPro ? serverKey : undefined, midtrans_client_key: isPro ? clientKey : undefined, bank_accounts: validBanks });
      Swal.fire({ icon: 'success', title: 'Pengaturan Tersimpan! ✨', text: 'Semua perubahan data bisnis dan rekening bank berhasil diperbarui.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Menyimpan', text: err.response?.data?.message || 'Terjadi kesalahan saat menyimpan pengaturan.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-16">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{t('settings.title')}</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{t('settings.desc')}</p>
      </div>

      <form onSubmit={handleSave} className="flex flex-col gap-6">

        {/* ── Top Row: 2 columns on desktop ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

          {/* ── 1. Identitas Brand & Logo ── */}
          <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-sm p-5 sm:p-6 h-full">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2 mb-1">
              <span>🏢</span> 1. {t('settings.tab_profile')}
            </h2>
            <p className="text-xs text-slate-500 mb-5">{t('settings.logo_label')}</p>

            {/* Logo Uploader */}
            <div className="flex flex-wrap gap-5 items-center mb-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
              <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-indigo-200 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={logoUrl} alt="Logo Bisnis" className="w-full h-full object-contain p-1.5" />
                ) : (
                  <span className="text-3xl opacity-40">🏢</span>
                )}
              </div>
              <div className="flex-1 min-w-[160px]">
                <h4 className="text-sm font-bold text-slate-900 mb-0.5">{t('settings.logo_label')}</h4>
                <p className="text-xs text-slate-500 mb-3">Format: PNG, JPG, WebP (Maks. 5MB).</p>
                <input type="file" ref={fileInputRef} onChange={handleLogoSelect} accept="image/png,image/jpeg,image/webp" className="hidden" />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition disabled:opacity-60"
                  >
                    {uploadingLogo ? (
                      <><span className="w-3.5 h-3.5 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" /> {t('common.saving')}</>
                    ) : (
                      <>📁 {logoUrl ? 'Ganti Logo' : 'Upload Logo'}</>
                    )}
                  </button>
                  {logoUrl && (
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={handleDeleteLogo}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 text-xs font-bold transition disabled:opacity-60"
                    >
                      🗑️ {t('common.delete')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="business_name" className={LABEL_CLS}>
                  {t('settings.business_name')} <span className="text-rose-500">*</span>
                </label>
                <input id="business_name" type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={INPUT_CLS} placeholder="Contoh: Studio Kreatif Nusantara" required />
              </div>

              <div>
                <label htmlFor="email" className={LABEL_CLS}>{t('auth.email')} <span className="text-rose-500">*</span></label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLS} placeholder="kontak@perusahaan.com" required />
              </div>

              <div>
                <label htmlFor="phone" className={LABEL_CLS}>{t('settings.phone')}</label>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT_CLS} placeholder="081234567890" />
              </div>

              <div>
                <label htmlFor="address" className={LABEL_CLS}>{t('settings.address')}</label>
                <textarea id="address" rows={3} value={address} onChange={(e) => setAddress(e.target.value)} className={`${INPUT_CLS} resize-y`} placeholder="Contoh: Gedung Artha Lantai 5, Jl. Sudirman No. 45, Jakarta Selatan" />
              </div>
            </div>
          </div>

          {/* ── 2. Midtrans BYOK ── */}
          <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-sm p-5 sm:p-6 h-full">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>💳</span> 2. {t('settings.midtrans_title')}
              </h2>
              {isPro ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">👑 PRO ACTIVE</span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200">🔒 {t('subscription.midtrans_inactive')}</span>
              )}
            </div>

            {!isPro ? (
              <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-2xl p-4 mb-4">
                <div className="flex items-start gap-3 flex-1 min-w-[180px]">
                  <span className="text-2xl">🔒</span>
                  <div>
                    <h4 className="text-xs font-extrabold text-amber-900 mb-0.5">{t('subscription.midtrans_inactive')}</h4>
                    <p className="text-xs text-amber-700 leading-relaxed">{t('subscription.midtrans_inactive_desc')}</p>
                  </div>
                </div>
                <button type="button" onClick={handleUpgradeToPro} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition whitespace-nowrap">
                  {t('subscription.btn_upgrade_hero')}
                </button>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mb-4">{t('settings.midtrans_desc')}</p>
            )}

            <div className={`flex flex-col gap-4 ${!isPro ? 'opacity-50 pointer-events-none' : ''}`}>
              <div>
                <label htmlFor="server_key" className={LABEL_CLS}>
                  {t('settings.server_key')} {!isPro && <span className="text-slate-400 normal-case font-normal">(Terkunci)</span>}
                </label>
                <div className="flex gap-2">
                  <input id="server_key" type={showServerKey ? 'text' : 'password'} value={serverKey} disabled={!isPro} onChange={(e) => setServerKey(e.target.value)} className={INPUT_CLS} placeholder={isPro ? 'SB-Mid-server-...' : 'Fitur ini khusus untuk paket Pro'} autoComplete="off" />
                  <button type="button" disabled={!isPro} onClick={() => setShowServerKey((v) => !v)} className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition shrink-0" title={showServerKey ? 'Sembunyikan' : 'Tampilkan'}>
                    {showServerKey ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="client_key" className={LABEL_CLS}>
                  {t('settings.client_key')} {!isPro && <span className="text-slate-400 normal-case font-normal">(Terkunci)</span>}
                </label>
                <div className="flex gap-2">
                  <input id="client_key" type={showClientKey ? 'text' : 'password'} value={clientKey} disabled={!isPro} onChange={(e) => setClientKey(e.target.value)} className={INPUT_CLS} placeholder={isPro ? 'SB-Mid-client-...' : 'Fitur ini khusus untuk paket Pro'} autoComplete="off" />
                  <button type="button" disabled={!isPro} onClick={() => setShowClientKey((v) => !v)} className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition shrink-0" title={showClientKey ? 'Sembunyikan' : 'Tampilkan'}>
                    {showClientKey ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── 3. Bank Accounts (full width) ── */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-sm p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <span>🏦</span> 3. {t('settings.bank_section_title')}
            </h2>
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
              {banks.length} / {MAX_BANKS} Rekening
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-5">{t('settings.bank_section_desc')}</p>

          <div className="flex flex-col gap-3.5">
            {banks.map((bank, idx) => (
              <div key={idx} className="relative bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={LABEL_CLS}>{t('settings.bank_name')} <span className="text-rose-500">*</span></label>
                    <input type="text" value={bank.bank_name} onChange={(e) => updateBank(idx, 'bank_name', e.target.value)} className={INPUT_CLS} placeholder="BCA / Mandiri / BNI" required />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>{t('settings.acc_number')} <span className="text-rose-500">*</span></label>
                    <input type="text" value={bank.account_number} onChange={(e) => updateBank(idx, 'account_number', e.target.value)} className={INPUT_CLS} placeholder="1234567890" required />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>{t('settings.acc_holder')}</label>
                    <input type="text" value={bank.account_holder} onChange={(e) => updateBank(idx, 'account_holder', e.target.value)} className={INPUT_CLS} placeholder="Nama pemilik rekening" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeBank(idx)}
                  className="absolute top-3.5 right-3.5 w-7 h-7 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center justify-center transition"
                  title="Hapus rekening ini"
                >
                  ✕
                </button>
              </div>
            ))}

            {banks.length < MAX_BANKS && (
              <button
                type="button"
                onClick={addBank}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/30 text-slate-600 hover:text-indigo-700 text-sm font-bold transition flex items-center justify-center gap-2"
              >
                + {t('settings.btn_add_bank')} ({banks.length}/{MAX_BANKS})
              </button>
            )}
          </div>
        </div>

        {/* ── Submit ── */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-extrabold shadow-md shadow-indigo-500/25 transition-all disabled:opacity-60"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> {t('common.saving')}</>
            ) : (
              `💾 ${t('settings.btn_save_profile')} ➜`
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
