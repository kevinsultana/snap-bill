'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import Swal from 'sweetalert2';

const STATUS_CONFIG = {
  draft:                { label: 'Draft',              color: 'badge-gray'    },
  unpaid:               { label: 'Belum Dibayar',      color: 'badge-amber'   },
  pending_verification: { label: 'Menunggu Verifikasi', color: 'badge-blue'   },
  paid:                 { label: 'Lunas',              color: 'badge-emerald' },
  overdue:              { label: 'Jatuh Tempo',        color: 'badge-red'     },
};

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [subStatus, setSubStatus] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [settingsRes, invoicesRes, clientsRes, subRes] = await Promise.all([
        api.get('/api/settings'),
        api.get('/api/invoices'),
        api.get('/api/clients'),
        api.get('/api/subscriptions/status').catch(() => ({ data: null })),
      ]);

      setUser(settingsRes.data);
      setInvoices(invoicesRes.data || []);
      setClients(clientsRes.data || []);
      if (subRes.data) setSubStatus(subRes.data);
    } catch {
      toast('error', 'Gagal memuat data dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Review pending verification modal
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
            <div style="max-height: 320px; overflow-y: auto; background: #f8fafc; padding: 10px; border-radius: 14px; border: 1px solid #e2e8f0;">
              <img
                src="${inv.receipt_url}"
                alt="Bukti Transfer"
                style="max-width: 100%; max-height: 280px; border-radius: 8px; object-fit: contain; margin: 0 auto; display: block;"
              />
            </div>
            <a href="${inv.receipt_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 8px; color: #4f46e5; font-weight: 600; font-size: 12px;">
              🔍 Buka gambar ukuran penuh ↗
            </a>
          </div>
        `
      : `
        <div style="margin: 20px 0; padding: 20px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">
          <p style="margin: 0;">Bukti transfer belum diunggah.</p>
        </div>
      `;

    Swal.fire({
      title: '🔍 Review Pembayaran Klien',
      html: `
        <div style="text-align: left; font-family: 'Plus Jakarta Sans', sans-serif;">
          <div style="background: #f1f5f9; padding: 14px 18px; border-radius: 14px; border: 1px solid #e2e8f0; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em;">Invoice</p>
              <p style="margin: 2px 0 0; font-size: 16px; font-weight: 800; color: #4f46e5;">#${inv.invoice_number}</p>
              <p style="margin: 2px 0 0; font-size: 13px; color: #334155; font-weight: 600;">${inv.client?.name || '—'}</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em;">Total Tagihan</p>
              <p style="margin: 2px 0 0; font-size: 18px; font-weight: 800; color: #047857;">${formatRupiah(inv.total)}</p>
            </div>
          </div>
          ${receiptContent}
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
      customClass: { popup: 'swal-custom-popup swal-review-popup' },
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
        fetchDashboardData();
      } else if (result.isDenied) {
        toast('info', `Pembayaran Invoice #${inv.invoice_number} ditolak.`);
        fetchDashboardData();
      }
    });
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  // Metrik Finansial
  const totalPaidRevenue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + Number(i.total || 0), 0);

  const pendingRevenue = invoices
    .filter((i) => ['unpaid', 'pending_verification', 'overdue'].includes(i.status))
    .reduce((sum, i) => sum + Number(i.total || 0), 0);

  const paidCount = invoices.filter((i) => i.status === 'paid').length;
  const pendingVerifyInvoices = invoices.filter((i) => i.status === 'pending_verification');
  const unpaidCount = invoices.filter((i) => ['unpaid', 'overdue'].includes(i.status)).length;
  const draftCount = invoices.filter((i) => i.status === 'draft').length;

  const isPro = subStatus?.tier === 'pro' || user?.tier === 'pro';
  const recentInvoices = invoices.slice(0, 5);
  const bankAccounts = Array.isArray(user?.bank_accounts) ? user.bank_accounts : [];

  return (
    <div className="page-container">

      {/* ── 1. Header & Welcome Greeting ───────────────────────────── */}
      <div className="dash-welcome-header">
        <div>
          <h1 className="page-title">
            Selamat datang, <span style={{ color: 'var(--indigo)' }}>{user?.business_name || user?.email?.split('@')[0]}</span> 👋
          </h1>
          <p className="page-desc">
            Berikut ringkasan performa finansial, tagihan aktif, dan status bisnis Anda.
          </p>
        </div>

        <div className="header-actions">
          <Link href="/dashboard/invoices/create" className="btn-primary">
            + Buat Invoice Baru
          </Link>
          <Link href="/dashboard/clients" className="btn-secondary">
            + Tambah Klien
          </Link>
        </div>
      </div>

      {/* ── 2. Action Alert (Pending Verification) ─────────────────── */}
      {pendingVerifyInvoices.length > 0 && (
        <div className="dash-action-banner">
          <div className="dash-action-icon">🔔</div>
          <div className="dash-action-content">
            <h3 className="dash-action-title">
              Ada {pendingVerifyInvoices.length} Pembayaran Menunggu Verifikasi Anda!
            </h3>
            <p className="dash-action-desc">
              Klien telah mengunggah bukti struk transfer bank. Harap periksa dan setujui untuk melunasi invoice.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleReviewPayment(pendingVerifyInvoices[0])}
            className="btn-primary"
            style={{ whiteSpace: 'nowrap' }}
          >
            🔍 Review Sekarang ➜
          </button>
        </div>
      )}

      {/* ── 3. KPI Metric Cards ────────────────────────────────────── */}
      <div className="dash-stats-grid">

        {/* Pendapatan Lunas */}
        <div className="dash-stat-card glass-card-interactive">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Total Pendapatan (Lunas)</span>
            <div className="dash-stat-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
              💰
            </div>
          </div>
          <p className="dash-stat-value" style={{ color: '#059669' }}>
            {formatRupiah(totalPaidRevenue)}
          </p>
          <div className="dash-stat-footer">
            <span className="dash-stat-sub">
              <b>{paidCount}</b> dari {invoices.length} invoice lunas
            </span>
          </div>
        </div>

        {/* Menunggu Pembayaran */}
        <div className="dash-stat-card glass-card-interactive">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Belum Dibayar & Pending</span>
            <div className="dash-stat-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#b45309' }}>
              ⏳
            </div>
          </div>
          <p className="dash-stat-value" style={{ color: '#b45309' }}>
            {formatRupiah(pendingRevenue)}
          </p>
          <div className="dash-stat-footer">
            <span className="dash-stat-sub">
              <b>{unpaidCount + pendingVerifyInvoices.length}</b> invoice aktif belum selesai
            </span>
          </div>
        </div>

        {/* Total Klien */}
        <div className="dash-stat-card glass-card-interactive">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Total Klien Terdaftar</span>
            <div className="dash-stat-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5' }}>
              👥
            </div>
          </div>
          <p className="dash-stat-value">
            {clients.length} <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>Klien</span>
          </p>
          <div className="dash-stat-footer">
            <Link href="/dashboard/clients" className="dash-stat-link">
              Kelola master klien ➜
            </Link>
          </div>
        </div>

        {/* Total Invoice & Draft */}
        <div className="dash-stat-card glass-card-interactive">
          <div className="dash-stat-top">
            <span className="dash-stat-label">Total Faktur Diterbitkan</span>
            <div className="dash-stat-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#7e22ce' }}>
              🧾
            </div>
          </div>
          <p className="dash-stat-value">
            {invoices.length} <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>Faktur</span>
          </p>
          <div className="dash-stat-footer">
            <span className="dash-stat-sub">
              Termasuk <b>{draftCount}</b> draf invoice
            </span>
          </div>
        </div>

      </div>

      {/* ── 4. Main Two-Column Layout ──────────────────────────────── */}
      <div className="dash-content-grid">

        {/* Left Column: Recent Invoices Table */}
        <div className="dash-left-col">
          <div className="dash-card glass-card">
            <div className="dash-card-header">
              <div>
                <h3 className="dash-card-title">🧾 Invoice Terbaru</h3>
                <p className="dash-card-desc">5 faktur tagihan yang paling baru diterbitkan.</p>
              </div>
              <Link href="/dashboard/invoices" className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>
                Lihat Semua ({invoices.length}) ➜
              </Link>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="table-empty">
                <span className="table-empty-icon">🧾</span>
                <p>Belum ada invoice. Buat invoice pertama Anda sekarang!</p>
                <Link href="/dashboard/invoices/create" className="btn-primary" style={{ marginTop: 14 }}>
                  + Buat Invoice
                </Link>
              </div>
            ) : (
              <div className="dash-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No. Invoice</th>
                      <th>Klien</th>
                      <th>Jatuh Tempo</th>
                      <th className="td-right">Total</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((inv) => {
                      const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                      return (
                        <tr key={inv.id}>
                          <td className="td-invoice-num">#{inv.invoice_number}</td>
                          <td className="td-name">{inv.client?.name || '—'}</td>
                          <td className="td-secondary">{formatDate(inv.due_date)}</td>
                          <td className="td-price">{formatRupiah(inv.total)}</td>
                          <td>
                            <span className={`status-badge ${cfg.color}`}>{cfg.label}</span>
                          </td>
                          <td className="td-actions">
                            {inv.status === 'pending_verification' && (
                              <button
                                type="button"
                                className="btn-action btn-review"
                                onClick={() => handleReviewPayment(inv)}
                                title="Review Bukti Transfer"
                              >
                                🔍 Review
                              </button>
                            )}
                            <Link href={`/dashboard/invoices/${inv.id}`} className="btn-action btn-view">
                              👁️ Detail
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Setup Health & Subscription Status */}
        <div className="dash-right-col">

          {/* Subscription Tier Widget */}
          <div className="dash-card glass-card">
            <h3 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>💎</span> Paket Berlangganan
            </h3>

            {isPro ? (
              <div style={{ marginTop: 14 }}>
                <div className="tier-pro-badge" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>👑</span>
                    <div>
                      <b style={{ fontSize: 14, color: '#78350f' }}>SNAPBILL PRO ACTIVE</b>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#92400e', opacity: 0.95 }}>
                        Nikmati kuota invoice tanpa batas & fitur lengkap.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Kuota Bulan Ini:</span>
                  <span style={{ fontWeight: 800, color: 'var(--indigo)' }}>
                    {subStatus?.invoiceCountThisMonth ?? 0} / 10 Invoice
                  </span>
                </div>
                <div className="tier-progress-bar" style={{ height: 8 }}>
                  <div
                    className="tier-progress-fill"
                    style={{ width: `${Math.min(100, ((subStatus?.invoiceCountThisMonth ?? 0) / 10) * 100)}%` }}
                  />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 16px' }}>
                  Tersisa {Math.max(0, 10 - (subStatus?.invoiceCountThisMonth ?? 0))} invoice di paket Free.
                </p>
                <Link
                  href="/dashboard/settings"
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  ⚡ Upgrade ke Pro (Rp 99rb)
                </Link>
              </div>
            )}
          </div>

          {/* Setup Health Checklist */}
          <div className="dash-card glass-card">
            <h3 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚙️</span> Kesiapan Penagihan
            </h3>
            <p className="dash-card-desc" style={{ marginBottom: 16 }}>
              Status integrasi pembayaran dan profil bisnis Anda.
            </p>

            <div className="dash-checklist">
              <div className="dash-check-item">
                <span className="dash-check-icon">{user?.business_name ? '✅' : '⚠️'}</span>
                <div style={{ flex: 1 }}>
                  <p className="dash-check-label">Identitas Bisnis / Brand</p>
                  <p className="dash-check-sub">
                    {user?.business_name ? user.business_name : 'Nama bisnis belum diisi di profil.'}
                  </p>
                </div>
              </div>

              <div className="dash-check-item">
                <span className="dash-check-icon">{bankAccounts.length > 0 ? '✅' : '⚠️'}</span>
                <div style={{ flex: 1 }}>
                  <p className="dash-check-label">Rekening Bank Transfer</p>
                  <p className="dash-check-sub">
                    {bankAccounts.length > 0 ? `${bankAccounts.length} rekening terdaftar.` : 'Belum ada rekening untuk pembayaran manual.'}
                  </p>
                </div>
              </div>

              <div className="dash-check-item">
                <span className="dash-check-icon">{user?.midtrans_server_key ? '✅' : 'ℹ️'}</span>
                <div style={{ flex: 1 }}>
                  <p className="dash-check-label">Gateway Midtrans (BYOK)</p>
                  <p className="dash-check-sub">
                    {user?.midtrans_server_key ? 'Terhubung untuk QRIS & VA.' : 'Opsional: Masukkan Server Key di Pengaturan.'}
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/dashboard/settings"
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
            >
              🛠️ Kelola Pengaturan ➜
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
}
