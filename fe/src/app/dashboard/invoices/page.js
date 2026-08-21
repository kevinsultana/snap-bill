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
  }).format(Number(value || 0));
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
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
          Invoice <b style="color: #0f172a;">#${inv.invoice_number}</b> akan diterbitkan ke klien <b style="color: #0f172a;">${inv.client?.name || ''}</b>.
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
      cancelButtonColor: '#94a3b8',
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
          <p style="color: #475569; font-size: 13px; margin: 0 0 8px;">Link pembayaran publik untuk klien telah aktif:</p>
          <div style="margin-top: 6px; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; word-break: break-all; font-family: monospace; font-size: 12px; color: #4f46e5; user-select: all;">
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
          <div style="margin: 16px 0; padding: 20px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 36px; margin-bottom: 8px;">📄</div>
            <p style="color: #0f172a; font-weight: 700; font-size: 14px; margin: 0 0 8px;">Dokumen Bukti Transfer (PDF)</p>
            <a href="${inv.receipt_url}" target="_blank" rel="noopener noreferrer" style="color: #4f46e5; font-weight: 700; text-decoration: underline; font-size: 13px;">
              👁️ Klik untuk Membuka Dokumen Bukti ↗
            </a>
          </div>
        `
        : `
          <div style="margin: 16px 0; text-align: center;">
            <div style="max-height: 340px; overflow-y: auto; background: #f8fafc; padding: 10px; border-radius: 14px; border: 1px solid #e2e8f0;">
              <img
                src="${inv.receipt_url}"
                alt="Bukti Transfer"
                style="max-width: 100%; max-height: 300px; border-radius: 8px; object-fit: contain; margin: 0 auto; display: block;"
              />
            </div>
            <a href="${inv.receipt_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 8px; color: #4f46e5; font-weight: 600; font-size: 12px;">
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
      title: '🔍 Review Pembayaran',
      html: `
        <div style="text-align: left; font-family: 'Plus Jakarta Sans', sans-serif;">
          <div style="background: #f1f5f9; padding: 14px 18px; border-radius: 14px; border: 1px solid #e2e8f0; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Invoice</p>
              <p style="margin: 2px 0 0; font-size: 16px; font-weight: 800; color: #4f46e5;">#${inv.invoice_number}</p>
              <p style="margin: 2px 0 0; font-size: 13px; color: #334155; font-weight: 600;">${inv.client?.name || '—'}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Total Tagihan</p>
              <p style="margin: 2px 0 0; font-size: 18px; font-weight: 800; color: #047857;">${formatRupiah(inv.total)}</p>
            </div>
          </div>

          <p style="margin: 0; font-size: 13px; color: #475569; font-weight: 600;">Bukti Pembayaran yang Diunggah Klien:</p>
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
      denyButtonColor: '#f43f5e',
      cancelButtonColor: '#94a3b8',
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
          <h1 className="page-title">🧾 Daftar Invoice</h1>
          <p className="page-desc">Kelola faktur tagihan bisnis, kirim ke klien, dan verifikasi bukti pembayaran.</p>
        </div>
        <Link href="/dashboard/invoices/create" className="btn-primary" id="btn-create-invoice">
          + Buat Invoice Baru
        </Link>
      </div>

      {/* Glass Card Container */}
      <div className="glass-card" style={{ padding: '24px' }}>

        {/* Status Filter Pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            className={`btn-toggle-type ${filterStatus === 'all' ? 'active' : ''}`}
            style={{ padding: '6px 14px', fontSize: 12, borderRadius: 9999 }}
            onClick={() => setFilterStatus('all')}
          >
            Semua ({invoices.length})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              className={`btn-toggle-type ${filterStatus === key ? 'active' : ''}`}
              style={{ padding: '6px 14px', fontSize: 12, borderRadius: 9999 }}
              onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
            >
              <span className={`status-badge ${cfg.color}`} style={{ padding: '2px 8px', fontSize: 11 }}>
                {cfg.label}
              </span>
              <span style={{ marginLeft: 6, fontWeight: 700 }}>{counts[key] || 0}</span>
            </button>
          ))}
        </div>

        {/* Search Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="search-bar-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="search"
              className="form-input search-input"
              placeholder="Cari nomor invoice atau nama klien..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="glass-pill" style={{ color: 'var(--text-secondary)' }}>
            Menampilkan: <b>{filtered.length}</b> invoice
          </span>
        </div>

        {/* Table */}
        <div className="table-container">
          {loading ? (
            <div className="loading-screen" style={{ minHeight: '30vh' }}>
              <div className="loading-spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="table-empty">
              <span className="table-empty-icon">🧾</span>
              <p>{search || filterStatus !== 'all' ? 'Tidak ada invoice yang cocok dengan filter.' : 'Belum ada invoice. Buat invoice pertama Anda sekarang!'}</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>No. Invoice</th>
                  <th>Klien</th>
                  <th>Tanggal</th>
                  <th>Jatuh Tempo</th>
                  <th className="td-right">Total Tagihan</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id}>
                    <td className="td-invoice-num">#{inv.invoice_number}</td>
                    <td className="td-name">{inv.client?.name || '—'}</td>
                    <td className="td-secondary">{formatDate(inv.issue_date)}</td>
                    <td className="td-secondary">{formatDate(inv.due_date)}</td>
                    <td className="td-right td-price" style={{ color: 'var(--text-main)' }}>
                      {formatRupiah(inv.total)}
                    </td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="td-actions" style={{ justifyContent: 'flex-end' }}>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
