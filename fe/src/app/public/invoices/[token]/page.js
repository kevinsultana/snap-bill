'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { InvoiceViewSkeleton } from '@/components/Skeleton';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(num || 0));
}

function formatDate(dateStr, lang = 'id') {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function PublicInvoicePage() {
  const { token } = useParams();
  const searchParams = useSearchParams();
  const txStatus = searchParams?.get('transaction_status');
  const statusCode = searchParams?.get('status_code');
  const orderId = searchParams?.get('order_id');
  const { t, lang } = useTranslation();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [checkingStatus, setCheckingStatus] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [payingSnap, setPayingSnap] = useState(false);

  const STATUS_MAP = {
    draft:                { label: t('invoices.status_draft'),                badgeClass: 'badge-gray',    desc: 'Invoice ini masih dalam bentuk draf tagihan.' },
    unpaid:               { label: t('invoices.status_unpaid'),               badgeClass: 'badge-amber',   desc: 'Silakan lakukan pembayaran sesuai rincian total di bawah ini.' },
    pending_verification: { label: t('invoices.status_pending_verification'), badgeClass: 'badge-blue',    desc: 'Bukti transfer Anda telah diterima dan sedang diverifikasi oleh pihak pemilik usaha.' },
    paid:                 { label: t('invoices.status_paid'),                 badgeClass: 'badge-emerald', desc: 'Pembayaran telah berhasil diverifikasi dan lunas. Terima kasih atas kerja sama Anda!' },
    overdue:              { label: t('invoices.status_overdue'),              badgeClass: 'badge-red',     desc: 'Tagihan telah melewati batas waktu tanggal jatuh tempo.' },
  };

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/public/invoices/${token}`);
      setInvoice(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invoice tidak ditemukan atau tautan pembayaran tidak valid.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Cek status pembayaran ke server & Midtrans Core API
  const handleCheckPaymentStatus = useCallback(async (showToast = true) => {
    setCheckingStatus(true);
    try {
      const res = await axios.post(`${API_URL}/api/public/invoices/${token}/check-status`, {
        order_id: orderId || undefined,
      });

      if (res.data?.invoice) {
        setInvoice(res.data.invoice);
      }

      if (res.data?.status === 'paid') {
        Swal.fire({
          icon: 'success',
          title: '🎉 Pembayaran Berhasil Terverifikasi!',
          text: 'Terima kasih, tagihan invoice Anda telah lunas.',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
      } else if (showToast) {
        Swal.fire({
          icon: 'info',
          title: 'Status Pembayaran',
          text: 'Transaksi masih dalam proses atau menunggu pembayaran.',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
      }
    } catch (err) {
      if (showToast) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Memeriksa Status',
          text: err.response?.data?.message || 'Terjadi kesalahan saat memeriksa status.',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
      }
    } finally {
      setCheckingStatus(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  useEffect(() => {
    if (orderId || txStatus) {
      handleCheckPaymentStatus(false);
    }
  }, [orderId, txStatus, handleCheckPaymentStatus]);

  const handleCopyAccount = (accNumber, idx) => {
    navigator.clipboard.writeText(accNumber);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: 'warning',
        title: 'Ukuran File Terlalu Besar',
        text: 'Ukuran maksimal bukti transfer adalah 5MB.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviewUrl(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUploadReceipt = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('receipt', selectedFile);

    try {
      await axios.post(`${API_URL}/api/public/invoices/${token}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await Swal.fire({
        icon: 'success',
        title: 'Bukti Transfer Terkirim! 🎉',
        text: 'Bukti pembayaran Anda berhasil diunggah dan akan segera diverifikasi oleh pemilik usaha.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });

      setSelectedFile(null);
      setPreviewUrl(null);
      fetchInvoice();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mengunggah',
        text: err.response?.data?.message || 'Terjadi kesalahan saat mengunggah bukti pembayaran.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePaySnap = async () => {
    if (invoice?.payment_url) {
      window.location.href = invoice.payment_url;
      return;
    }

    setPayingSnap(true);
    try {
      const res = await axios.post(`${API_URL}/api/public/invoices/${token}/pay`);
      if (res.data?.payment_url) {
        window.location.href = res.data.payment_url;
      } else {
        fetchInvoice();
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Membuka Pembayaran Online',
        text: err.response?.data?.message || 'Tidak dapat membuat sesi pembayaran Midtrans.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    } finally {
      setPayingSnap(false);
    }
  };

  if (loading) {
    return (
      <div className="pay-portal-container" style={{ width: '100%', maxWidth: 1100, margin: '40px auto', padding: '0 16px' }}>
        <InvoiceViewSkeleton />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="page-container" style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center', padding: '0 16px' }}>
        <div className="glass-card" style={{ padding: 40 }}>
          <span style={{ fontSize: 48 }}>⚠️</span>
          <h2 style={{ margin: '14px 0 8px', color: 'var(--text-main)' }}>Invoice Tidak Ditemukan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            {error || 'Tautan pembayaran ini tidak valid atau tagihan telah dihapus.'}
          </p>
        </div>
      </div>
    );
  }

  const user = invoice.user || {};
  const client = invoice.client || {};
  const items = invoice.items || [];
  const bankAccounts = Array.isArray(user.bank_accounts) ? user.bank_accounts : [];
  const statusInfo = STATUS_MAP[invoice.status] || STATUS_MAP.unpaid;

  return (
    <div className="pay-portal-container" style={{ width: '100%', maxWidth: 1100, margin: '0 auto', padding: '24px 16px 60px', boxSizing: 'border-box' }}>

      {/* ── 1. Custom White-Label Header Card ────────────────────────── */}
      <div
        className="glass-card pay-portal-header-card"
        style={{
          width: '100%',
          maxWidth: '100%',
          boxSizing: 'border-box',
          marginBottom: 20,
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(12px)',
          borderRadius: 20,
          border: '1px solid rgba(226, 232, 240, 0.9)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        }}
      >
        {/* Company Identity & Custom Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {user.logo_url ? (
            <div
              style={{
                height: 52,
                maxHeight: 52,
                maxWidth: 160,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#ffffff',
                padding: '4px 8px',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={user.logo_url}
                alt={user.business_name || 'Logo Perusahaan'}
                style={{ maxHeight: 44, maxWidth: 144, objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div
              className="sidebar-logo"
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                fontSize: 22,
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
              }}
            >
              🏢
            </div>
          )}

          <div>
            <h1 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
              {user.business_name || 'SnapBill Invoice'}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Faktur Tagihan Resmi</span>
              {user.email && <span>• {user.email}</span>}
              {user.phone && <span>• {user.phone}</span>}
            </p>
          </div>
        </div>

        {/* Action Controls & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <LanguageSwitcher size="small" />

          <a
            href={`${API_URL}/api/public/invoices/${token}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 10, fontWeight: 600 }}
            title="Download PDF Faktur Invoice Resmi"
          >
            <span>📄</span>
            <span>{t('common.download_pdf')}</span>
          </a>

          <span className={`status-badge ${statusInfo.badgeClass}`} style={{ fontSize: 13, padding: '8px 16px', borderRadius: 20, fontWeight: 700 }}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* ── Status Banners ─────────────────────────────────────────── */}
      {(txStatus === 'settlement' || txStatus === 'capture' || statusCode === '200') && invoice.status !== 'paid' && (
        <div className="glass-card" style={{ width: '100%', background: 'linear-gradient(135deg, rgba(209, 250, 229, 0.95), rgba(236, 253, 245, 0.95))', border: '1px solid #34d399', padding: '18px 24px', marginBottom: 20, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 32 }}>🎉</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontWeight: 800, color: '#065f46', fontSize: 15 }}>{t('pay_portal.status_success_midtrans_title')}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#047857' }}>
              {t('pay_portal.status_success_midtrans_desc')}
            </p>
          </div>
        </div>
      )}

      {invoice.status === 'paid' && (
        <div className="glass-card" style={{ width: '100%', background: 'linear-gradient(135deg, rgba(209, 250, 229, 0.9), rgba(236, 253, 245, 0.9))', border: '1px solid #6ee7b7', padding: '18px 24px', marginBottom: 20, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 32 }}>🎉</span>
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, color: '#065f46', fontSize: 15 }}>{t('pay_portal.status_paid_title')}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#047857' }}>
              {t('pay_portal.status_paid_desc')}
            </p>
          </div>
        </div>
      )}

      {invoice.status === 'pending_verification' && (
        <div className="glass-card" style={{ width: '100%', background: 'linear-gradient(135deg, rgba(224, 231, 255, 0.9), rgba(243, 232, 255, 0.9))', border: '1px solid #a5b4fc', padding: '18px 24px', marginBottom: 20, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 32 }}>⏳</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0, fontWeight: 800, color: '#312e81', fontSize: 15 }}>{t('pay_portal.status_pending_verif_title')}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#4338ca' }}>
              {t('pay_portal.status_pending_verif_desc')}
            </p>
          </div>
        </div>
      )}

      {/* ── Main Content Grid ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Columns: Invoice Document Overview & Line Items */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Invoice Summary Card */}
          <div className="glass-card p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm">
            <div className="flex flex-wrap justify-between items-start pb-5 border-b border-slate-100 gap-4 mb-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Nomor Faktur</span>
                <p className="text-2xl font-black text-indigo-700 font-mono tracking-tight mt-1">
                  #{invoice.invoice_number}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Pembayaran</span>
                <p className="text-2xl font-black text-emerald-600 font-mono tracking-tight mt-1">
                  {formatRupiah(invoice.total)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Ditagihkan Kepada:</p>
                <p className="font-extrabold text-slate-900 text-base">{client.name || '—'}</p>
                {client.email && <p className="text-xs text-slate-600 mt-1">📧 {client.email}</p>}
                {client.phone && <p className="text-xs text-slate-600 mt-0.5">📞 {client.phone}</p>}
                {client.address && <p className="text-xs text-slate-500 mt-1">📍 {client.address}</p>}
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Penerbit Faktur:</p>
                <p className="font-extrabold text-slate-900 text-base">{user.business_name || 'SnapBill Vendor'}</p>
                {user.email && <p className="text-xs text-slate-600 mt-1">📧 {user.email}</p>}
                {user.phone && <p className="text-xs text-slate-600 mt-0.5">📞 {user.phone}</p>}
                {user.address && <p className="text-xs text-slate-500 mt-1">📍 {user.address}</p>}
              </div>
            </div>

            <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 font-semibold block">Tanggal Diterbitkan:</span>
                <b className="text-slate-800">{formatDate(invoice.issue_date, lang)}</b>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block">Jatuh Tempo:</span>
                <b className={invoice.status === 'overdue' ? 'text-rose-600' : 'text-slate-800'}>
                  {formatDate(invoice.due_date, lang)}
                </b>
              </div>
            </div>
          </div>

          {/* Line Items Table Card */}
          <div className="glass-card p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm">
            <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
              <span>📋</span> Rincian Item & Layanan
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="pb-3 pl-2">Item / Layanan</th>
                    <th className="pb-3 text-center">Qty</th>
                    <th className="pb-3 text-right">Harga Satuan</th>
                    <th className="pb-3 text-right pr-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50/60">
                      <td className="py-3.5 pl-2 font-bold text-slate-900">{item.item_name}</td>
                      <td className="py-3.5 text-center font-semibold text-slate-600 font-mono">
                        {Number(item.quantity || 1)}
                      </td>
                      <td className="py-3.5 text-right font-mono text-slate-600">
                        {formatRupiah(item.unit_price)}
                      </td>
                      <td className="py-3.5 text-right pr-2 font-mono font-bold text-slate-900">
                        {formatRupiah(item.total_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Breakdown (Subtotal, Tax, Discount, Grand Total) */}
            <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
              <div className="w-full sm:w-72 flex flex-col gap-2 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-bold">{formatRupiah(invoice.subtotal)}</span>
                </div>
                {Number(invoice.discount) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Diskon</span>
                    <span className="font-mono font-bold">- {formatRupiah(invoice.discount)}</span>
                  </div>
                )}
                {Number(invoice.tax_rate) > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>Pajak ({invoice.tax_rate}%)</span>
                    <span className="font-mono font-bold">
                      + {formatRupiah(((Number(invoice.subtotal) - Number(invoice.discount || 0)) * Number(invoice.tax_rate)) / 100)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Tagihan</span>
                  <span className="font-mono text-emerald-600 text-lg">{formatRupiah(invoice.total)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Right 1 Column: Payment Instructions & Gateway */}
        <div className="flex flex-col gap-6">

          {/* Online Payment Card (Midtrans BYOK) */}
          {user.has_midtrans && invoice.status !== 'paid' && (
            <div className="glass-card p-6 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-purple-50/90 border border-indigo-200 shadow-sm">
              <h3 className="text-base font-extrabold text-indigo-950 mb-1 flex items-center gap-2">
                <span>⚡</span> Pembayaran Instan Online
              </h3>
              <p className="text-xs text-indigo-700/80 mb-4">
                Bayar instan via QRIS, GoPay, OVO, Virtual Account BCA, Mandiri, BNI, BRI, atau Kartu Kredit.
              </p>

              <button
                type="button"
                onClick={handlePaySnap}
                disabled={payingSnap}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
              >
                {payingSnap ? (
                  <>
                    <span className="btn-spinner" /> Menyiapkan Pembayaran...
                  </>
                ) : (
                  <>
                    <span>💳</span> Bayar Sekarang via Midtrans ➜
                  </>
                )}
              </button>
            </div>
          )}

          {/* Bank Transfer Details */}
          {bankAccounts.length > 0 && (
            <div className="glass-card p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm">
              <h3 className="text-base font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                <span>🏦</span> Transfer Bank Manual
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Kirim pembayaran ke salah satu rekening resmi di bawah ini:
              </p>

              <div className="flex flex-col gap-3">
                {bankAccounts.map((bank, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide">{bank.bank_name}</p>
                      <p className="text-sm font-mono font-extrabold text-slate-900 my-0.5">{bank.account_number}</p>
                      <p className="text-xs text-slate-500">a.n. {bank.account_holder || user.business_name || 'Pemilik Usaha'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(bank.account_number, idx)}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition"
                    >
                      {copiedIndex === idx ? '✓ Tersalin' : '📋 Salin'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Bukti Transfer */}
          {invoice.status !== 'paid' && (
            <div className="glass-card p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm">
              <h3 className="text-base font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                <span>📤</span> Upload Bukti Transfer
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Sudah melakukan transfer manual? Unggah bukti struk transfer agar dapat segera diverifikasi.
              </p>

              <form onSubmit={handleUploadReceipt} className="flex flex-col gap-3">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp, application/pdf"
                  onChange={handleFileChange}
                  className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />

                {previewUrl && (
                  <div className="mt-2 p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Preview Bukti"
                      style={{ maxHeight: 160, margin: '0 auto', objectFit: 'contain', borderRadius: 8 }}
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!selectedFile || uploading}
                  className="w-full mt-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
                >
                  {uploading ? 'Mengunggah Bukti...' : '🚀 Kirim Bukti Transfer'}
                </button>
              </form>
            </div>
          )}

          {/* Receipt View if already verified / pending */}
          {invoice.receipt_url && (
            <div className="glass-card p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <p className="text-xs font-bold text-slate-700 mb-2">Bukti Pembayaran Terlampir:</p>
              <a
                href={invoice.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 font-bold hover:underline inline-flex items-center gap-1"
              >
                <span>🔍</span> Buka Bukti Struk Pembayaran ↗
              </a>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
