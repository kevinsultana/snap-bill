'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';
import Swal from 'sweetalert2';

// ─── Status badge config ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
  draft:                { label: 'Draft',              color: 'badge-gray'    },
  unpaid:               { label: 'Belum Dibayar',      color: 'badge-amber'   },
  pending_verification: { label: 'Menunggu Verifikasi', color: 'badge-blue'   },
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

  // ─── Submit Invoice ────────────────────────────────────────────────────────
  const handleSubmitInvoice = async (inv) => {
    const result = await Swal.fire({
      title: 'Terbitkan Invoice ini?',
      html: `
        <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
          Invoice <b style="color: #f1f5f9;">#${inv.invoice_number}</b> akan diterbitkan ke klien <b style="color: #f1f5f9;">${inv.client?.name || ''}</b>.
        </p>
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          Status akan diubah menjadi <b>Belum Dibayar</b>, PDF dibuat, dan email tagihan dikirim ke klien.
        </p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🚀 Ya, Terbitkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#374151',
      customClass: { popup: 'swal-custom-popup' },
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          const res = await api.post(`/api/invoices/${inv.id}/submit`);
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
        confirmButtonText: 'Selesai',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      fetchInvoices();
    }
  };

  // ─── Review Pembayaran (Approve / Reject Modal) ─────────────────────────────
  const handleReviewPayment = (inv) => {
    const isPdf = inv.receipt_url && inv.receipt_url.toLowerCase().endsWith('.pdf');

    const receiptContent = inv.receipt_url
      ? isPdf
        ? `
          <div style="margin: 16px 0; padding: 20px; background: #1a1a2e; border-radius: 10px; border: 1px solid #2a2a4a; text-align: center;">
            <div style="font-size: 36px; margin-bottom: 8px;">📄</div>
            <p style="color: #f1f5f9; font-weight: 600; font-size: 14px; margin: 0 0 8px;">Dokumen Bukti Transfer (PDF)</p>
            <a href="${inv.receipt_url}" target="_blank" rel="noopener noreferrer" style="color: #818cf8; text-decoration: underline; font-size: 13px;">
              👁️ Klik untuk Membuka Dokumen Bukti ↗
            </a>
          </div>
        `
        : `
          <div style="margin: 16px 0; text-align: center;">
            <div style="max-height: 340px; overflow-y: auto; background: #0f0f1a; padding: 10px; border-radius: 10px; border: 1px solid #2a2a4a;">
              <img
                src="${inv.receipt_url}"
                alt="Bukti Transfer"
                style="max-width: 100%; max-height: 300px; border-radius: 6px; object-fit: contain; margin: 0 auto; display: block;"
              />
            </div>
            <a href="${inv.receipt_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 8px; color: #818cf8; font-size: 12px;">
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
              <p style="margin: 2px 0 0; font-size: 16px; font-weight: 700; color: #818cf8;">#${inv.invoice_number}</p>
              <p style="margin: 2px 0 0; font-size: 13px; color: #cbd5e1;">${inv.client?.name || '—'}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600;">Total Tagihan</p>
              <p style="margin: 2px 0 0; font-size: 18px; font-weight: 800; color: #10b981;">${formatRupiah(inv.total)}</p>
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
      customClass: {
        popup: 'swal-custom-popup swal-review-popup',
      },
      showLoaderOnConfirm: true,
      showLoaderOnDeny: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          await api.post(`/api/invoices/${inv.id}/verify`, { action: 'approve' });
          return { action: 'approve' };
        } catch (err) {
          Swal.showValidationMessage(err.response?.data?.message || 'Gagal menyetujui pembayaran.');
          return false;
        }
      },
      preDeny: async () => {
        try {
          Swal.showLoading();
          await api.post(`/api/invoices/${inv.id}/verify`, { action: 'reject' });
          return { action: 'reject' };
        } catch (err) {
          Swal.showValidationMessage(err.response?.data?.message || 'Gagal menolak pembayaran.');
          return false;
        }
      },
    }).then((result) => {
      if (result.isConfirmed) {
        toast('success', `Invoice #${inv.invoice_number} berhasil disetujui (LUNAS)!`);
        fetchInvoices();
      } else if (result.isDenied) {
        toast('info', `Pembayaran Invoice #${inv.invoice_number} ditolak. Status kembali Belum Dibayar.`);
        fetchInvoices();
      }
    });
  };

  // ─── Delete Invoice ────────────────────────────────────────────────────────
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
          <p className="page-desc">Kelola faktur tagihan bisnis dan verifikasi pembayaran dari klien Anda.</p>
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

                    {/* Pending Verification -> Review Pembayaran Button */}
                    {inv.status === 'pending_verification' && (
                      <button
                        type="button"
                        className="btn-action btn-review"
                        onClick={() => handleReviewPayment(inv)}
                        title="Review Bukti Pembayaran Klien"
                      >
                        🔍 Review
                      </button>
                    )}

                    {/* Draft -> Submit Button */}
                    {inv.status === 'draft' && (
                      <button
                        type="button"
                        className="btn-action btn-submit"
                        onClick={() => handleSubmitInvoice(inv)}
                        title="Terbitkan ke Klien"
                      >
                        🚀 Submit
                      </button>
                    )}

                    {/* Draft -> Edit Button */}
                    {inv.status === 'draft' && (
                      <Link
                        href={`/dashboard/invoices/${inv.id}/edit`}
                        className="btn-action btn-edit"
                      >
                        ✏️ Edit
                      </Link>
                    )}

                    {/* View Detail Link */}
                    <Link
                      href={`/dashboard/invoices/${inv.id}`}
                      className="btn-action btn-view"
                    >
                      👁️ Lihat
                    </Link>

                    {/* Draft -> Delete Button */}
                    {inv.status === 'draft' && (
                      <button
                        className="btn-action btn-delete"
                        onClick={() => handleDelete(inv)}
                        title="Hapus Draft"
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
