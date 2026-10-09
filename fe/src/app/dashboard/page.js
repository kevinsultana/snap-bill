"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { toast } from "@/lib/toast";
import Swal from "sweetalert2";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  MetricCardSkeleton,
  TopClientsSkeleton,
  TableSkeleton,
} from "@/components/Skeleton";
import {
  Crown,
  AlertCircle,
  Bell,
  Clock,
  TrendingUp,
  Coins,
  Users,
  FileText,
  CheckCircle2,
  Info,
  Plus,
  RefreshCw,
  Eye,
} from "lucide-react";

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(dateStr, lang = "id") {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString(
    lang === "en" ? "en-US" : "id-ID",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
}

// Helper to get initials from a client name
function getInitials(name) {
  if (!name) return "C";
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
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
    draft: {
      label: t("invoices.status_draft"),
      color: "bg-slate-100 text-slate-700 border border-slate-200",
    },
    unpaid: {
      label: t("invoices.status_unpaid"),
      color: "bg-amber-50 text-amber-800 border border-amber-200",
    },
    pending_verification: {
      label: t("invoices.status_pending_verification"),
      color: "bg-blue-50 text-blue-800 border border-blue-200",
    },
    paid: {
      label: t("invoices.status_paid"),
      color: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    },
    overdue: {
      label: t("invoices.status_overdue"),
      color: "bg-rose-50 text-rose-800 border border-rose-200",
    },
    cancelled: {
      label: t("invoices.status_cancelled"),
      color: "bg-slate-100 text-slate-700 border border-slate-200",
    },
  };

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, analyticsRes, subRes] = await Promise.all([
        api.get("/api/settings"),
        api.get("/api/dashboard/analytics"),
        api.get("/api/subscriptions/status").catch(() => ({ data: null })),
      ]);

      setUser(settingsRes.data);
      if (analyticsRes.data?.success && analyticsRes.data?.data) {
        setAnalytics(analyticsRes.data.data);
      } else {
        setAnalytics(analyticsRes.data);
      }
      if (subRes?.data) setSubStatus(subRes.data);
    } catch (err) {
      console.error("[Dashboard fetch error]", err);
      setError(err.response?.data?.message || t("dashboard.error_loading"));
      toast("error", t("dashboard.error_loading"));
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
    const isPdf =
      inv.receipt_url && inv.receipt_url.toLowerCase().endsWith(".pdf");

    const receiptContent = inv.receipt_url
      ? isPdf
        ? `
          <div style="margin: 16px 0; padding: 20px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 13px; font-weight: 800; color: #4f46e5; margin-bottom: 8px;">[ PDF ]</div>
            <p style="color: #0f172a; font-weight: 700; font-size: 14px; margin: 0 0 8px;">Dokumen Bukti Transfer (PDF)</p>
            <a href="${inv.receipt_url}" target="_blank" rel="noopener noreferrer" style="color: #4f46e5; font-weight: 700; text-decoration: underline; font-size: 13px;">
              Buka Dokumen Bukti
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
              Buka gambar ukuran penuh
            </a>
          </div>
        `
      : `
        <div style="margin: 20px 0; padding: 20px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">
          <p style="margin: 0;">Bukti transfer belum diunggah.</p>
        </div>
      `;

    Swal.fire({
      title: t("invoices.verify_modal_title"),
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p style="margin-bottom: 6px;"><b>No. Invoice:</b> #${inv.invoice_number}</p>
          <p style="margin-bottom: 6px;"><b>Klien:</b> ${inv.client?.name || "-"}</p>
          <p style="margin-bottom: 12px;"><b>Total Tagihan:</b> <span style="font-weight: 800; color: #059669;">${formatRupiah(inv.total)}</span></p>
          <p style="margin: 10px 0 4px; font-weight: 600; color: #475569;">${t("invoices.receipt_image")}</p>
          ${receiptContent}
        </div>
      `,
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: t("invoices.verify_approve"),
      denyButtonText: t("invoices.verify_reject"),
      cancelButtonText: t("common.close"),
      confirmButtonColor: "#10b981",
      denyButtonColor: "#f43f5e",
      cancelButtonColor: "#94a3b8",
      customClass: { popup: "swal-custom-popup" },
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.post(`/api/invoices/${inv.id}/approve-receipt`);
          toast("success", "Pembayaran disetujui! Invoice berstatus LUNAS.");
          fetchDashboardData();
        } catch {
          toast("error", "Gagal menyetujui pembayaran.");
        }
      } else if (result.isDenied) {
        try {
          await api.post(`/api/invoices/${inv.id}/reject-receipt`);
          toast(
            "info",
            "Bukti pembayaran ditolak. Status kembali belum bayar.",
          );
          fetchDashboardData();
        } catch {
          toast("error", "Gagal menolak bukti transfer.");
        }
      }
    });
  };

  // State calculations from analytics
  const outstanding = analytics?.outstanding || {
    total_amount: 0,
    total_count: 0,
    breakdown: {},
  };
  const monthlyRevenue = analytics?.monthly_revenue || {
    total_amount: 0,
    paid_count: 0,
    mom_growth_percentage: 0,
  };
  const totalRevenue = analytics?.total_revenue || {
    total_amount: 0,
    paid_count: 0,
  };
  const topClients = analytics?.top_clients || [];
  const counts = analytics?.counts || {
    total_invoices: 0,
    total_clients: 0,
    paid_invoices: 0,
    unpaid_invoices: 0,
    pending_verification_invoices: 0,
    overdue_invoices: 0,
    draft_invoices: 0,
  };
  const recentInvoices = analytics?.recent_invoices || [];
  const monthlyTrends = analytics?.monthly_trends || [];
  const statusStats = analytics?.status_stats || {};

  const isPro = subStatus?.tier === "pro" || user?.tier === "pro";

  let bankAccounts = [];
  try {
    bankAccounts =
      typeof user?.bank_accounts === "string"
        ? JSON.parse(user.bank_accounts || "[]")
        : user?.bank_accounts || [];
  } catch {
    bankAccounts = [];
  }

  // Max revenue in trend chart for scaling
  const maxTrendRevenue = Math.max(...monthlyTrends.map((t) => t.revenue), 1);

  // Highest top client revenue for progress bar scaling
  const maxClientRevenue =
    topClients.length > 0
      ? Math.max(...topClients.map((c) => c.total_revenue), 1)
      : 1;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-16">
      {/* ── 1. Header Section ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {t("dashboard.welcome")}{" "}
              {user?.business_name || user?.email?.split("@")[0]}!
            </h1>
            {isPro && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                <Crown className="w-3 h-3 text-amber-700" /> PRO
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {t("dashboard.overview_desc")}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/dashboard/invoices/create"
            className="inline-flex items-center gap-1.5 min-h-11 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> {t("dashboard.btn_create_invoice")}
          </Link>
          <Link
            href="/dashboard/clients"
            className="inline-flex items-center gap-1.5 min-h-11 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold shadow-xs transition-all"
          >
            <Users className="w-4 h-4" /> {t("clients.btn_add")}
          </Link>
        </div>
      </div>

      {/* ── Error Banner if any ────────────────────────────────────── */}
      {error && !loading && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-rose-50 border border-rose-200 rounded-2xl px-5 py-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-rose-800 text-sm">{error}</p>
              <p className="text-xs text-rose-600 mt-0.5">
                Gagal memuat sebagian data statistik dashboard.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-white border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-50 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t("dashboard.retry")}
          </button>
        </div>
      )}

      {/* ── 2. Action Alert Banner (Pending Verification) ─────────── */}
      {counts.pending_verification_invoices > 0 && !loading && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4 shadow-xs">
          <div className="flex items-center gap-3.5 flex-1 min-w-60">
            <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 text-xl flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-indigo-900">
                Ada {counts.pending_verification_invoices} Pembayaran Menunggu
                Verifikasi Anda!
              </h3>
              <p className="text-xs text-indigo-700 mt-0.5">
                Klien telah mengunggah bukti struk transfer bank. Harap periksa
                dan setujui untuk melunasi invoice.
              </p>
            </div>
          </div>
          {recentInvoices.find((i) => i.status === "pending_verification") && (
            <button
              type="button"
              onClick={() =>
                handleReviewPayment(
                  recentInvoices.find(
                    (i) => i.status === "pending_verification",
                  ),
                )
              }
              className="inline-flex items-center justify-center min-h-11 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition whitespace-nowrap"
            >
              Review Bukti Transfer
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
          <div className="p-5 rounded-2xl border border-amber-200/70 bg-white shadow-xs hover:shadow-sm transition-all duration-200">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t("dashboard.outstanding_title")}
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center text-lg shrink-0">
                <Clock className="w-5 h-5 text-amber-700" />
              </div>
            </div>
            <p className="text-2xl font-black text-amber-600 font-mono tracking-tight my-1">
              {formatRupiah(outstanding.total_amount)}
            </p>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              <span className="font-semibold text-slate-600">
                {outstanding.total_count} {t("dashboard.active_invoices")}
              </span>
              {outstanding.breakdown?.overdue?.count > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                  {outstanding.breakdown.overdue.count} overdue
                </span>
              )}
            </div>
          </div>

          {/* CARD 2: Total Monthly Revenue (Current Month) */}
          <div className="p-5 rounded-2xl border border-emerald-200/70 bg-white shadow-xs hover:shadow-sm transition-all duration-200">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t("dashboard.monthly_revenue_title")}
                </span>
                <span className="block text-[11px] font-medium text-slate-400">
                  {monthlyRevenue.current_month_name || "Bulan Ini"}{" "}
                  {monthlyRevenue.current_year || ""}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center text-lg shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-700" />
              </div>
            </div>
            <p className="text-2xl font-black text-emerald-600 font-mono tracking-tight my-1">
              {formatRupiah(monthlyRevenue.total_amount)}
            </p>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                <b className="text-slate-700">{monthlyRevenue.paid_count}</b>{" "}
                lunas bulan ini
              </span>
              {monthlyRevenue.mom_growth_percentage !== 0 && (
                <span
                  className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    monthlyRevenue.mom_growth_percentage >= 0
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                  title="Pertumbuhan Month-over-Month dibanding bulan lalu"
                >
                  {monthlyRevenue.mom_growth_percentage >= 0 ? "▲ +" : "▼ "}
                  {monthlyRevenue.mom_growth_percentage}%
                </span>
              )}
            </div>
          </div>

          {/* CARD 3: Total All-Time Revenue */}
          <div className="p-5 rounded-2xl border border-indigo-200/70 bg-white shadow-xs hover:shadow-sm transition-all duration-200">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t("dashboard.all_time_revenue")}
              </span>
              <div className="w-10 h-10 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center text-lg shrink-0">
                <Coins className="w-5 h-5 text-indigo-700" />
              </div>
            </div>
            <p className="text-2xl font-black text-indigo-600 font-mono tracking-tight my-1">
              {formatRupiah(totalRevenue.total_amount)}
            </p>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              <span>
                <b className="text-slate-700">{totalRevenue.paid_count}</b>{" "}
                total invoice lunas
              </span>
              <Link
                href="/dashboard/invoices?status=paid"
                className="text-indigo-600 font-bold hover:underline"
              >
                Rincian
              </Link>
            </div>
          </div>

          {/* CARD 4: Total Registered Clients & Volume */}
          <div className="p-5 rounded-2xl border border-purple-200/70 bg-white shadow-xs hover:shadow-sm transition-all duration-200">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t("dashboard.total_clients")}
              </span>
              <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-700 flex items-center justify-center text-lg shrink-0">
                <Users className="w-5 h-5 text-purple-700" />
              </div>
            </div>
            <p className="text-2xl font-black text-purple-700 tracking-tight my-1">
              {counts.total_clients}{" "}
              <span className="text-sm font-semibold text-slate-400">
                klien
              </span>
            </p>
            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Total: <b className="text-slate-700">{counts.total_invoices}</b>{" "}
                invoice
              </span>
              <Link
                href="/dashboard/clients"
                className="text-purple-600 font-bold hover:underline"
              >
                {t("clients.title")}
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
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  {t("dashboard.top_clients_title")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t("dashboard.top_clients_desc")}
                </p>
              </div>
              <Link
                href="/dashboard/clients"
                className="inline-flex items-center justify-center min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
              >
                Lihat Klien
              </Link>
            </div>

            {loading ? (
              <TopClientsSkeleton />
            ) : topClients.length === 0 ? (
              <div className="text-center py-8 px-4 bg-slate-50/70 rounded-xl border border-dashed border-slate-200">
                <Users className="w-10 h-10 text-slate-300 mx-auto block mb-2" />
                <p className="text-sm font-bold text-slate-700 mb-1">
                  Belum Ada Riwayat Transaksi Klien
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Buat invoice pertama Anda untuk mulai mengumpulkan data
                  peringkat klien.
                </p>
                <Link
                  href="/dashboard/invoices/create"
                  className="inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
                >
                  + Buat Invoice
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {topClients.map((client, index) => {
                  const rankColors = [
                    { bg: "bg-amber-400", text: "text-amber-950", badge: "#1" },
                    { bg: "bg-slate-300", text: "text-slate-900", badge: "#2" },
                    { bg: "bg-amber-700", text: "text-amber-100", badge: "#3" },
                    { bg: "bg-slate-100", text: "text-slate-700", badge: `#4` },
                    { bg: "bg-slate-100", text: "text-slate-700", badge: `#5` },
                  ];
                  const rank = rankColors[index] || {
                    bg: "bg-slate-100",
                    text: "text-slate-700",
                    badge: `#${index + 1}`,
                  };
                  const percentOfMax = Math.min(
                    100,
                    Math.round((client.total_revenue / maxClientRevenue) * 100),
                  );

                  return (
                    <div
                      key={client.client_id || index}
                      className="p-3.5 rounded-xl bg-slate-50/80 hover:bg-indigo-50/40 border border-slate-200/70 transition-all duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-bold text-xs shrink-0 ${rank.bg} ${rank.text}`}
                        >
                          {rank.badge}
                        </span>
                        <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                          {getInitials(client.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {client.name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {client.email || client.phone || "-"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-end sm:items-end flex-col min-w-35">
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
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  {t("dashboard.revenue_trend")}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  Berdasarkan invoice lunas
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2 sm:gap-4 pt-4 items-end min-h-35">
                {monthlyTrends.map((trend, idx) => {
                  const heightPercent =
                    maxTrendRevenue > 0
                      ? Math.max(
                          8,
                          Math.round((trend.revenue / maxTrendRevenue) * 100),
                        )
                      : 8;
                  const isCurrent = idx === monthlyTrends.length - 1;

                  return (
                    <div
                      key={idx}
                      className="flex flex-col items-center gap-2 h-full justify-end group"
                    >
                      <span className="text-[10px] sm:text-xs font-mono font-bold text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        {trend.revenue > 0
                          ? trend.revenue >= 1000000
                            ? `${(trend.revenue / 1000000).toFixed(1)}jt`
                            : `${Math.round(trend.revenue / 1000)}k`
                          : "0"}
                      </span>
                      <div className="w-full bg-slate-100 h-28 rounded-t-lg relative flex items-end p-1 overflow-hidden">
                        <div
                          className={`w-full rounded-t-md transition-all duration-500 ${
                            isCurrent
                              ? "bg-indigo-600"
                              : "bg-slate-300 group-hover:bg-indigo-400"
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span
                        className={`text-[11px] font-bold ${isCurrent ? "text-indigo-600" : "text-slate-500"}`}
                      >
                        {trend.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Invoices Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {t("dashboard.recent_invoices_title")}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  5 faktur tagihan terbaru dalam database.
                </p>
              </div>
              <Link
                href="/dashboard/invoices"
                className="inline-flex items-center justify-center min-h-11 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
              >
                {t("dashboard.all_invoices_link")}
              </Link>
            </div>

            {loading ? (
              <TableSkeleton rows={4} />
            ) : recentInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto block mb-2" />
                <p className="text-sm font-semibold text-slate-700">
                  {t("dashboard.empty_invoices_title")}
                </p>
                <Link
                  href="/dashboard/invoices/create"
                  className="mt-3 inline-flex items-center justify-center min-h-11 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
                >
                  {t("dashboard.btn_create_invoice")}
                </Link>
              </div>
            ) : (
              <>
                {/* Mobile Cards Reflow (< sm screens) */}
                <div className="sm:hidden flex flex-col gap-3">
                  {recentInvoices.map((inv) => {
                    const cfg =
                      STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                    return (
                      <div
                        key={inv.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-indigo-700 text-sm">
                            #{inv.invoice_number}
                          </span>
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cfg.color}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          <p className="font-bold text-slate-900 text-sm">
                            {inv.client?.name || "-"}
                          </p>
                          <p className="text-slate-400 mt-0.5">
                            Jatuh Tempo: {formatDate(inv.due_date, lang)}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="font-mono font-bold text-slate-900 text-sm">
                            {formatRupiah(inv.total)}
                          </span>
                          <div className="flex items-center gap-2">
                            {inv.status === "pending_verification" && (
                              <button
                                type="button"
                                className="min-h-11 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition"
                                onClick={() => handleReviewPayment(inv)}
                              >
                                Review
                              </button>
                            )}
                            <Link
                              href={`/dashboard/invoices/${inv.id}`}
                              className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t("common.view")}</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Data Table (>= sm screens) */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-145">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                        <th className="py-2.5 px-3">
                          {t("dashboard.table_invoice_num")}
                        </th>
                        <th className="py-2.5 px-3">
                          {t("dashboard.table_client")}
                        </th>
                        <th className="py-2.5 px-3">
                          {t("dashboard.table_due_date")}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {t("dashboard.table_total")}
                        </th>
                        <th className="py-2.5 px-3">
                          {t("dashboard.table_status")}
                        </th>
                        <th className="py-2.5 px-3">
                          {t("dashboard.table_action")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentInvoices.map((inv) => {
                        const cfg =
                          STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                        return (
                          <tr
                            key={inv.id}
                            className="hover:bg-slate-50/60 transition-colors"
                          >
                            <td className="py-3 px-3 font-mono font-bold text-indigo-700">
                              #{inv.invoice_number}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-900">
                              {inv.client?.name || "-"}
                            </td>
                            <td className="py-3 px-3 text-slate-500 text-xs">
                              {formatDate(inv.due_date, lang)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                              {formatRupiah(inv.total)}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${cfg.color}`}
                              >
                                {cfg.label}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                {inv.status === "pending_verification" && (
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1 min-h-11 px-3 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition"
                                    onClick={() => handleReviewPayment(inv)}
                                    title="Review Bukti Transfer"
                                  >
                                    Review
                                  </button>
                                )}
                                <Link
                                  href={`/dashboard/invoices/${inv.id}`}
                                  className="inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{t("common.view")}</span>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Right Column (Sidebar Widgets) ────────────────────── */}
        <div className="flex flex-col gap-5">
          {/* Subscription Tier Widget */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-3">
              {t("nav.subscription")}
            </h3>

            {isPro ? (
              <div className="mt-2 p-4 rounded-2xl bg-amber-50/60 border border-amber-200">
                <div className="flex items-center gap-2.5">
                  <Crown className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <b className="text-sm text-amber-900">
                      {t("subscription.active_pro_badge")}
                    </b>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {t("subscription.pro_hero_desc")}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2">
                <div className="flex justify-between text-xs font-semibold mb-1.5">
                  <span className="text-slate-500">
                    {t("subscription.invoices_created_this_month")}:
                  </span>
                  <span className="font-extrabold text-indigo-700">
                    {subStatus?.invoiceCountThisMonth ??
                      counts.total_invoices ??
                      0}{" "}
                    / 10
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, ((subStatus?.invoiceCountThisMonth ?? 0) / 10) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2 mb-4">
                  {t("subscription.remaining_quota", {
                    count: Math.max(
                      0,
                      10 - (subStatus?.invoiceCountThisMonth ?? 0),
                    ),
                  })}
                </p>
                <Link
                  href="/dashboard/subscription"
                  className="w-full flex items-center justify-center min-h-11 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition"
                >
                  {t("subscription.btn_upgrade_hero")}
                </Link>
              </div>
            )}
          </div>

          {/* Invoice Status Distribution Widget */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-3">
              {t("dashboard.status_distribution")}
            </h3>

            <div className="flex flex-col gap-2.5 mt-2">
              {[
                {
                  key: "paid",
                  label: "Lunas (Paid)",
                  color: "bg-emerald-500",
                  count: counts.paid_invoices,
                  total: statusStats.paid?.total || 0,
                },
                {
                  key: "unpaid",
                  label: "Belum Bayar (Unpaid)",
                  color: "bg-amber-500",
                  count: counts.unpaid_invoices,
                  total: statusStats.unpaid?.total || 0,
                },
                {
                  key: "pending_verification",
                  label: "Menunggu Verifikasi",
                  color: "bg-blue-500",
                  count: counts.pending_verification_invoices,
                  total: statusStats.pending_verification?.total || 0,
                },
                {
                  key: "overdue",
                  label: "Jatuh Tempo (Overdue)",
                  color: "bg-rose-500",
                  count: counts.overdue_invoices,
                  total: statusStats.overdue?.total || 0,
                },
                {
                  key: "draft",
                  label: "Draf (Draft)",
                  color: "bg-slate-400",
                  count: counts.draft_invoices,
                  total: statusStats.draft?.total || 0,
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${item.color}`}
                    />
                    <span className="font-semibold text-slate-700">
                      {item.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">
                      {item.count}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({formatRupiah(item.total)})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Setup Health & Branding Checklist */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-3">
              {t("settings.title")}
            </h3>

            <div className="flex flex-col gap-2.5 mt-2">
              {[
                {
                  status: user?.logo_url ? "ok" : "info",
                  label: "Logo Brand Bisnis",
                  sub: user?.logo_url
                    ? "Logo aktif terpasang"
                    : "Belum diupload (Gunakan logo standar)",
                },
                {
                  status: user?.business_name ? "ok" : "warn",
                  label: t("settings.business_name"),
                  sub: user?.business_name || "Belum diisi",
                },
                {
                  status: bankAccounts.length > 0 ? "ok" : "warn",
                  label: t("settings.bank_section_title"),
                  sub:
                    bankAccounts.length > 0
                      ? `${bankAccounts.length} rekening`
                      : "Belum ada",
                },
                {
                  status: user?.midtrans_server_key ? "ok" : "info",
                  label: "Midtrans BYOK",
                  sub: user?.midtrans_server_key
                    ? t("subscription.midtrans_active")
                    : t("subscription.midtrans_inactive"),
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-100"
                >
                  {item.status === "ok" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : item.status === "warn" ? (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {item.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      {item.sub}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/dashboard/settings"
              className="mt-4 w-full flex items-center justify-center min-h-11 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
            >
              {t("nav.settings")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
