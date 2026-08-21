'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from '@/lib/toast';

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

  useEffect(() => {
    api.get(`/api/invoices/${id}`)
      .then((r) => setInvoice(r.data))
      .catch(() => toast('error', 'Invoice tidak ditemukan'))
      .finally(() => setLoading(false));
  }, [id]);

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

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoice #{invoice.invoice_number}</h1>
          <div style={{ marginTop: 6 }}>
            <span className={`status-badge ${cfg.color}`}>{cfg.label}</span>
          </div>
        </div>
        <div className="header-actions">
          <Link href="/dashboard/invoices" className="btn-secondary">← Kembali</Link>
          {invoice.status === 'draft' && (
            <Link href={`/dashboard/invoices/${invoice.id}/edit`} className="btn-primary btn-inline">✏️ Edit</Link>
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
            <p className="meta-label">Status</p>
            <p className="meta-value"><span className={`status-badge ${cfg.color}`}>{cfg.label}</span></p>
          </div>
        </div>

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
