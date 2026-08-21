'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import Swal from 'sweetalert2';

const STATUS_CONFIG = {
  draft:                { label: 'Draft',         color: 'badge-gray'    },
  unpaid:               { label: 'Belum Dibayar', color: 'badge-amber'   },
  pending_verification: { label: 'Verifikasi',    color: 'badge-blue'    },
  paid:                 { label: 'Lunas',         color: 'badge-emerald' },
  overdue:              { label: 'Jatuh Tempo',   color: 'badge-red'     },
};

function formatRupiah(v) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(Number(v));
}
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router  = useRouter();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchInvoice = () => {
    return api.get(`/api/invoices/${id}`)
      .then((r) => setInvoice(r.data))
      .catch(() => toast('error', 'Invoice tidak ditemukan'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  // Submit invoice to client
  const handleSubmitInvoice = async () => {
    const result = await Swal.fire({
      title: 'Terbitkan Invoice ini?',
      html: `
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
          Invoice <b style="color: #f1f5f9;">#${invoice.invoice_number}</b> akan diterbitkan ke klien <b style="color: #f1f5f9;">${invoice.client?.name || ''}</b>.
        </p>
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          Status akan diubah menjadi <b>Belum Dibayar</b>, PDF dibuat, dan email tagihan dikirim ke klien.
        </p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🚀 Ya, Terbitkan Sekarang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#374151',
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
      await Swal.fire({
        icon: 'success',
        title: '🎉 Invoice Berhasil Diterbitkan!',
        html: `
          <p style="color: #94a3b8; font-size: 13px; margin: 0 0 8px;">Link pembayaran publik untuk klien telah aktif:</p>
          <div style="margin-top: 6px; padding: 12px; background: #1a1a2e; border-radius: 8px; border: 1px solid #2a2a4a; word-break: break-all; font-family: monospace; font-size: 12px; color: #818cf8; user-select: all;">
            ${result.value.public_link}
          </div>
        `,
        confirmButtonText: 'Lihat Detail',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      fetchInvoice();
    }
  };

  // Review payment
  const handleReviewPayment = () => {
    const isPdf = invoice.receipt_url && invoice.receipt_url.toLowerCase().endsWith('.pdf');

    const receiptContent = invoice.receipt_url
      ? isPdf
        ? `
          <div style="margin: 16px 0; padding: 20px; background: #1a1a2e; border-radius: 10px; border: 1px solid #2a2a4a; text-align: center;">
            <div style="font-size: 36px; margin-bottom: 8px;">📄</div>
            <p style="color: #f1f5f9; font-weight: 600; font-size: 14px; margin: 0 0 8px;">Dokumen Bukti Transfer (PDF)</p>
            <a href="${invoice.receipt_url}" target="_blank" rel="noopener noreferrer" style="color: #818cf8; text-decoration: underline; font-size: 13px;">
              👁️ Klik untuk Membuka Dokumen Bukti ↗
            </a>
          </div>
        `
        : `
          <div style="margin: 16px 0; text-align: center;">
            <div style="max-height: 340px; overflow-y: auto; background: #0f0f1a; padding: 10px; border-radius: 10px; border: 1px solid #2a2a4a;">
              <img
                src="${invoice.receipt_url}"
                alt="Bukti Transfer"
                style="max-width: 100%; max-height: 300px; border-radius: 6px; object-fit: contain; margin: 0 auto; display: block;"
              />
            </div>
            <a href="${invoice.receipt_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 8px; color: #818cf8; font-size: 12px;">
              🔍 Buka gambar ukuran penuh ↗
            </a>
          </div>
        `
      : `
        <div style="margin: 20px 0; padding: 20px; background: #1a1a2e; border-radius: 10px; border: 1px solid #2a2a4a; text-align: center; color: #94a3b8;">
          <p style="margin: 0;">Bukti transfer belum diunggah atau tidak ditemukan.</p>
        </div>
      `;

    Swal.fire({
      title: '🔍 Review Pembayaran',
      html: `
        <div style="text-align: left; font-family: 'Inter', sans-serif;">
          <div style="background: #1a1a2e; padding: 14px 18px; border-radius: 10px; border: 1px solid #2a2a4a; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Invoice</p>
              <p style="margin: 2px 0 0; font-size: 16px; font-weight: 700; color: #818cf8;">#${invoice.invoice_number}</p>
              <p style="margin: 2px 0 0; font-size: 13px; color: #cbd5e1;">${invoice.client?.name || '—'}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Total Tagihan</p>
              <p style="margin: 2px 0 0; font-size: 18px; font-weight: 800; color: #10b981;">${formatRupiah(invoice.total)}</p>
            </div>
          </div>

          <p style="margin: 0; font-size: 13px; color: #94a3b8; font-weight: 500;">Bukti Pembayaran yang Diunggah Klien:</p>
          ${receiptContent}

          <p style="margin: 8px 0 0; font-size: 12px; color: #64748b; text-align: center;">
            Pilih <b>Approve</b> untuk menyelesaikan pembayaran, atau <b>Reject</b> jika bukti tidak sesuai.
          </p>
        </div>
      `,
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: '✅ Approve (Lunas)',
      denyButtonText: '❌ Reject (Tolak)',
      cancelButtonText: 'Tutup',
      confirmButtonColor: '#10b981',
      denyButtonColor: '#ef4444',
      cancelButtonColor: '#374151',
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
      <div className="error-card">
        <span className="error-icon">⚠️</span>
        <p>Invoice tidak ditemukan.</p>
        <Link href="/dashboard/invoices" className="btn-secondary" style={{ display: 'inline-block', marginTop: 16 }}>← Kembali</Link>
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
          <h1 className="page-title">Invoice #{invoice.invoice_number}</h1>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`status-badge ${cfg.color}`}>{cfg.label}</span>
            {invoice.status === 'pending_verification' && (
              <span style={{ fontSize: 12, color: '#60a5fa' }}>• Menunggu Anda memeriksa bukti transfer</span>
            )}
          </div>
        </div>
        <div className="header-actions">
          <Link href="/dashboard/invoices" className="btn-secondary">← Kembali</Link>

          {invoice.status === 'pending_verification' && (
            <button
              type="button"
              onClick={handleReviewPayment}
              className="btn-action btn-review"
              style={{ padding: '8px 16px', fontSize: 13 }}
            >
              🔍 Review Pembayaran
            </button>
          )}

          {invoice.status === 'draft' && (
            <>
              <Link href={`/dashboard/invoices/${invoice.id}/edit`} className="btn-secondary">✏️ Edit</Link>
              <button
                type="button"
                onClick={handleSubmitInvoice}
                disabled={submitting}
                className="btn-primary btn-inline"
              >
                {submitting ? <span className="btn-spinner" /> : '🚀 Terbitkan ke Klien'}
              </button>
            </>
          )}

          {publicPayUrl && (
            <>
              <button type="button" onClick={copyPublicLink} className="btn-secondary" title="Salin Tautan Publik">
                📋 Salin Link Bayar
              </button>
              <a
                href={publicPayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
                style={{ borderColor: 'var(--indigo)' }}
              >
                🔗 Buka Portal Klien ↗
              </a>
            </>
          )}
        </div>
      </div>

      {/* Detail card */}
      <div className="invoice-detail-card">

        {/* Meta info */}
        <div className="invoice-meta-grid">
          <div className="meta-block">
            <p className="meta-label">Klien</p>
            <p className="meta-value">{invoice.client?.name}</p>
            {invoice.client?.email && <p className="meta-sub">{invoice.client.email}</p>}
            {invoice.client?.phone && <p className="meta-sub">{invoice.client.phone}</p>}
          </div>
          <div className="meta-block">
            <p className="meta-label">Tanggal Invoice</p>
            <p className="meta-value">{formatDate(invoice.issue_date)}</p>
          </div>
          <div className="meta-block">
            <p className="meta-label">Jatuh Tempo</p>
            <p className="meta-value">{formatDate(invoice.due_date)}</p>
          </div>
          <div className="meta-block">
            <p className="meta-label">Status Tagihan</p>
            <p className="meta-value"><span className={`status-badge ${cfg.color}`}>{cfg.label}</span></p>
          </div>
        </div>

        {/* Bukti Transfer / Receipt banner if uploaded */}
        {invoice.receipt_url && (
          <div style={{ padding: '16px 24px', background: 'rgba(59, 130, 246, 0.08)', borderBottom: '1px solid #2a2a4a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>📎</span>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: '#60a5fa' }}>Bukti Transfer Terlampir</p>
                <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>Klien telah mengunggah bukti pembayaran via portal publik.</p>
              </div>
            </div>
            <a
              href={invoice.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{ fontSize: 12, padding: '6px 14px' }}
            >
              👁️ Lihat Bukti Pembayaran ↗
            </a>
          </div>
        )}

        {/* Items table */}
        <div className="detail-items">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th className="td-right">Qty</th>
                <th className="td-right">Harga Satuan</th>
                <th className="td-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it, idx) => (
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

        {/* Totals */}
        <div className="detail-totals">
          <div className="total-row">
            <span>Subtotal</span>
            <span>{formatRupiah(invoice.subtotal)}</span>
          </div>
          {Number(invoice.discount) > 0 && (
            <div className="total-row total-discount">
              <span>Diskon</span>
              <span>− {formatRupiah(invoice.discount)}</span>
            </div>
          )}
          {Number(invoice.tax_rate) > 0 && (
            <div className="total-row">
              <span>Pajak ({Number(invoice.tax_rate)}%)</span>
              <span>+ {formatRupiah((Number(invoice.subtotal) - Number(invoice.discount)) * Number(invoice.tax_rate) / 100)}</span>
            </div>
          )}
          <div className="total-row total-grand">
            <span>Total</span>
            <span>{formatRupiah(invoice.total)}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
