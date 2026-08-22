'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(dateStr, lang = 'id') {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function DashboardPage() {
  const { t, lang } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [clients, setClients] = useState([]);
  const [subStatus, setSubStatus] = useState(null);

  const STATUS_CONFIG = {
    draft:                { label: t('invoices.status_draft'),                color: 'badge-gray'    },
    unpaid:               { label: t('invoices.status_unpaid'),               color: 'badge-amber'   },
    pending_verification: { label: t('invoices.status_pending_verification'), color: 'badge-blue'   },
    paid:                 { label: t('invoices.status_paid'),                 color: 'badge-emerald' },
    overdue:              { label: t('invoices.status_overdue'),              color: 'badge-red'     },
    cancelled:            { label: t('invoices.status_cancelled'),            color: 'badge-gray'    },
  };

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
      title: t('invoices.verify_modal_title'),
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p style="margin-bottom: 6px;"><b>No. Invoice:</b> #${inv.invoice_number}</p>
          <p style="margin-bottom: 6px;"><b>Klien:</b> ${inv.client?.name || '—'}</p>
          <p style="margin-bottom: 12px;"><b>Total Tagihan:</b> <span style="font-weight: 800; color: #059669;">${formatRupiah(inv.total)}</span></p>
          <p style="margin: 10px 0 4px; font-weight: 600; color: #475569;">${t('invoices.receipt_image')}</p>
          ${receiptContent}
        </div>
      `,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: t('invoices.verify_approve'),
      denyButtonText: t('invoices.verify_reject'),
      cancelButtonText: t('common.close'),
      confirmButtonColor: '#10b981',
      denyButtonColor: '#f43f5e',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.post(`/api/invoices/${inv.id}/approve-receipt`);
          toast('success', 'Pembayaran disetujui! Invoice berstatus LUNAS.');
          fetchDashboardData();
        } catch {
          toast('error', 'Gagal menyetujui pembayaran.');
        }
      } else if (result.isDenied) {
        try {
          await api.post(`/api/invoices/${inv.id}/reject-receipt`);
          toast('info', 'Bukti pembayaran ditolak. Status kembali belum bayar.');
          fetchDashboardData();
        } catch {
          toast('error', 'Gagal menolak bukti transfer.');
        }
      }
    });
  };

  // Metrik & KPI
  const paidInvoices = invoices.filter((i) => i.status === 'paid');
  const totalPaidRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  const pendingVerifyInvoices = invoices.filter((i) => i.status === 'pending_verification');
  const unpaidInvoices = invoices.filter((i) => i.status === 'unpaid' || i.status === 'overdue');
  const pendingRevenue = [...unpaidInvoices, ...pendingVerifyInvoices].reduce((sum, i) => sum + Number(i.total || 0), 0);

  const paidCount = paidInvoices.length;
  const unpaidCount = unpaidInvoices.length;
  const draftCount = invoices.filter((i) => i.status === 'draft').length;

  const isPro = subStatus?.tier === 'pro' || user?.tier === 'pro';

  // Invoices terbaru (maks 5)
  const recentInvoices = invoices.slice(0, 5);

  let bankAccounts = [];
  try {
    bankAccounts = typeof user?.bank_accounts === 'string'
      ? JSON.parse(user.bank_accounts || '[]')
      : user?.bank_accounts || [];
  } catch {
    bankAccounts = [];
  }

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: '60vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="page-container">

      {/* ── 1. Header Section ──────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {t('dashboard.welcome')} {user?.business_name || user?.email?.split('@')[0]}! 👋
          </h1>
          <p className="page-desc">
            {t('dashboard.overview_desc')}
          </p>
        </div>

        <div className="header-actions">
          <Link href="/dashboard/invoices/create" className="btn-primary">
            {t('dashboard.btn_create_invoice')}
          </Link>
          <Link href="/dashboard/clients" className="btn-secondary">
            {t('clients.btn_add')}
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
            <span className="dash-stat-label">{t('dashboard.total_revenue')}</span>
            <div className="dash-stat-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
              💰
            </div>
          </div>
          <p className="dash-stat-value" style={{ color: '#059669' }}>
            {formatRupiah(totalPaidRevenue)}
          </p>
          <div className="dash-stat-footer">
            <span className="dash-stat-sub">
              <b>{paidCount}</b> / {invoices.length} invoice lunas
            </span>
          </div>
        </div>

        {/* Menunggu Pembayaran */}
        <div className="dash-stat-card glass-card-interactive">
          <div className="dash-stat-top">
            <span className="dash-stat-label">{t('dashboard.pending_revenue')}</span>
            <div className="dash-stat-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#b45309' }}>
              ⏳
            </div>
          </div>
          <p className="dash-stat-value" style={{ color: '#b45309' }}>
            {formatRupiah(pendingRevenue)}
          </p>
          <div className="dash-stat-footer">
            <span className="dash-stat-sub">
              <b>{unpaidCount + pendingVerifyInvoices.length}</b> {t('dashboard.active_invoices')}
            </span>
          </div>
        </div>

        {/* Total Klien */}
        <div className="dash-stat-card glass-card-interactive">
          <div className="dash-stat-top">
            <span className="dash-stat-label">{t('dashboard.total_clients')}</span>
            <div className="dash-stat-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5' }}>
              👥
            </div>
          </div>
          <p className="dash-stat-value">
            {clients.length} <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>{t('nav.clients')}</span>
          </p>
          <div className="dash-stat-footer">
            <Link href="/dashboard/clients" className="dash-stat-link">
              {t('clients.title')} ➜
            </Link>
          </div>
        </div>

        {/* Total Invoice & Draft */}
        <div className="dash-stat-card glass-card-interactive">
          <div className="dash-stat-top">
            <span className="dash-stat-label">{t('nav.invoices')}</span>
            <div className="dash-stat-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#7e22ce' }}>
              🧾
            </div>
          </div>
          <p className="dash-stat-value">
            {invoices.length} <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>{t('nav.invoices')}</span>
          </p>
          <div className="dash-stat-footer">
            <span className="dash-stat-sub">
              Draft: <b>{draftCount}</b>
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
                <h3 className="dash-card-title">{t('dashboard.recent_invoices_title')}</h3>
                <p className="dash-card-desc">5 faktur tagihan terbaru.</p>
              </div>
              <Link href="/dashboard/invoices" className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>
                {t('dashboard.all_invoices_link')}
              </Link>
            </div>

            {recentInvoices.length === 0 ? (
              <div className="table-empty">
                <span className="table-empty-icon">🧾</span>
                <p>{t('dashboard.empty_invoices_title')}</p>
                <Link href="/dashboard/invoices/create" className="btn-primary" style={{ marginTop: 14 }}>
                  {t('dashboard.btn_create_invoice')}
                </Link>
              </div>
            ) : (
              <div className="dash-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.table_invoice_num')}</th>
                      <th>{t('dashboard.table_client')}</th>
                      <th>{t('dashboard.table_due_date')}</th>
                      <th className="td-right">{t('dashboard.table_total')}</th>
                      <th>{t('dashboard.table_status')}</th>
                      <th>{t('dashboard.table_action')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((inv) => {
                      const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                      return (
                        <tr key={inv.id}>
                          <td className="td-invoice-num">#{inv.invoice_number}</td>
                          <td className="td-name">{inv.client?.name || '—'}</td>
                          <td className="td-secondary">{formatDate(inv.due_date, lang)}</td>
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
                              👁️ {t('common.view')}
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
              <span>💎</span> {t('nav.subscription')}
            </h3>

            {isPro ? (
              <div style={{ marginTop: 14 }}>
                <div className="tier-pro-badge" style={{ padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>👑</span>
                    <div>
                      <b style={{ fontSize: 14, color: '#78350f' }}>{t('subscription.active_pro_badge')}</b>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#92400e', opacity: 0.95 }}>
                        {t('subscription.pro_hero_desc')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{t('subscription.invoices_created_this_month')}:</span>
                  <span style={{ fontWeight: 800, color: 'var(--indigo)' }}>
                    {subStatus?.invoiceCountThisMonth ?? 0} / 10
                  </span>
                </div>
                <div className="tier-progress-bar" style={{ height: 8 }}>
                  <div
                    className="tier-progress-fill"
                    style={{ width: `${Math.min(100, ((subStatus?.invoiceCountThisMonth ?? 0) / 10) * 100)}%` }}
                  />
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 16px' }}>
                  {t('subscription.remaining_quota', { count: Math.max(0, 10 - (subStatus?.invoiceCountThisMonth ?? 0)) })}
                </p>
                <Link
                  href="/dashboard/subscription"
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {t('subscription.btn_upgrade_hero')}
                </Link>
              </div>
            )}
          </div>

          {/* Setup Health Checklist */}
          <div className="dash-card glass-card">
            <h3 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚙️</span> {t('settings.title')}
            </h3>

            <div className="dash-checklist" style={{ marginTop: 14 }}>
              <div className="dash-check-item">
                <span className="dash-check-icon">{user?.business_name ? '✅' : '⚠️'}</span>
                <div style={{ flex: 1 }}>
                  <p className="dash-check-label">{t('settings.business_name')}</p>
                  <p className="dash-check-sub">
                    {user?.business_name ? user.business_name : 'Belum diisi'}
                  </p>
                </div>
              </div>

              <div className="dash-check-item">
                <span className="dash-check-icon">{bankAccounts.length > 0 ? '✅' : '⚠️'}</span>
                <div style={{ flex: 1 }}>
                  <p className="dash-check-label">{t('settings.bank_section_title')}</p>
                  <p className="dash-check-sub">
                    {bankAccounts.length > 0 ? `${bankAccounts.length} rekening` : 'Belum ada'}
                  </p>
                </div>
              </div>

              <div className="dash-check-item">
                <span className="dash-check-icon">{user?.midtrans_server_key ? '✅' : 'ℹ️'}</span>
                <div style={{ flex: 1 }}>
                  <p className="dash-check-label">Midtrans BYOK</p>
                  <p className="dash-check-sub">
                    {user?.midtrans_server_key ? t('subscription.midtrans_active') : t('subscription.midtrans_inactive')}
                  </p>
                </div>
              </div>
            </div>

            <Link
              href="/dashboard/settings"
              className="btn-secondary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
            >
              🛠️ {t('nav.settings')} ➜
            </Link>
          </div>

        </div>

      </div>

    </div>
  );
}
