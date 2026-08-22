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

  const STATUS_CONFIG = {
    draft:                { label: t('invoices.status_draft'),                color: 'badge-gray'    },
    unpaid:               { label: t('invoices.status_unpaid'),               color: 'badge-amber'   },
    pending_verification: { label: t('invoices.status_pending_verification'), color: 'badge-blue'   },
    paid:                 { label: t('invoices.status_paid'),                 color: 'badge-emerald' },
    overdue:              { label: t('invoices.status_overdue'),              color: 'badge-red'     },
    cancelled:            { label: t('invoices.status_cancelled'),            color: 'badge-gray'    },
  };

  const [userSettings, setUserSettings] = useState(null);

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
    } catch (err) {
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
            <p style="color: #0f172a; font-weight: 700; font-size: 14px; margin: 0 0 8px;">Dokumen Bukti Transfer (PDF)</p>
            <a href="${invoice.receipt_url}" target="_blank" rel="noopener noreferrer" style="color: #4f46e5; font-weight: 700; text-decoration: underline; font-size: 13px;">
              👁️ Klik untuk Membuka Dokumen Bukti ↗
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
              🔍 Buka gambar ukuran penuh ↗
            </a>
          </div>
        `
      : `
        <div style="margin: 20px 0; padding: 20px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">
          <p style="margin: 0;">Bukti transfer belum diunggah atau tidak ditemukan.</p>
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

  if (loading) return <div className="loading-screen"><div className="loading-spinner" /></div>;
  if (!invoice) return (
    <div className="page-container">
      <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
        <span style={{ fontSize: 44 }}>⚠️</span>
        <h3 style={{ margin: '14px 0 6px', color: 'var(--text-main)' }}>Invoice Tidak Ditemukan</h3>
        <Link href="/dashboard/invoices" className="btn-secondary">{t('invoices.detail_back')}</Link>
      </div>
    </div>
  );

  const cfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
  const publicPayUrl = invoice.public_link_token ? `/pay/${invoice.public_link_token}` : null;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Faktur #{invoice.invoice_number}</h1>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`status-badge ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>
        <div className="header-actions">
          <Link href="/dashboard/invoices" className="btn-secondary">{t('common.back')}</Link>

          {invoice.status === 'pending_verification' && (
            <button
              type="button"
              onClick={handleReviewPayment}
              className="btn-action btn-review"
              style={{ padding: '9px 18px', fontSize: 13 }}
            >
              🔍 Review
            </button>
          )}

          {invoice.status === 'draft' && (
            <>
              <Link href={`/dashboard/invoices/${invoice.id}/edit`} className="btn-secondary">✏️ {t('common.edit')}</Link>
              <button
                type="button"
                onClick={handleSubmitInvoice}
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? <span className="btn-spinner" /> : '🚀 Submit'}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="btn-secondary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Download PDF Faktur Invoice"
          >
            {downloadingPdf ? (
              <>
                <span className="btn-spinner" style={{ borderColor: 'rgba(99, 102, 241, 0.3)', borderTopColor: 'var(--indigo)' }} />
                <span>Membuat PDF...</span>
              </>
            ) : (
              <>
                <span>📄</span>
                <span>{t('common.download_pdf')}</span>
              </>
            )}
          </button>

          {invoice.status !== 'draft' && invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={resendingEmail}
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Kirim Ulang Email Tagihan ke Klien"
            >
              <span>📧</span>
              <span>{t('invoices.btn_resend_email')}</span>
            </button>
          )}

          {(invoice.status === 'unpaid' || invoice.status === 'overdue' || invoice.status === 'pending_verification') && (
            <>
              {isPro && (
                <button
                  type="button"
                  onClick={handleRefreshMidtrans}
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--indigo)' }}
                  title="Buat Ulang Sesi Midtrans / Ajukan Ulang"
                >
                  <span>🔄</span>
                  <span>{t('invoices.btn_resubmit_midtrans')}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCancelInvoice}
                className="btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--rose)' }}
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
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              title="Aktifkan Kembali & Buat Sesi Midtrans Baru"
            >
              <span>🔄</span>
              <span>{t('invoices.btn_reactivate_midtrans')}</span>
            </button>
          )}

          {publicPayUrl && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <>
              <button type="button" onClick={copyPublicLink} className="btn-secondary" title="Salin Tautan Publik">
                📋 {t('invoices.btn_copy_paylink')}
              </button>
              <a
                href={publicPayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                🔗 {t('invoices.btn_open_client_portal')}
              </a>
            </>
          )}
        </div>
      </div>

      {/* Main Glass Card */}
      <div className="glass-card" style={{ padding: '28px', overflow: 'hidden' }}>

        {/* Meta info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{t('invoices.form_client')}</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{invoice.client?.name}</p>
            {invoice.client?.email && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{invoice.client.email}</p>}
            {invoice.client?.phone && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{invoice.client.phone}</p>}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{t('invoices.form_issue_date')}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>{formatDate(invoice.issue_date, lang)}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{t('invoices.form_due_date')}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>{formatDate(invoice.due_date, lang)}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{t('common.status')}</p>
            <div style={{ marginTop: 4 }}>
              <span className={`status-badge ${cfg.color}`}>{cfg.label}</span>
            </div>
          </div>
        </div>

        {/* Bukti Transfer / Receipt banner if uploaded */}
        {invoice.receipt_url && (
          <div style={{ padding: '16px 20px', background: 'rgba(224, 231, 255, 0.6)', border: '1px solid #c7d2fe', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>📎</span>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: '#1e1b4b' }}>Bukti Transfer Terlampir</p>
                <p style={{ margin: 0, fontSize: 12, color: '#4338ca' }}>Klien telah mengunggah bukti pembayaran via portal publik.</p>
              </div>
            </div>
            <a
              href={invoice.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ fontSize: 12, padding: '6px 14px' }}
            >
              👁️ Lihat Bukti ↗
            </a>
          </div>
        )}

        {/* Items Table */}
        <div className="table-container" style={{ marginBottom: 24 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('invoices.form_item_name')}</th>
                <th className="td-right">{t('invoices.form_qty')}</th>
                <th className="td-right">{t('invoices.form_price')}</th>
                <th className="td-right">{t('invoices.form_subtotal')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((it, idx) => (
                <tr key={it.id}>
                  <td className="td-num">{idx + 1}</td>
                  <td className="td-name">{it.item_name}</td>
                  <td className="td-right td-secondary">{Number(it.quantity)}</td>
                  <td className="td-right td-secondary">{formatRupiah(it.unit_price)}</td>
                  <td className="td-right td-price">{formatRupiah(it.total_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Summary */}
        <div style={{ maxWidth: 360, marginLeft: 'auto', background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.9), rgba(241, 245, 249, 0.9))', padding: '20px 24px', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <div className="total-row">
            <span>{t('common.subtotal')}</span>
            <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatRupiah(invoice.subtotal)}</span>
          </div>
          {Number(invoice.discount) > 0 && (
            <div className="total-row total-discount">
              <span>{t('common.discount')}</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>− {formatRupiah(invoice.discount)}</span>
            </div>
          )}
          {Number(invoice.tax_rate) > 0 && (
            <div className="total-row" style={{ color: 'var(--indigo-dark)' }}>
              <span>{t('common.tax')} ({Number(invoice.tax_rate)}%)</span>
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+ {formatRupiah((Number(invoice.subtotal) - Number(invoice.discount)) * Number(invoice.tax_rate) / 100)}</span>
            </div>
          )}
          <div className="total-row total-grand" style={{ borderTop: '2px dashed #cbd5e1', paddingTop: 14 }}>
            <span>{t('invoices.form_total_payment')}</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--indigo-dark)', fontFamily: 'var(--font-mono)' }}>
              {formatRupiah(invoice.total)}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
