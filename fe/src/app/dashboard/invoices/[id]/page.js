'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';

function formatRupiah(v) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(v || 0));
}

function formatDate(d, lang = 'id') {
  if (!d) return '—';
  return new Date(d).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t, lang } = useTranslation();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [userSettings, setUserSettings] = useState(null);

  const STATUS_CONFIG = {
    draft:                { label: t('invoices.status_draft'),                color: 'bg-slate-100 text-slate-700 border border-slate-200' },
    unpaid:               { label: t('invoices.status_unpaid'),               color: 'bg-amber-50 text-amber-800 border border-amber-200' },
    pending_verification: { label: t('invoices.status_pending_verification'), color: 'bg-blue-50 text-blue-800 border border-blue-200' },
    paid:                 { label: t('invoices.status_paid'),                 color: 'bg-emerald-50 text-emerald-800 border border-emerald-200' },
    overdue:              { label: t('invoices.status_overdue'),              color: 'bg-rose-50 text-rose-800 border border-rose-200' },
    cancelled:            { label: t('invoices.status_cancelled'),            color: 'bg-slate-100 text-slate-600 border border-slate-200' },
  };

  const fetchInvoice = () => {
    return api.get(`/api/invoices/${id}`)
      .then((r) => setInvoice(r.data))
      .catch(() => toast('error', 'Invoice tidak ditemukan'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoice();
    api.get('/api/settings').then((r) => setUserSettings(r.data)).catch(() => {});
  }, [id]);

  const isPro = userSettings?.tier === 'pro' && (!userSettings?.subscription_ends_at || new Date(userSettings.subscription_ends_at) > new Date());

  // Download / Generate PDF
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const response = await api.get(`/api/invoices/${id}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const fileUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = fileUrl;
      link.setAttribute('download', `Invoice-${invoice.invoice_number}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(fileUrl);
      toast('success', 'PDF Invoice berhasil diunduh!');
    } catch {
      toast('error', 'Gagal men-generate file PDF invoice.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Resend Email to client
  const handleResendEmail = async () => {
    if (!invoice?.client?.email) {
      Swal.fire({
        icon: 'warning',
        title: 'Email',
        text: 'Klien ini tidak memiliki alamat email yang terdaftar pada sistem.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Kirim Ulang Email Tagihan?',
      html: `
        <div style="text-align: left; font-family: 'Plus Jakarta Sans', sans-serif;">
          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 12px;">
            Email tagihan untuk Invoice <b style="color: #0f172a;">#${invoice.invoice_number}</b> akan dikirimkan ulang ke:
          </p>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px;">
            <p style="margin: 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b;">Penerima Email</p>
            <p style="margin: 2px 0 0; font-size: 14px; font-weight: 800; color: #4f46e5;">${invoice.client.name} &lt;${invoice.client.email}&gt;</p>
          </div>
          <p style="color: #64748b; font-size: 12px; margin: 0;">
            Email akan berisi rincian tagihan, link portal pembayaran publik, dan lampiran file <b>PDF Invoice</b> resmi.
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '📧 Ya, Kirim Ulang',
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          const res = await api.post(`/api/invoices/${id}/resend-email`);
          return res.data;
        } catch (err) {
          Swal.showValidationMessage(
            err.response?.data?.message || 'Gagal mengirim ulang email invoice.'
          );
          return false;
        }
      },
    });

    if (result.isConfirmed && result.value) {
      await Swal.fire({
        icon: 'success',
        title: 'Email Berhasil Terkirim! 🎉',
        html: `
          <p style="color: #475569; font-size: 14px; margin: 0 0 8px;">
            ${result.value.message || 'Email tagihan invoice telah berhasil dikirimkan ke klien.'}
          </p>
          ${result.value.provider ? `<p style="font-size: 12px; color: #10b981; font-weight: 700; margin: 0;">Status: Terkirim via ${result.value.provider}</p>` : ''}
        `,
        confirmButtonText: 'Selesai',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    }
  };

  // Batalkan Invoice
  const handleCancelInvoice = async () => {
    const result = await Swal.fire({
      title: 'Batalkan Invoice ini?',
      html: `
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
          Invoice <b style="color: #0f172a;">#${invoice.invoice_number}</b> akan ditandai sebagai <b>Dibatalkan</b> dan sesi pembayaran Midtrans akan dinonaktifkan.
        </p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🚫 Ya, Batalkan Invoice',
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          const res = await api.post(`/api/invoices/${id}/cancel`);
          return res.data;
        } catch (err) {
          Swal.showValidationMessage(err.response?.data?.message || 'Gagal membatalkan invoice.');
          return false;
        }
      },
    });

    if (result.isConfirmed) {
      toast('info', `Invoice #${invoice.invoice_number} berhasil dibatalkan.`);
      fetchInvoice();
    }
  };

  // Ajukan Ulang / Buat Ulang Sesi Midtrans
  const handleRefreshMidtrans = async () => {
    const result = await Swal.fire({
      title: 'Ajukan Ulang ke Midtrans?',
      html: `
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
          Sistem akan membuat transaksi Midtrans baru secara otomatis dari backend untuk Invoice <b style="color: #0f172a;">#${invoice.invoice_number}</b>.
        </p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🔄 Ya, Buat Sesi Baru',
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          const res = await api.post(`/api/invoices/${id}/refresh-midtrans`);
          return res.data;
        } catch (err) {
          Swal.showValidationMessage(err.response?.data?.message || 'Gagal memperbarui sesi Midtrans.');
          return false;
        }
      },
    });

    if (result.isConfirmed && result.value) {
      toast('success', `Sesi Midtrans untuk #${invoice.invoice_number} berhasil diperbarui!`);
      fetchInvoice();
    }
  };

  // Submit invoice to client
  const handleSubmitInvoice = async () => {
    const result = await Swal.fire({
      title: 'Terbitkan Invoice ini?',
      html: `
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
          Invoice <b style="color: #0f172a;">#${invoice.invoice_number}</b> akan diterbitkan ke klien <b style="color: #0f172a;">${invoice.client?.name || ''}</b>.
        </p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🚀 Ya, Terbitkan Sekarang',
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          const res = await api.post(`/api/invoices/${id}/submit`);
          return res.data;
        } catch (err) {
          Swal.showValidationMessage(
            err.response?.data?.message || 'Terjadi kesalahan saat menerbitkan invoice.'
          );
          return false;
        }
      },
    });

    if (result.isConfirmed && result.value) {
      toast('success', 'Invoice berhasil diterbitkan!');
      fetchInvoice();
    }
  };

  // Review payment
  const handleReviewPayment = () => {
    const isPdf = invoice.receipt_url && invoice.receipt_url.toLowerCase().endsWith('.pdf');

    const receiptContent = invoice.receipt_url
      ? isPdf
        ? `
          <div style="margin: 16px 0; padding: 20px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 36px; margin-bottom: 8px;">📄</div>
            <p style="color: #0f172a; font-weight: 700; font-size: 14px; margin: 0 0 8px;">${t('invoices.receipt_pdf_doc')}</p>
            <a href="${invoice.receipt_url}" target="_blank" rel="noopener noreferrer" style="color: #4f46e5; font-weight: 700; text-decoration: underline; font-size: 13px;">
              👁️ ${t('invoices.receipt_click_pdf')}
            </a>
          </div>
        `
        : `
          <div style="margin: 16px 0; text-align: center;">
            <div style="max-height: 340px; overflow-y: auto; background: #f8fafc; padding: 10px; border-radius: 14px; border: 1px solid #e2e8f0;">
              <img
                src="${invoice.receipt_url}"
                alt="Bukti Transfer"
                style="max-width: 100%; max-height: 300px; border-radius: 8px; object-fit: contain; margin: 0 auto; display: block;"
              />
            </div>
            <a href="${invoice.receipt_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 8px; color: #4f46e5; font-weight: 600; font-size: 12px;">
              🔍 ${t('invoices.receipt_open_full')}
            </a>
          </div>
        `
      : `
        <div style="margin: 20px 0; padding: 20px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">
          <p style="margin: 0;">${t('invoices.receipt_not_uploaded')}</p>
        </div>
      `;

    Swal.fire({
      title: t('invoices.verify_modal_title'),
      html: `
        <div style="text-align: left; font-family: 'Plus Jakarta Sans', sans-serif;">
          <div style="background: #f1f5f9; padding: 14px 18px; border-radius: 14px; border: 1px solid #e2e8f0; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Invoice</p>
              <p style="margin: 2px 0 0; font-size: 16px; font-weight: 800; color: #4f46e5;">#${invoice.invoice_number}</p>
              <p style="margin: 2px 0 0; font-size: 13px; color: #334155; font-weight: 600;">${invoice.client?.name || '—'}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Tagihan</p>
              <p style="margin: 2px 0 0; font-size: 18px; font-weight: 800; color: #047857;">${formatRupiah(invoice.total)}</p>
            </div>
          </div>

          <p style="margin: 0; font-size: 13px; color: #475569; font-weight: 600;">${t('invoices.receipt_image')}</p>
          ${receiptContent}
        </div>
      `,
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: t('invoices.verify_approve'),
      denyButtonText: t('invoices.verify_reject'),
      cancelButtonText: t('common.close'),
      confirmButtonColor: '#10b981',
      denyButtonColor: '#f43f5e',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup swal-review-popup' },
      showLoaderOnConfirm: true,
      showLoaderOnDeny: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          await api.post(`/api/invoices/${id}/verify`, { action: 'approve' });
          return { action: 'approve' };
        } catch (err) {
          Swal.showValidationMessage(err.response?.data?.message || 'Gagal menyetujui pembayaran.');
          return false;
        }
      },
      preDeny: async () => {
        try {
          Swal.showLoading();
          await api.post(`/api/invoices/${id}/verify`, { action: 'reject' });
          return { action: 'reject' };
        } catch (err) {
          Swal.showValidationMessage(err.response?.data?.message || 'Gagal menolak pembayaran.');
          return false;
        }
      },
    }).then((result) => {
      if (result.isConfirmed) {
        toast('success', `Invoice #${invoice.invoice_number} berhasil disetujui (LUNAS)!`);
        fetchInvoice();
      } else if (result.isDenied) {
        toast('info', `Pembayaran Invoice #${invoice.invoice_number} ditolak. Status kembali Belum Dibayar.`);
        fetchInvoice();
      }
    });
  };

  const copyPublicLink = () => {
    if (!invoice?.public_link_token) return;
    const url = `${window.location.origin}/pay/${invoice.public_link_token}`;
    navigator.clipboard.writeText(url);
    toast('success', 'Link pembayaran berhasil disalin ke clipboard!');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-16">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-sm p-10 text-center">
          <span className="text-5xl block mb-3">⚠️</span>
          <h3 className="text-lg font-extrabold text-slate-900 mb-4">Invoice Tidak Ditemukan</h3>
          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md transition"
          >
            {t('invoices.detail_back')}
          </Link>
        </div>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
  const publicPayUrl = invoice.public_link_token ? `/pay/${invoice.public_link_token}` : null;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-16">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Faktur #{invoice.invoice_number}
            </h1>
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Dibuat pada {formatDate(invoice.created_at || invoice.issue_date, lang)}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition shadow-sm"
          >
            ← {t('common.back')}
          </Link>

          {invoice.status === 'pending_verification' && (
            <button
              type="button"
              onClick={handleReviewPayment}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs sm:text-sm font-bold transition shadow-sm"
            >
              🔍 Review Bukti
            </button>
          )}

          {invoice.status === 'draft' && (
            <>
              <Link
                href={`/dashboard/invoices/${invoice.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition shadow-sm"
              >
                ✏️ {t('common.edit')}
              </Link>
              <button
                type="button"
                onClick={handleSubmitInvoice}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold transition shadow-md shadow-indigo-500/20 active:scale-[0.98]"
              >
                {submitting ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  '🚀 Submit'
                )}
              </button>
            </>
          )}

          {/* PDF Download — Available for all statuses including Draft */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition shadow-sm disabled:opacity-60"
            title={invoice.status === 'draft' ? 'Download PDF Faktur (DRAFT)' : 'Download PDF Faktur Invoice'}
          >
            {downloadingPdf ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-400 border-t-indigo-600 rounded-full animate-spin" />
                <span>Membuat PDF...</span>
              </>
            ) : (
              <>
                <span>📄</span>
                <span>{invoice.status === 'draft' ? 'Unduh PDF (Draft)' : t('common.download_pdf')}</span>
              </>
            )}
          </button>

          {/* Resend Email — Only for active unpaid/pending invoices */}
          {invoice.status !== 'draft' && invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={resendingEmail}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition shadow-sm disabled:opacity-60"
              title="Kirim Ulang Email Tagihan ke Klien"
            >
              <span>📧</span>
              <span>{t('invoices.btn_resend_email')}</span>
            </button>
          )}

          {(invoice.status === 'unpaid' || invoice.status === 'overdue' || invoice.status === 'pending_verification') && (
            <>
              {isPro && invoice.payment_url && !invoice.receipt_url && invoice.status !== 'pending_verification' && (
                <button
                  type="button"
                  onClick={handleRefreshMidtrans}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs sm:text-sm font-bold transition shadow-sm"
                  title="Buat Ulang Sesi Midtrans / Ajukan Ulang"
                >
                  <span>🔄</span>
                  <span>{t('invoices.btn_resubmit_midtrans')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCancelInvoice}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs sm:text-sm font-bold transition shadow-sm"
                title="Batalkan Invoice"
              >
                <span>🚫</span>
                <span>{t('invoices.btn_cancel_invoice')}</span>
              </button>
            </>
          )}

          {invoice.status === 'cancelled' && isPro && (
            <button
              type="button"
              onClick={handleRefreshMidtrans}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold transition shadow-md shadow-indigo-500/20 active:scale-[0.98]"
              title="Aktifkan Kembali & Buat Sesi Midtrans Baru"
            >
              <span>🔄</span>
              <span>{t('invoices.btn_reactivate_midtrans')}</span>
            </button>
          )}

          {/* Copy Public Link & Open Client Portal — Only when submitted (not draft/paid/cancelled) */}
          {publicPayUrl && invoice.status !== 'draft' && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <>
              <button
                type="button"
                onClick={copyPublicLink}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs sm:text-sm font-bold transition shadow-sm"
                title="Salin Tautan Publik"
              >
                📋 {t('invoices.btn_copy_paylink')}
              </button>
              <a
                href={publicPayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition shadow-md shadow-emerald-500/20 active:scale-[0.98]"
              >
                🔗 {t('invoices.btn_open_client_portal')}
              </a>
            </>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-sm p-6 sm:p-8 overflow-hidden">

        {/* Meta Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-5 bg-slate-50 border border-slate-100 rounded-2xl mb-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
              {t('invoices.form_client')}
            </p>
            <p className="text-sm font-extrabold text-slate-900">{invoice.client?.name || '—'}</p>
            {invoice.client?.email && <p className="text-xs text-slate-500 mt-0.5">{invoice.client.email}</p>}
            {invoice.client?.phone && <p className="text-xs text-slate-500 mt-0.5">{invoice.client.phone}</p>}
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
              {t('invoices.form_issue_date')}
            </p>
            <p className="text-sm font-bold text-slate-900">{formatDate(invoice.issue_date, lang)}</p>
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
              {t('invoices.form_due_date')}
            </p>
            <p className="text-sm font-bold text-slate-900">{formatDate(invoice.due_date, lang)}</p>
          </div>

          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
              {t('common.status')}
            </p>
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${cfg.color}`}>
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Bukti Transfer / Receipt Banner */}
        {invoice.receipt_url && (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl mb-6">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📎</span>
              <div>
                <p className="text-xs font-extrabold text-indigo-950">{t('invoices.receipt_attached_title')}</p>
                <p className="text-xs text-indigo-700">{t('invoices.receipt_attached_desc')}</p>
              </div>
            </div>
            <a
              href={invoice.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 text-xs font-bold hover:bg-indigo-50 transition shadow-sm"
            >
              👁️ {t('invoices.receipt_btn_view')}
            </a>
          </div>
        )}

        {/* Items Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[540px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3 w-[8%] text-center">#</th>
                <th className="py-2.5 px-3">{t('invoices.form_item_name')}</th>
                <th className="py-2.5 px-3 text-center w-[12%]">{t('invoices.form_qty')}</th>
                <th className="py-2.5 px-3 text-right w-[20%]">{t('invoices.form_price')}</th>
                <th className="py-2.5 px-3 text-right w-[20%]">{t('invoices.form_subtotal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoice.items?.map((it, idx) => (
                <tr key={it.id || idx} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-3 text-center font-bold text-slate-400">{idx + 1}</td>
                  <td className="py-3 px-3 font-semibold text-slate-900">{it.item_name}</td>
                  <td className="py-3 px-3 text-center font-bold text-slate-700">{Number(it.quantity)}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-700">{formatRupiah(it.unit_price)}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(it.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div className="max-w-xs sm:max-w-sm ml-auto bg-gradient-to-br from-slate-50 to-slate-100/80 p-5 rounded-2xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs sm:text-sm text-slate-600">
            <span>{t('common.subtotal')}</span>
            <span className="font-mono font-bold text-slate-900">{formatRupiah(invoice.subtotal)}</span>
          </div>

          {Number(invoice.discount) > 0 && (
            <div className="flex items-center justify-between text-xs sm:text-sm text-rose-600">
              <span>{t('common.discount')}</span>
              <span className="font-mono font-bold">− {formatRupiah(invoice.discount)}</span>
            </div>
          )}

          {Number(invoice.tax_rate) > 0 && (
            <div className="flex items-center justify-between text-xs sm:text-sm text-indigo-700">
              <span>{t('common.tax')} ({Number(invoice.tax_rate)}%)</span>
              <span className="font-mono font-bold">
                + {formatRupiah(((Number(invoice.subtotal) - Number(invoice.discount || 0)) * Number(invoice.tax_rate)) / 100)}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t-2 border-dashed border-slate-300">
            <span className="text-xs sm:text-sm font-extrabold text-slate-900">{t('invoices.form_total_payment')}</span>
            <span className="text-lg sm:text-xl font-mono font-black text-indigo-700">
              {formatRupiah(invoice.total)}
            </span>
          </div>
        </div>

        {/* Notes if any */}
        {invoice.notes && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">Catatan</p>
            <p className="text-xs sm:text-sm text-slate-600 italic bg-slate-50 p-3.5 rounded-xl border border-slate-100">{invoice.notes}</p>
          </div>
        )}

      </div>
    </div>
  );
}
