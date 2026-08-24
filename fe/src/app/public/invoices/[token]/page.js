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

// Status badge style map (pure Tailwind)
const STATUS_BADGE = {
  draft: 'bg-slate-100 text-slate-700 border border-slate-200',
  unpaid: 'bg-amber-50 text-amber-800 border border-amber-200',
  pending_verification: 'bg-blue-50 text-blue-800 border border-blue-200',
  paid: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  overdue: 'bg-rose-50 text-rose-800 border border-rose-200',
};

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
    draft:                { label: t('invoices.status_draft') },
    unpaid:               { label: t('invoices.status_unpaid') },
    pending_verification: { label: t('invoices.status_pending_verification') },
    paid:                 { label: t('invoices.status_paid') },
    overdue:              { label: t('invoices.status_overdue') },
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

  const handleCheckPaymentStatus = useCallback(async (showToast = true) => {
    setCheckingStatus(true);
    try {
      const res = await axios.post(`${API_URL}/api/public/invoices/${token}/check-status`, {
        order_id: orderId || undefined,
      });
      if (res.data?.invoice) setInvoice(res.data.invoice);
      if (res.data?.status === 'paid') {
        Swal.fire({ icon: 'success', title: '🎉 Pembayaran Berhasil Terverifikasi!', text: 'Terima kasih, tagihan invoice Anda telah lunas.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
      } else if (showToast) {
        Swal.fire({ icon: 'info', title: 'Status Pembayaran', text: 'Transaksi masih dalam proses atau menunggu pembayaran.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
      }
    } catch (err) {
      if (showToast) {
        Swal.fire({ icon: 'error', title: 'Gagal Memeriksa Status', text: err.response?.data?.message || 'Terjadi kesalahan saat memeriksa status.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
      }
    } finally {
      setCheckingStatus(false);
    }
  }, [token, orderId]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);
  useEffect(() => {
    if (orderId || txStatus) handleCheckPaymentStatus(false);
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
      Swal.fire({ icon: 'warning', title: 'Ukuran File Terlalu Besar', text: 'Ukuran maksimal bukti transfer adalah 5MB.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
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
      await axios.post(`${API_URL}/api/public/invoices/${token}/receipt`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await Swal.fire({ icon: 'success', title: 'Bukti Transfer Terkirim! 🎉', text: 'Bukti pembayaran Anda berhasil diunggah dan akan segera diverifikasi oleh pemilik usaha.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
      setSelectedFile(null);
      setPreviewUrl(null);
      fetchInvoice();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Mengunggah', text: err.response?.data?.message || 'Terjadi kesalahan saat mengunggah bukti pembayaran.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
    } finally {
      setUploading(false);
    }
  };

  const handlePaySnap = async () => {
    if (invoice?.payment_url) { window.location.href = invoice.payment_url; return; }
    setPayingSnap(true);
    try {
      const res = await axios.post(`${API_URL}/api/public/invoices/${token}/pay`);
      if (res.data?.payment_url) window.location.href = res.data.payment_url;
      else fetchInvoice();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Gagal Membuka Pembayaran Online', text: err.response?.data?.message || 'Tidak dapat membuat sesi pembayaran Midtrans.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
    } finally {
      setPayingSnap(false);
    }
  };

  // ── Loading State ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 py-10">
        <InvoiceViewSkeleton />
      </div>
    );
  }

  // ── Error State ─────────────────────────────────────────────────────────────
  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-lg p-10 text-center">
          <span className="text-5xl">⚠️</span>
          <h2 className="mt-4 text-xl font-extrabold text-slate-900">Invoice Tidak Ditemukan</h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
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
  const badgeCls = STATUS_BADGE[invoice.status] || STATUS_BADGE.unpaid;

  return (
    // Outer page background
    <div className="min-h-screen bg-slate-50 print:bg-white py-6 sm:py-10 px-4">
      {/* A4-like invoice wrapper — print-optimized */}
      <div className="w-full max-w-4xl mx-auto print:max-w-full">

        {/* ── Top Header Card (hidden on print) ───────────────────────── */}
        <div className="print:hidden mb-5 flex flex-wrap justify-between items-center gap-4 bg-white/90 backdrop-blur-xl border border-slate-200/90 rounded-2xl px-5 py-4 shadow-sm">
          {/* Company Identity */}
          <div className="flex items-center gap-3 flex-wrap">
            {user.logo_url ? (
              <div className="h-12 max-w-[140px] flex items-center justify-center bg-white px-2 py-1 rounded-xl border border-slate-200 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={user.logo_url} alt={user.business_name || 'Logo'} className="max-h-10 max-w-[130px] object-contain" />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white text-xl flex items-center justify-center shadow-md shadow-indigo-500/20">
                🏢
              </div>
            )}
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 leading-tight tracking-tight">
                {user.business_name || 'SnapBill Invoice'}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                <span>Faktur Tagihan Resmi</span>
                {user.email && <span>• {user.email}</span>}
                {user.phone && <span>• {user.phone}</span>}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <LanguageSwitcher size="small" />
            <a
              href={`${API_URL}/api/public/invoices/${token}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-xs"
              title="Download PDF Faktur Invoice Resmi"
            >
              <span>📄</span> {t('common.download_pdf')}
            </a>
            <span className={`px-3.5 py-1.5 rounded-full text-xs font-bold ${badgeCls}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* ── Status Banners (print:hidden) ──────────────────────────── */}
        {(txStatus === 'settlement' || txStatus === 'capture' || statusCode === '200') && invoice.status !== 'paid' && (
          <div className="print:hidden mb-4 flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
            <span className="text-3xl">🎉</span>
            <div>
              <h3 className="text-sm font-extrabold text-emerald-900">{t('pay_portal.status_success_midtrans_title')}</h3>
              <p className="text-xs text-emerald-700 mt-0.5">{t('pay_portal.status_success_midtrans_desc')}</p>
            </div>
          </div>
        )}

        {invoice.status === 'paid' && (
          <div className="print:hidden mb-4 flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
            <span className="text-3xl">🎉</span>
            <div>
              <h3 className="text-sm font-extrabold text-emerald-900">{t('pay_portal.status_paid_title')}</h3>
              <p className="text-xs text-emerald-700 mt-0.5">{t('pay_portal.status_paid_desc')}</p>
            </div>
          </div>
        )}

        {invoice.status === 'pending_verification' && (
          <div className="print:hidden mb-4 flex items-center gap-4 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4">
            <span className="text-3xl">⏳</span>
            <div>
              <h3 className="text-sm font-extrabold text-indigo-900">{t('pay_portal.status_pending_verif_title')}</h3>
              <p className="text-xs text-indigo-700 mt-0.5">{t('pay_portal.status_pending_verif_desc')}</p>
            </div>
          </div>
        )}

        {/* ── Main Document + Right Panel ─────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 print:grid-cols-1">

          {/* ── Left / Main: Invoice Document (2 of 3 columns) ─── */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* Invoice Document Card — styled like A4 paper */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-md print:shadow-none print:rounded-none print:border-0 p-6 sm:p-8 print:p-0 flex flex-col gap-6">

              {/* Document Header (visible on print) */}
              <div className="hidden print:flex items-center gap-4 pb-6 border-b border-slate-200">
                {user.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.logo_url} alt={user.business_name || 'Logo'} className="max-h-12 max-w-[140px] object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white text-xl flex items-center justify-center">🏢</div>
                )}
                <div>
                  <h1 className="text-lg font-extrabold text-slate-900">{user.business_name || 'SnapBill Invoice'}</h1>
                  <p className="text-xs text-slate-500">{user.email} {user.phone && `• ${user.phone}`}</p>
                </div>
              </div>

              {/* Invoice Number & Total */}
              <div className="flex flex-wrap justify-between items-start gap-4 pb-5 border-b border-slate-100">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Nomor Faktur</span>
                  <p className="text-2xl font-black text-indigo-700 font-mono tracking-tight mt-1">
                    #{invoice.invoice_number}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Total Pembayaran</span>
                  <p className="text-2xl font-black text-emerald-600 font-mono tracking-tight mt-1">
                    {formatRupiah(invoice.total)}
                  </p>
                </div>
              </div>

              {/* Billing Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">Ditagihkan Kepada:</p>
                  <p className="font-extrabold text-slate-900 text-sm">{client.name || '—'}</p>
                  {client.email && <p className="text-xs text-slate-500 mt-1">📧 {client.email}</p>}
                  {client.phone && <p className="text-xs text-slate-500 mt-0.5">📞 {client.phone}</p>}
                  {client.address && <p className="text-xs text-slate-400 mt-1">📍 {client.address}</p>}
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">Penerbit Faktur:</p>
                  <p className="font-extrabold text-slate-900 text-sm">{user.business_name || 'SnapBill Vendor'}</p>
                  {user.email && <p className="text-xs text-slate-500 mt-1">📧 {user.email}</p>}
                  {user.phone && <p className="text-xs text-slate-500 mt-0.5">📞 {user.phone}</p>}
                  {user.address && <p className="text-xs text-slate-400 mt-1">📍 {user.address}</p>}
                </div>
              </div>

              {/* Dates */}
              <div className="flex flex-wrap gap-6 pt-4 border-t border-slate-100 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 font-semibold block mb-0.5">Tanggal Diterbitkan:</span>
                  <b className="text-slate-800">{formatDate(invoice.issue_date, lang)}</b>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block mb-0.5">Jatuh Tempo:</span>
                  <b className={invoice.status === 'overdue' ? 'text-rose-600' : 'text-slate-800'}>
                    {formatDate(invoice.due_date, lang)}
                  </b>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 mb-3 flex items-center gap-2">
                  <span>📋</span> Rincian Item &amp; Layanan
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse min-w-[440px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="py-2.5 px-3">Item / Layanan</th>
                        <th className="py-2.5 px-2 text-center">Qty</th>
                        <th className="py-2.5 px-2 text-right">Harga</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-50/60">
                          <td className="py-3 px-3 font-semibold text-slate-900">{item.item_name}</td>
                          <td className="py-3 px-2 text-center font-mono text-slate-600">{Number(item.quantity || 1)}</td>
                          <td className="py-3 px-2 text-right font-mono text-slate-600">{formatRupiah(item.unit_price)}</td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(item.total_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end border-t border-slate-100 pt-4">
                <div className="w-full sm:w-64 flex flex-col gap-1.5 text-xs">
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
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                    <span>Total Tagihan</span>
                    <span className="font-mono text-emerald-600 text-base">{formatRupiah(invoice.total)}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── Right: Payment Panel (print:hidden) ─────────────────── */}
          <div className="print:hidden flex flex-col gap-5">

            {/* Online Payment (Midtrans) */}
            {user.has_midtrans && invoice.status !== 'paid' && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-indigo-950 mb-1 flex items-center gap-2">
                  <span>⚡</span> Pembayaran Instan Online
                </h3>
                <p className="text-xs text-indigo-700/80 mb-4">
                  Bayar instan via QRIS, GoPay, OVO, Virtual Account BCA, Mandiri, BNI, BRI, atau Kartu Kredit.
                </p>
                <button
                  type="button"
                  onClick={handlePaySnap}
                  disabled={payingSnap}
                  className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {payingSnap ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Menyiapkan...</>
                  ) : (
                    <><span>💳</span> Bayar Sekarang via Midtrans ➜</>
                  )}
                </button>
              </div>
            )}

            {/* Bank Transfer Accounts */}
            {bankAccounts.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center gap-2">
                  <span>🏦</span> Transfer Bank Manual
                </h3>
                <p className="text-xs text-slate-500 mb-4">Kirim pembayaran ke salah satu rekening resmi di bawah ini:</p>
                <div className="flex flex-col gap-2.5">
                  {bankAccounts.map((bank, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div>
                        <p className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wide">{bank.bank_name}</p>
                        <p className="text-sm font-mono font-extrabold text-slate-900 my-0.5">{bank.account_number}</p>
                        <p className="text-xs text-slate-500">a.n. {bank.account_holder || user.business_name || 'Pemilik Usaha'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyAccount(bank.account_number, idx)}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition whitespace-nowrap"
                      >
                        {copiedIndex === idx ? '✓ Tersalin' : '📋 Salin'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Transfer Proof */}
            {invoice.status !== 'paid' && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-extrabold text-slate-900 mb-1 flex items-center gap-2">
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
                    <div className="mt-1 p-2 bg-slate-50 rounded-xl border border-slate-200 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Preview Bukti" className="max-h-40 mx-auto object-contain rounded-lg" />
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={!selectedFile || uploading}
                    className="w-full mt-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
                  >
                    {uploading ? 'Mengunggah Bukti...' : '🚀 Kirim Bukti Transfer'}
                  </button>
                </form>
              </div>
            )}

            {/* Receipt link */}
            {invoice.receipt_url && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
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
    </div>
  );
}
