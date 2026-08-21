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
      text: 'Status invoice akan diubah menjadi "Belum Dibayar", file PDF akan di-generate, Midtrans Snap link akan dibuat (jika aktif), dan notifikasi email akan dikirim ke klien.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🚀 Ya, Terbitkan Sekarang',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
    });

    if (!result.isConfirmed) return;

    setSubmitting(true);
    try {
      const res = await api.post(`/api/invoices/${id}/submit`);
      await Swal.fire({
        icon: 'success',
        title: 'Invoice Berhasil Diterbitkan!',
        html: `
          <p style="color: #94a3b8; font-size: 14px;">Link pembayaran publik untuk klien telah aktif:</p>
          <div style="margin-top: 12px; padding: 10px; background: #1a1a2e; border-radius: 8px; border: 1px solid #2a2a4a; word-break: break-all; font-family: monospace; font-size: 13px; color: #818cf8;">
            ${res.data.public_link}
          </div>
        `,
        confirmButtonText: 'Lihat Detail',
        confirmButtonColor: '#6366f1',
      });
      fetchInvoice();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Menerbitkan Invoice',
        text: err.response?.data?.message || 'Terjadi kesalahan saat submit invoice.',
        confirmButtonColor: '#6366f1',
      });
    } finally {
      setSubmitting(false);
    }
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
