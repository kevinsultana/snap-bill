"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import axios from "axios";
import Swal from "sweetalert2";
import { useTranslation } from "@/lib/i18n/useTranslation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  FileDown,
  RefreshCw,
  Zap,
  Eye,
  CreditCard,
  Building2,
  Copy,
  Check,
  Paperclip,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

function formatRupiah(num) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(num || 0));
}

function formatDate(dateStr, lang = "id") {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString(
    lang === "en" ? "en-US" : "id-ID",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  );
}

// Status badge Tailwind map
const STATUS_BADGE = {
  draft: "bg-slate-100 text-slate-700 border border-slate-200",
  unpaid: "bg-amber-50 text-amber-800 border border-amber-200",
  pending_verification: "bg-blue-50 text-blue-800 border border-blue-200",
  paid: "bg-emerald-50 text-emerald-800 border border-emerald-200",
  overdue: "bg-rose-50 text-rose-800 border border-rose-200",
};

export default function PublicPayPage() {
  const { token } = useParams();
  const searchParams = useSearchParams();
  const txStatus = searchParams?.get("transaction_status");
  const statusCode = searchParams?.get("status_code");
  const { t, lang } = useTranslation();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const orderId = searchParams?.get("order_id");
  const [checkingStatus, setCheckingStatus] = useState(false);

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [payingSnap, setPayingSnap] = useState(false);

  const STATUS_MAP = {
    draft: { label: t("invoices.status_draft") },
    unpaid: { label: t("invoices.status_unpaid") },
    pending_verification: { label: t("invoices.status_pending_verification") },
    paid: { label: t("invoices.status_paid") },
    overdue: { label: t("invoices.status_overdue") },
  };

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/public/invoices/${token}`);
      setInvoice(res.data);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Invoice tidak ditemukan atau tautan pembayaran tidak valid.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleCheckPaymentStatus = useCallback(
    async (showToast = true) => {
      setCheckingStatus(true);
      try {
        const res = await axios.post(
          `${API_URL}/api/public/invoices/${token}/check-status`,
          { order_id: orderId || undefined },
        );
        if (res.data?.invoice) setInvoice(res.data.invoice);
        if (res.data?.status === "paid") {
          Swal.fire({
            icon: "success",
            title: "Pembayaran Berhasil Terverifikasi!",
            text: "Terima kasih, tagihan invoice Anda telah lunas.",
            confirmButtonColor: "#6366f1",
            customClass: { popup: "swal-custom-popup" },
          });
        } else if (showToast) {
          Swal.fire({
            icon: "info",
            title: "Status Pembayaran",
            text: "Transaksi masih dalam proses atau menunggu pembayaran.",
            confirmButtonColor: "#6366f1",
            customClass: { popup: "swal-custom-popup" },
          });
        }
      } catch (err) {
        if (showToast) {
          Swal.fire({
            icon: "error",
            title: "Gagal Memeriksa Status",
            text:
              err.response?.data?.message ||
              "Terjadi kesalahan saat memeriksa status.",
            confirmButtonColor: "#6366f1",
            customClass: { popup: "swal-custom-popup" },
          });
        }
      } finally {
        setCheckingStatus(false);
      }
    },
    [token, orderId],
  );

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);
  useEffect(() => {
    if (orderId || txStatus) handleCheckPaymentStatus(false);
  }, [orderId, txStatus, handleCheckPaymentStatus]);

  const handleCopyAccount = (accNumber, idx) => {
    navigator.clipboard.writeText(accNumber);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: "warning",
        title: "Ukuran File Terlalu Besar",
        text: "Ukuran maksimal bukti transfer adalah 5MB.",
        confirmButtonColor: "#6366f1",
        customClass: { popup: "swal-custom-popup" },
      });
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreviewUrl(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUploadReceipt = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("receipt", selectedFile);
    try {
      await axios.post(
        `${API_URL}/api/public/invoices/${token}/receipt`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      await Swal.fire({
        icon: "success",
        title: "Bukti Transfer Terkirim!",
        text: "Bukti pembayaran Anda berhasil diunggah dan akan segera diverifikasi oleh pemilik usaha.",
        confirmButtonColor: "#6366f1",
        customClass: { popup: "swal-custom-popup" },
      });
      setSelectedFile(null);
      setPreviewUrl(null);
      fetchInvoice();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal Mengunggah",
        text:
          err.response?.data?.message ||
          "Terjadi kesalahan saat mengunggah bukti pembayaran.",
        confirmButtonColor: "#6366f1",
        customClass: { popup: "swal-custom-popup" },
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePaySnap = async () => {
    if (invoice?.payment_url) {
      window.location.href = invoice.payment_url;
      return;
    }
    setPayingSnap(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/public/invoices/${token}/pay`,
      );
      if (res.data?.payment_url) window.location.href = res.data.payment_url;
      else fetchInvoice();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Gagal Membuka Pembayaran Online",
        text:
          err.response?.data?.message ||
          "Tidak dapat membuat sesi pembayaran Midtrans.",
        confirmButtonColor: "#6366f1",
        customClass: { popup: "swal-custom-popup" },
      });
    } finally {
      setPayingSnap(false);
    }
  };

  // ── Loading State ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  // ── Error State ────────────────────────────────────────────────────────────
  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-16 bg-slate-50">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-xs p-10 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="mt-4 text-xl font-extrabold text-slate-900">
            Invoice Tidak Ditemukan
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {error ||
              "Tautan pembayaran ini tidak valid atau tagihan telah dihapus."}
          </p>
        </div>
      </div>
    );
  }

  const user = invoice.user || {};
  const client = invoice.client || {};
  const items = invoice.items || [];
  const bankAccounts = Array.isArray(user.bank_accounts)
    ? user.bank_accounts
    : [];
  const statusInfo = STATUS_MAP[invoice.status] || STATUS_MAP.unpaid;
  const badgeCls = STATUS_BADGE[invoice.status] || STATUS_BADGE.unpaid;

  return (
    // Outer page shell
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <div className="w-full max-w-5xl mx-auto px-4 py-6 sm:py-10 pb-16 print:p-0 print:max-w-full">
        {/* ── Top Header (print:hidden) ─────────────────────────────────── */}
        <div className="print:hidden mb-5 flex flex-wrap justify-between items-center gap-4 bg-white border border-slate-200/80 rounded-2xl px-5 py-4 shadow-xs">
          {/* Identity */}
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            {user.logo_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={user.logo_url}
                alt="Logo"
                className="max-h-10 max-w-30 object-contain"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                <Zap className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-base font-extrabold text-slate-900 truncate">
                {user.business_name || "SnapBill Invoice"}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {t("pay_portal.official_portal")}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <LanguageSwitcher size="small" />
            <a
              href={`${API_URL}/api/public/invoices/${token}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center min-h-11 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition shadow-xs"
              title="Download PDF Faktur Invoice Resmi"
            >
              <FileDown className="w-3.5 h-3.5" /> {t("common.download_pdf")}
            </a>
            <span
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold ${badgeCls}`}
            >
              {statusInfo.label}
            </span>
          </div>
        </div>

        {/* ── Midtrans Callback Return Banners (print:hidden) ─────────── */}
        {(txStatus === "settlement" ||
          txStatus === "capture" ||
          statusCode === "200") &&
          invoice.status !== "paid" && (
            <div className="print:hidden mb-4 flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-extrabold text-emerald-900">
                  {t("pay_portal.status_success_midtrans_title")}
                </h3>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {t("pay_portal.status_success_midtrans_desc")}
                </p>
              </div>
            </div>
          )}

        {(txStatus === "pending" || statusCode === "201") &&
          invoice.status !== "paid" && (
            <div className="print:hidden mb-4 flex flex-wrap items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Clock className="w-8 h-8 text-amber-600 shrink-0" />
                <div>
                  <h3 className="text-sm font-extrabold text-amber-900">
                    {t("pay_portal.status_pending_midtrans_title")}
                  </h3>
                  <p className="text-xs text-amber-700 mt-0.5">
                    {t("pay_portal.status_pending_midtrans_desc")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCheckPaymentStatus(true)}
                disabled={checkingStatus}
                className="inline-flex items-center justify-center min-h-11 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition whitespace-nowrap disabled:opacity-60"
              >
                {checkingStatus ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{" "}
                    Memeriksa...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1 inline" /> Cek Status
                    Pembayaran
                  </>
                )}
              </button>
            </div>
          )}

        {invoice.status === "paid" && (
          <div className="print:hidden mb-4 flex items-center gap-4 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
            <div>
              <h3 className="text-sm font-extrabold text-emerald-900">
                {t("pay_portal.status_paid_title")}
              </h3>
              <p className="text-xs text-emerald-700 mt-0.5">
                {t("pay_portal.status_paid_desc")}
              </p>
            </div>
          </div>
        )}

        {invoice.status === "pending_verification" && (
          <div className="print:hidden mb-4 flex items-center gap-4 bg-indigo-50 border border-indigo-200 rounded-2xl px-5 py-4">
            <Clock className="w-8 h-8 text-indigo-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-extrabold text-indigo-900">
                {t("pay_portal.status_pending_verif_title")}
              </h3>
              <p className="text-xs text-indigo-700 mt-0.5">
                {t("pay_portal.status_pending_verif_desc")}
              </p>
            </div>
          </div>
        )}

        {/* ── Main Grid: Invoice Details + Payment Panel ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 print:grid-cols-1">
          {/* Left / Invoice Details */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Invoice Summary Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs print:shadow-none print:border-0 p-5 sm:p-6">
              {/* Invoice # and Grand Total */}
              <div className="flex flex-wrap justify-between items-start gap-4 pb-4 border-b border-slate-100 mb-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {t("dashboard.table_invoice_num")}
                  </p>
                  <p className="text-xl font-black text-indigo-700 font-mono tracking-tight mt-1">
                    #{invoice.invoice_number}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    {t("dashboard.table_total")}
                  </p>
                  <p className="text-xl font-black text-emerald-600 font-mono tracking-tight mt-1">
                    {formatRupiah(invoice.total)}
                  </p>
                </div>
              </div>

              {/* Parties Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    {t("pay_portal.invoice_for")}:
                  </p>
                  <p className="font-bold text-slate-900">
                    {client.name || "-"}
                  </p>
                  {client.email && (
                    <p className="text-slate-500 mt-0.5">{client.email}</p>
                  )}
                  {client.phone && (
                    <p className="text-slate-500 mt-0.5">{client.phone}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                    {t("common.date")}:
                  </p>
                  <p className="text-slate-500">
                    {t("pay_portal.issued_on")}{" "}
                    {formatDate(invoice.issue_date, lang)}
                  </p>
                  <p
                    className={`font-semibold mt-0.5 ${invoice.status === "overdue" ? "text-rose-600" : "text-slate-700"}`}
                  >
                    {t("pay_portal.due_on")}{" "}
                    {formatDate(invoice.due_date, lang)}
                  </p>
                </div>
              </div>
            </div>

            {/* Items Table Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs print:shadow-none print:border-0 p-5 sm:p-6 overflow-hidden">
              <h3 className="text-sm font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                {t("invoices.form_section_items")}
              </h3>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse min-w-120">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                      <th className="py-2.5 px-3">
                        {t("invoices.form_item_name")}
                      </th>
                      <th className="py-2.5 px-2 text-right min-w-15">
                        {t("invoices.form_qty")}
                      </th>
                      <th className="py-2.5 px-2 text-right min-w-27.5">
                        {t("invoices.form_price")}
                      </th>
                      <th className="py-2.5 px-3 text-right min-w-27.5">
                        {t("invoices.form_subtotal")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {it.item_name}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-600">
                          {Number(it.quantity)}
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-600">
                          {formatRupiah(it.unit_price)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatRupiah(it.total_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="mt-5 pt-4 border-t border-slate-200 flex justify-end">
                <div className="w-full sm:w-64 flex flex-col gap-1.5 text-xs bg-slate-50 rounded-xl border border-slate-200 p-4">
                  <div className="flex justify-between text-slate-600">
                    <span>{t("common.subtotal")}</span>
                    <span className="font-mono font-bold">
                      {formatRupiah(invoice.subtotal)}
                    </span>
                  </div>
                  {Number(invoice.discount) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>{t("common.discount")}</span>
                      <span className="font-mono font-bold">
                        − {formatRupiah(invoice.discount)}
                      </span>
                    </div>
                  )}
                  {Number(invoice.tax_rate) > 0 && (
                    <div className="flex justify-between text-indigo-700">
                      <span>
                        {t("common.tax")} ({Number(invoice.tax_rate)}%)
                      </span>
                      <span className="font-mono font-bold">
                        +{" "}
                        {formatRupiah(
                          ((Number(invoice.subtotal) -
                            Number(invoice.discount)) *
                            Number(invoice.tax_rate)) /
                            100,
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t-2 border-dashed border-slate-300">
                    <span>{t("invoices.form_total_payment")}</span>
                    <span className="font-mono text-indigo-700 text-base">
                      {formatRupiah(invoice.total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Payment Panel (print:hidden) */}
          <div className="print:hidden flex flex-col gap-5">
            {/* Draft Notice (Client cannot pay yet) */}
            {invoice.status === "draft" && (
              <div className="bg-linear-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl p-6 text-center shadow-sm">
                <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-6 h-6 text-amber-700" />
                </div>
                <h3 className="text-sm font-extrabold text-amber-950 mb-1.5">
                  Faktur Masih Berupa Draft
                </h3>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Tagihan ini masih dalam status draft (belum diterbitkan secara
                  resmi oleh pemilik usaha).{" "}
                  <b>Pembayaran belum dapat dilakukan</b> hingga invoice resmi
                  diterbitkan.
                </p>
              </div>
            )}

            {/* Pending Verification Notice */}
            {invoice.status === "pending_verification" && (
              <div className="bg-indigo-50/50 border border-indigo-200 rounded-2xl p-5 text-center shadow-xs">
                <div className="w-14 h-14 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-6 h-6 text-indigo-700" />
                </div>
                <h3 className="text-sm font-extrabold text-indigo-900 mb-2">
                  {t("pay_portal.status_pending_verif_title")}
                </h3>
                <p className="text-xs text-indigo-700/80 leading-relaxed mb-4">
                  {t("pay_portal.status_pending_verif_desc")}
                </p>
                {invoice.receipt_url && (
                  <div className="border-t border-indigo-200/60 pt-4">
                    <p className="text-[10px] font-bold text-slate-500 mb-2">
                      Bukti Pembayaran Terkirim
                    </p>
                    <a
                      href={invoice.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat Bukti Pembayaran</span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Midtrans Snap Online Payment */}
            {invoice.status !== "paid" &&
              invoice.status !== "draft" &&
              invoice.status !== "pending_verification" &&
              invoice.status !== "cancelled" &&
              user.tier === "pro" &&
              user.has_midtrans && (
                <div className="bg-indigo-600 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-white" />
                      <span>{t("pay_portal.auto_payment_title")}</span>
                    </h3>
                    <span className="text-[10px] font-extrabold px-2 py-1 rounded-full bg-emerald-400 text-white">
                      {t("pay_portal.instant_badge")}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-100 mb-4 leading-relaxed">
                    {t("pay_portal.auto_payment_desc")}
                  </p>
                  <button
                    type="button"
                    onClick={handlePaySnap}
                    disabled={payingSnap}
                    className="w-full min-h-11 py-3.5 px-4 bg-white hover:bg-indigo-50 active:scale-[0.98] text-indigo-700 text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {payingSnap ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-indigo-300 border-t-indigo-700 rounded-full animate-spin" />{" "}
                        Membuka Gateway...
                      </>
                    ) : (
                      t("pay_portal.btn_pay_snap")
                    )}
                  </button>
                </div>
              )}

            {/* Manual Bank Transfer + Upload Proof */}
            {invoice.status !== "paid" &&
              invoice.status !== "draft" &&
              invoice.status !== "pending_verification" &&
              invoice.status !== "cancelled" && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4 text-slate-700" />
                    <span>{t("pay_portal.manual_transfer_title")}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    {t("pay_portal.manual_transfer_desc")}
                  </p>

                  {bankAccounts.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">
                      {t("pay_portal.no_bank_accounts")}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2.5 mb-5">
                      {bankAccounts.map((b, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-200 min-w-0"
                        >
                          <div className="min-w-0">
                            <span className="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider block">
                              {b.bank_name}
                            </span>
                            <p className="text-sm font-mono font-extrabold text-slate-900 my-0.5 break-all">
                              {b.account_number}
                            </p>
                            <span className="text-[11px] text-slate-500">
                              a.n.{" "}
                              {b.account_holder ||
                                user.business_name ||
                                "Pemilik Usaha"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyAccount(b.account_number, idx)
                            }
                            title="Salin Nomor Rekening"
                            className="shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition whitespace-nowrap"
                          >
                            {copiedIndex === idx ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                                <Check className="w-3.5 h-3.5" />
                                <span>{t("common.copied")}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-700 font-bold">
                                <Copy className="w-3.5 h-3.5" />
                                <span>{t("common.copy")}</span>
                              </span>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload Proof Section */}
                  <div className="border-t border-slate-200 pt-4">
                    <h4 className="text-xs font-extrabold text-slate-800 mb-1">
                      {t("pay_portal.upload_proof_title")}
                    </h4>
                    <p className="text-[11px] text-slate-500 mb-3">
                      {t("pay_portal.upload_proof_hint")}
                    </p>

                    <form onSubmit={handleUploadReceipt}>
                      <label
                        htmlFor="receipt-file"
                        className="block w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-5 text-center cursor-pointer transition-colors bg-slate-50/60"
                      >
                        <input
                          type="file"
                          id="receipt-file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        {previewUrl ? (
                          <div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewUrl}
                              alt="Preview Bukti"
                              className="max-h-28 mx-auto object-contain rounded-lg mb-2"
                            />
                            <p className="text-[11px] font-bold text-indigo-700">
                              Ganti file terpilih
                            </p>
                          </div>
                        ) : selectedFile ? (
                          <div>
                            <FileText className="w-8 h-8 text-indigo-600 mx-auto mb-1" />
                            <p className="text-xs font-bold text-slate-800">
                              {selectedFile.name}
                            </p>
                            <span className="text-[10px] text-slate-500">
                              ({(selectedFile.size / 1024).toFixed(1)} KB)
                            </span>
                          </div>
                        ) : (
                          <div>
                            <Paperclip className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
                            <p className="text-xs font-bold text-slate-700">
                              Pilih foto / tangkapan layar bukti transfer
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Klik di sini untuk memilih file
                            </p>
                          </div>
                        )}
                      </label>

                      <button
                        type="submit"
                        disabled={!selectedFile || uploading}
                        className="w-full min-h-11 mt-3 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploading ? (
                          <>
                            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{" "}
                            {t("pay_portal.uploading")}
                          </>
                        ) : (
                          t("pay_portal.btn_upload_proof")
                        )}
                      </button>
                    </form>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
