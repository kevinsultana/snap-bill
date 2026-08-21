'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';

// ─── Status badge config ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:                { label: 'Draft',              color: 'badge-gray'    },
  unpaid:               { label: 'Belum Dibayar',      color: 'badge-amber'   },
  pending_verification: { label: 'Verifikasi',         color: 'badge-blue'    },
  paid:                 { label: 'Lunas',              color: 'badge-emerald' },
  overdue:              { label: 'Jatuh Tempo',        color: 'badge-red'     },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return <span className={`status-badge ${cfg.color}`}>{cfg.label}</span>;
}

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(value));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// ─── Page Component ──────────────────────────────────────────────────────────
export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const fetchInvoices = useCallback(async () => {
    try {
      const res = await api.get('/api/invoices');
      setInvoices(res.data);
    } catch {
      toast('error', 'Gagal memuat data invoice');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleDelete = async (inv) => {
    if (inv.status !== 'draft') {
      toast('error', 'Hanya invoice draft yang bisa dihapus');
      return;
    }
    const confirmed = await confirmDelete(`Invoice #${inv.invoice_number}`);
    if (!confirmed) return;
    try {
      await api.delete(`/api/invoices/${inv.id}`);
      toast('success', 'Invoice berhasil dihapus');
      fetchInvoices();
    } catch (err) {
      toast('error', err.response?.data?.message || 'Gagal menghapus invoice');
    }
  };

  // Filter & search
  const filtered = invoices.filter((inv) => {
    const matchSearch =
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      (inv.client?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Summary counts
  const counts = invoices.reduce((acc, inv) => {
    acc[inv.status] = (acc[inv.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoice</h1>
          <p className="page-desc">Buat dan kelola invoice untuk klien Anda.</p>
        </div>
        <Link href="/dashboard/invoices/create" className="btn-primary btn-inline" id="btn-create-invoice">
          + Buat Invoice
        </Link>
      </div>

      {/* Summary pills */}
      <div className="invoice-summary">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            className={`summary-pill ${filterStatus === key ? 'active' : ''}`}
            onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
          >
            <span className={`status-badge ${cfg.color}`}>{cfg.label}</span>
            <span className="summary-count">{counts[key] || 0}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="table-toolbar">
        <input
          type="search"
          className="form-input search-input"
          placeholder="🔍  Cari nomor invoice atau nama klien..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="record-count">{filtered.length} invoice</span>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div className="table-loading"><div className="loading-spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            <span className="table-empty-icon">🧾</span>
            <p>{search || filterStatus !== 'all' ? 'Tidak ada invoice yang cocok.' : 'Belum ada invoice. Buat invoice pertama Anda!'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>No. Invoice</th>
                <th>Klien</th>
                <th>Tanggal</th>
                <th>Jatuh Tempo</th>
                <th className="td-right">Total</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id}>
                  <td className="td-invoice-num">#{inv.invoice_number}</td>
                  <td className="td-name">{inv.client?.name || '—'}</td>
                  <td className="td-secondary">{formatDate(inv.issue_date)}</td>
                  <td className={`td-secondary ${inv.status === 'overdue' ? 'td-overdue' : ''}`}>
                    {formatDate(inv.due_date)}
                  </td>
                  <td className="td-price">{formatRupiah(inv.total)}</td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td className="td-actions">
                    {inv.status === 'draft' && (
                      <Link
                        href={`/dashboard/invoices/${inv.id}/edit`}
                        className="btn-action btn-edit"
                      >
                        ✏️ Edit
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="btn-action btn-view"
                    >
                      👁️ Lihat
                    </Link>
                    {inv.status === 'draft' && (
                      <button
                        className="btn-action btn-delete"
                        onClick={() => handleDelete(inv)}
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
