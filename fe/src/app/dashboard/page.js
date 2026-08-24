'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from '@/lib/toast';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { MetricCardSkeleton, TopClientsSkeleton, TableSkeleton } from '@/components/Skeleton';

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

// Helper to get initials from a client name
function getInitials(name) {
  if (!name) return 'C';
  return name
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function DashboardPage() {
  const { t, lang } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [analytics, setAnalytics] = useState(null);
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
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, analyticsRes, subRes] = await Promise.all([
        api.get('/api/settings'),
        api.get('/api/dashboard/analytics'),
        api.get('/api/subscriptions/status').catch(() => ({ data: null })),
      ]);

      setUser(settingsRes.data);
      if (analyticsRes.data?.success && analyticsRes.data?.data) {
        setAnalytics(analyticsRes.data.data);
      } else {
        setAnalytics(analyticsRes.data);
      }
      if (subRes?.data) setSubStatus(subRes.data);
    } catch (err) {
      console.error('[Dashboard fetch error]', err);
      setError(err.response?.data?.message || t('dashboard.error_loading'));
      toast('error', t('dashboard.error_loading'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Review pending verification modal
  const handleReviewPayment = (inv) => {
    if (!inv) return;
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

  // State calculations from analytics
  const outstanding = analytics?.outstanding || { total_amount: 0, total_count: 0, breakdown: {} };
  const monthlyRevenue = analytics?.monthly_revenue || { total_amount: 0, paid_count: 0, mom_growth_percentage: 0 };
  const totalRevenue = analytics?.total_revenue || { total_amount: 0, paid_count: 0 };
  const topClients = analytics?.top_clients || [];
  const counts = analytics?.counts || { total_invoices: 0, total_clients: 0, paid_invoices: 0, unpaid_invoices: 0, pending_verification_invoices: 0, overdue_invoices: 0, draft_invoices: 0 };
  const recentInvoices = analytics?.recent_invoices || [];
  const monthlyTrends = analytics?.monthly_trends || [];
  const statusStats = analytics?.status_stats || {};

  const isPro = subStatus?.tier === 'pro' || user?.tier === 'pro';

  let bankAccounts = [];
  try {
    bankAccounts = typeof user?.bank_accounts === 'string'
      ? JSON.parse(user.bank_accounts || '[]')
      : user?.bank_accounts || [];
  } catch {
    bankAccounts = [];
  }

  // Max revenue in trend chart for scaling
  const maxTrendRevenue = Math.max(...monthlyTrends.map((t) => t.revenue), 1);

  // Highest top client revenue for progress bar scaling
  const maxClientRevenue = topClients.length > 0 ? Math.max(...topClients.map((c) => c.total_revenue), 1) : 1;

  return (
    <div className="page-container" style={{ width: '100%', maxWidth: 1200, margin: '0 auto', paddingBottom: 60 }}>

      {/* ── 1. Header Section ──────────────────────────────────────── */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>
              {t('dashboard.welcome')} {user?.business_name || user?.email?.split('@')[0]}! 👋
            </h1>
            {isPro && (
              <span className="badge-pro" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#92400e', fontWeight: 800, border: '1px solid #fcd34d' }}>
                👑 PRO
              </span>
            )}
          </div>
          <p className="page-desc" style={{ marginTop: 4 }}>
            {t('dashboard.overview_desc')}
          </p>
        </div>

        <div className="header-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/dashboard/invoices/create" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>➕</span> {t('dashboard.btn_create_invoice')}
          </Link>
          <Link href="/dashboard/clients" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span>👥</span> {t('clients.btn_add')}
          </Link>
        </div>
      </div>

      {/* ── Error Banner if any ────────────────────────────────────── */}
      {error && !loading && (
        <div
          className="glass-card"
          style={{
            padding: '16px 20px',
            marginBottom: 24,
            background: 'rgba(254, 242, 242, 0.95)',
            border: '1px solid #fca5a5',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <div>
              <p style={{ fontWeight: 700, color: '#991b1b', margin: 0 }}>{error}</p>
              <p style={{ fontSize: 12, color: '#b91c1c', margin: '2px 0 0' }}>Gagal memuat sebagian data statistik dashboard.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="btn-secondary"
            style={{ fontSize: 13, padding: '6px 14px' }}
          >
            🔄 {t('dashboard.retry')}
          </button>
        </div>
      )}

      {/* ── 2. Action Alert Banner (Pending Verification) ─────────── */}
      {counts.pending_verification_invoices > 0 && !loading && (
        <div
          className="dash-action-banner"
          style={{
            marginBottom: 24,
            background: 'linear-gradient(135deg, rgba(238, 242, 255, 0.95), rgba(245, 243, 255, 0.95))',
            border: '1px solid #c7d2fe',
            padding: '18px 24px',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
            boxShadow: '0 8px 24px rgba(99, 102, 241, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 240 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              🔔
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#312e81' }}>
                Ada {counts.pending_verification_invoices} Pembayaran Menunggu Verifikasi Anda!
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#4338ca' }}>
                Klien telah mengunggah bukti struk transfer bank. Harap periksa dan setujui untuk melunasi invoice.
              </p>
            </div>
          </div>
          {recentInvoices.find((i) => i.status === 'pending_verification') && (
            <button
              type="button"
              onClick={() => handleReviewPayment(recentInvoices.find((i) => i.status === 'pending_verification'))}
              className="btn-primary"
              style={{ padding: '9px 18px', fontSize: 13, whiteSpace: 'nowrap' }}
            >
              🔍 Review Bukti Transfer ➜
            </button>
          )}
        </div>
      )}

      {/* ── 3. Responsive Tailwind Grid for KPI Metric Statistic Cards ── */}
      {/* 1 column on < 768px, 2 cols on sm, 3 or 4 cols on md/lg screens */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6">

          {/* CARD 1: Total Outstanding (Unpaid) Invoice Amount */}
          <div className="glass-card-interactive group relative p-5 rounded-2xl border border-amber-200/60 bg-white/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('dashboard.outstanding_title')}
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center text-lg flex-shrink-0">
                ⏳
              </div>
            </div>
            <p className="text-2xl font-black text-amber-600 font-mono tracking-tight my-1">
              {formatRupiah(outstanding.total_amount)}
            </p>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">
                {outstanding.total_count} {t('dashboard.active_invoices')}
              </span>
              {outstanding.breakdown?.overdue?.count > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                  {outstanding.breakdown.overdue.count} overdue
                </span>
              )}
            </div>
          </div>

          {/* CARD 2: Total Monthly Revenue (Current Month) */}
          <div className="glass-card-interactive group relative p-5 rounded-2xl border border-emerald-200/60 bg-white/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t('dashboard.monthly_revenue_title')}
                </span>
                <span className="block text-[11px] font-medium text-slate-400">
                  {monthlyRevenue.current_month_name || 'Bulan Ini'} {monthlyRevenue.current_year || ''}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center text-lg flex-shrink-0">
                📈
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-600 font-mono tracking-tight my-1">
              {formatRupiah(monthlyRevenue.total_amount)}
            </p>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                <b className="text-slate-700">{monthlyRevenue.paid_count}</b> lunas bulan ini
              </span>
              {monthlyRevenue.mom_growth_percentage !== 0 && (
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    monthlyRevenue.mom_growth_percentage >= 0
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-rose-100 text-rose-700'
                  }`}
                  title="Pertumbuhan Month-over-Month dibanding bulan lalu"
                >
                  {monthlyRevenue.mom_growth_percentage >= 0 ? '▲ +' : '▼ '}
                  {monthlyRevenue.mom_growth_percentage}%
                </span>
              )}
            </div>
          </div>

          {/* CARD 3: Total All-Time Revenue */}
          <div className="glass-card-interactive group relative p-5 rounded-2xl border border-indigo-200/60 bg-white/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('dashboard.all_time_revenue')}
              </span>
              <div className="w-10 h-10 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center text-lg flex-shrink-0">
                💰
              </div>
            </div>
            <p className="text-2xl font-black text-indigo-600 font-mono tracking-tight my-1">
              {formatRupiah(totalRevenue.total_amount)}
            </p>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              <span>
                <b className="text-slate-700">{totalRevenue.paid_count}</b> total invoice lunas
              </span>
              <Link href="/dashboard/invoices?status=paid" className="text-indigo-600 font-bold hover:underline">
                Rincian →
              </Link>
            </div>
          </div>

          {/* CARD 4: Total Registered Clients & Volume */}
          <div className="glass-card-interactive group relative p-5 rounded-2xl border border-purple-200/60 bg-white/80 backdrop-blur-md shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t('dashboard.total_clients')}
              </span>
              <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-700 flex items-center justify-center text-lg flex-shrink-0">
                👥
              </div>
            </div>
            <p className="text-2xl font-black text-purple-700 tracking-tight my-1">
              {counts.total_clients}{' '}
              <span className="text-sm font-semibold text-slate-400">klien</span>
            </p>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Total: <b className="text-slate-700">{counts.total_invoices}</b> invoice
              </span>
              <Link href="/dashboard/clients" className="text-purple-600 font-bold hover:underline">
                {t('clients.title')} →
              </Link>
            </div>
          </div>

        </div>
      )}

      {/* ── 4. Main Two-Column Layout ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left 2 Columns (Table & Trends) ────────────────────── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Top 5 Clients Leaderboard Widget */}
          <div className="glass-card p-6 rounded-2xl border border-slate-200/80 bg-white/85 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span>🏆</span> {t('dashboard.top_clients_title')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('dashboard.top_clients_desc')}
                </p>
              </div>
              <Link
                href="/dashboard/clients"
                className="btn-secondary text-xs px-3 py-1.5 font-semibold"
              >
                Lihat Klien ➜
              </Link>
            </div>

            {loading ? (
              <TopClientsSkeleton />
            ) : topClients.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                <span className="text-3xl block mb-2">👥</span>
                <p className="text-sm font-bold text-slate-700 mb-1">Belum Ada Riwayat Transaksi Klien</p>
                <p className="text-xs text-slate-500 mb-3">Buat invoice pertama Anda untuk mulai mengumpulkan data peringkat klien.</p>
                <Link href="/dashboard/invoices/create" className="btn-primary text-xs px-4 py-2">
                  + Buat Invoice
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {topClients.map((client, index) => {
                  const rankColors = [
                    { bg: 'bg-amber-400', text: 'text-amber-950', badge: '🥇 #1' },
                    { bg: 'bg-slate-300', text: 'text-slate-900', badge: '🥈 #2' },
                    { bg: 'bg-amber-700', text: 'text-amber-100', badge: '🥉 #3' },
                    { bg: 'bg-slate-100', text: 'text-slate-700', badge: `#4` },
                    { bg: 'bg-slate-100', text: 'text-slate-700', badge: `#5` },
                  ];
                  const rank = rankColors[index] || { bg: 'bg-slate-100', text: 'text-slate-700', badge: `#${index + 1}` };
                  const percentOfMax = Math.min(100, Math.round((client.total_revenue / maxClientRevenue) * 100));

                  return (
                    <div
                      key={client.client_id || index}
                      className="p-3.5 rounded-xl bg-slate-50/80 hover:bg-indigo-50/40 border border-slate-200/70 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs flex-shrink-0 ${rank.bg} ${rank.text}`}>
                          {rank.badge}
                        </span>
                        <div
                          className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center text-xs font-black flex-shrink-0 shadow-sm"
                        >
                          {getInitials(client.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {client.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {client.email || client.phone || '—'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-end sm:items-end flex-col min-w-[140px]">
                        <p className="text-sm font-black text-emerald-600 font-mono">
                          {formatRupiah(client.total_revenue)}
                        </p>
                        <div className="flex items-center gap-2 w-full mt-1 justify-end">
                          <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${percentOfMax}%` }}
                            />
                          </div>
                          <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">
                            {client.total_invoices} inv
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6-Month Monthly Revenue Trend Bar Visualizer */}
          {monthlyTrends.length > 0 && !loading && (
            <div className="glass-card p-6 rounded-2xl border border-slate-200/80 bg-white/85 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <span>📈</span> {t('dashboard.revenue_trend')}
                </h3>
                <span className="text-xs text-slate-500 font-medium">Berdasarkan invoice lunas</span>
              </div>

              <div className="grid grid-cols-6 gap-2 sm:gap-4 pt-4 items-end min-h-[140px]">
                {monthlyTrends.map((trend, idx) => {
                  const heightPercent = maxTrendRevenue > 0 ? Math.max(8, Math.round((trend.revenue / maxTrendRevenue) * 100)) : 8;
                  const isCurrent = idx === monthlyTrends.length - 1;

                  return (
                    <div key={idx} className="flex flex-col items-center gap-2 h-full justify-end group">
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {trend.revenue > 0 ? (trend.revenue >= 1000000 ? `${(trend.revenue / 1000000).toFixed(1)}jt` : `${Math.round(trend.revenue / 1000)}k`) : '0'}
                      </span>
                      <div className="w-full bg-slate-100 h-28 rounded-t-lg relative flex items-end p-1 overflow-hidden">
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            isCurrent
                              ? 'bg-gradient-to-t from-indigo-600 to-indigo-400'
                              : 'bg-gradient-to-t from-slate-400 to-slate-300 group-hover:from-indigo-400 group-hover:to-indigo-300'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-bold ${isCurrent ? 'text-indigo-600' : 'text-slate-500'}`}>
                        {trend.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Invoices Table Card */}
          <div className="dash-card glass-card">
            <div className="dash-card-header">
              <div>
                <h3 className="dash-card-title">{t('dashboard.recent_invoices_title')}</h3>
                <p className="dash-card-desc">5 faktur tagihan terbaru dalam database.</p>
              </div>
              <Link href="/dashboard/invoices" className="btn-secondary" style={{ fontSize: 13, padding: '6px 14px' }}>
                {t('dashboard.all_invoices_link')}
              </Link>
            </div>

            {loading ? (
              <TableSkeleton rows={4} />
            ) : recentInvoices.length === 0 ? (
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
                          <td className="td-invoice-num font-mono font-bold text-indigo-700">#{inv.invoice_number}</td>
                          <td className="td-name font-semibold">{inv.client?.name || '—'}</td>
                          <td className="td-secondary">{formatDate(inv.due_date, lang)}</td>
                          <td className="td-price font-mono font-bold">{formatRupiah(inv.total)}</td>
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

        {/* ── Right Column (Sidebar Widgets) ────────────────────── */}
        <div className="flex flex-col gap-6">

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
                    {subStatus?.invoiceCountThisMonth ?? counts.total_invoices ?? 0} / 10
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

          {/* Invoice Status Distribution Widget */}
          <div className="dash-card glass-card">
            <h3 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📊</span> {t('dashboard.status_distribution')}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {[
                { key: 'paid', label: 'Lunas (Paid)', color: 'bg-emerald-500', count: counts.paid_invoices, total: statusStats.paid?.total || 0 },
                { key: 'unpaid', label: 'Belum Bayar (Unpaid)', color: 'bg-amber-500', count: counts.unpaid_invoices, total: statusStats.unpaid?.total || 0 },
                { key: 'pending_verification', label: 'Menunggu Verifikasi', color: 'bg-blue-500', count: counts.pending_verification_invoices, total: statusStats.pending_verification?.total || 0 },
                { key: 'overdue', label: 'Jatuh Tempo (Overdue)', color: 'bg-rose-500', count: counts.overdue_invoices, total: statusStats.overdue?.total || 0 },
                { key: 'draft', label: 'Draf (Draft)', color: 'bg-slate-400', count: counts.draft_invoices, total: statusStats.draft?.total || 0 },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="font-semibold text-slate-700">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{item.count}</span>
                    <span className="text-[11px] text-slate-400">({formatRupiah(item.total)})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Setup Health & Branding Checklist */}
          <div className="dash-card glass-card">
            <h3 className="dash-card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚙️</span> {t('settings.title')}
            </h3>

            <div className="dash-checklist" style={{ marginTop: 14 }}>
              <div className="dash-check-item">
                <span className="dash-check-icon">{user?.logo_url ? '✅' : 'ℹ️'}</span>
                <div style={{ flex: 1 }}>
                  <p className="dash-check-label">Logo Brand Bisnis</p>
                  <p className="dash-check-sub">
                    {user?.logo_url ? 'Logo aktif terpasang' : 'Belum diupload (Gunakan logo standar)'}
                  </p>
                </div>
              </div>

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
