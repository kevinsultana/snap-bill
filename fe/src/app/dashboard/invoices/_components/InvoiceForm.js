"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import api from "@/lib/api";
import toast from "@/lib/toast";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  Plus,
  Trash2,
  Eye,
  Edit3,
  FileText,
  Calendar,
  User,
  Percent,
  CheckCircle2,
  Building,
  ArrowLeft,
  Zap,
  CreditCard,
  Wallet,
} from "lucide-react";
import CreatableSelect from "react-select/creatable";

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: "38px",
    height: "38px",
    borderRadius: "0.5rem",
    borderColor: state.isFocused ? "#6366f1" : "#e2e8f0",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(99, 102, 241, 0.15)" : "none",
    "&:hover": {
      borderColor: "#cbd5e1",
    },
    fontSize: "0.8125rem",
    fontWeight: "600",
    backgroundColor: "#ffffff",
  }),
  valueContainer: (base) => ({
    ...base,
    padding: "0 8px",
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  menu: (base) => ({
    ...base,
    borderRadius: "0.75rem",
    boxShadow:
      "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
    border: "1px solid #e2e8f0",
    overflow: "hidden",
    zIndex: 9999,
  }),
  option: (base, state) => ({
    ...base,
    fontSize: "0.8125rem",
    fontWeight: state.isSelected ? "700" : "500",
    backgroundColor: state.isSelected
      ? "#6366f1"
      : state.isFocused
        ? "#eef2ff"
        : "#ffffff",
    color: state.isSelected ? "#ffffff" : "#1e293b",
    cursor: "pointer",
    padding: "8px 12px",
  }),
  placeholder: (base) => ({
    ...base,
    color: "#94a3b8",
    fontSize: "0.8125rem",
    fontWeight: "500",
  }),
  singleValue: (base) => ({
    ...base,
    color: "#0f172a",
    fontSize: "0.8125rem",
    fontWeight: "600",
  }),
  input: (base) => ({
    ...base,
    color: "#0f172a",
    margin: 0,
    padding: 0,
  }),
};

// Helper pemformat ribuan (e.g. 1000000 -> "1.000.000")
function formatThousand(val) {
  if (val === undefined || val === null || val === "") return "";
  const str = String(val).replace(/[^0-9]/g, "");
  if (!str) return "";
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Helper pengurai angka (e.g. "1.000.000" -> 1000000)
function parseRawNumber(val) {
  if (val === undefined || val === null || val === "") return 0;
  const str = String(val).replace(/\./g, "").replace(/,/g, ".");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function formatRupiah(value) {
  if (!value && value !== 0) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(value));
}

function toDateInput(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().split("T")[0];
}

function formatDateDisplay(dateStr, lang = "id") {
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

const EMPTY_LINE = { item_name: "", quantity: "1", unit_price: "" };

/**
 * InvoiceForm - Split-Screen Desktop & Tabbed Mobile Layout
 * with Real-time Inline Spreadsheet Editing and Live Preview
 */
export default function InvoiceForm({
  mode = "create",
  invoiceId,
  initialData,
}) {
  const router = useRouter();
  const { t, lang } = useTranslation();

  // Mobile Tab state ('form' | 'preview')
  const [activeTab, setActiveTab] = useState("form");

  // Master data state
  const [clients, setClients] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [clientId, setClientId] = useState(initialData?.client_id || "");
  const [issueDate, setIssueDate] = useState(
    toDateInput(initialData?.issue_date) || toDateInput(new Date()),
  );
  const [dueDate, setDueDate] = useState(
    toDateInput(initialData?.due_date) || "",
  );
  const [taxRate, setTaxRate] = useState(
    initialData?.tax_rate ? String(initialData.tax_rate) : "",
  );
  const [discountType, setDiscountType] = useState("fixed"); // 'fixed' (Rp) | 'percent' (%)
  const [discountValue, setDiscountValue] = useState(
    initialData?.discount ? formatThousand(initialData.discount) : "",
  );
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Initial payment states from initialData
  const initialPaid = Number(initialData?.amount_paid || 0);
  const initialTotal = Number(initialData?.total || 0);
  const defaultOption =
    initialPaid >= initialTotal && initialTotal > 0
      ? "paid"
      : initialPaid > 0
        ? "dp"
        : "unpaid";

  const [paymentOption, setPaymentOption] = useState(defaultOption);
  const [paidAmount, setPaidAmount] = useState(
    initialPaid > 0 ? formatThousand(initialPaid) : "",
  );
  const [paymentDate, setPaymentDate] = useState(
    toDateInput(initialData?.payment_date) || toDateInput(new Date()),
  );

  // Line items state
  const [lines, setLines] = useState(
    initialData?.items?.length
      ? initialData.items.map((it) => ({
          item_name: it.item_name || "",
          quantity: formatThousand(it.quantity) || "1",
          unit_price: formatThousand(it.unit_price) || "",
        }))
      : [{ ...EMPTY_LINE }],
  );

  // Load clients, saved items, and user profile settings
  useEffect(() => {
    api
      .get("/api/clients")
      .then((r) => setClients(r.data || []))
      .catch(() => {});
    api
      .get("/api/items")
      .then((r) => setSavedItems(r.data || []))
      .catch(() => {});
    api
      .get("/api/settings")
      .then((r) => setUserProfile(r.data || {}))
      .catch(() => {});
  }, []);

  // Mounted state for SSR-safe react-select
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Options for CreatableSelect (Items)
  const itemOptions = useMemo(() => {
    return savedItems.map((item) => ({
      value: item.id || item.name,
      label: item.name,
      price: item.price,
    }));
  }, [savedItems]);

  // Options for Client Select
  const clientOptions = useMemo(() => {
    return clients.map((c) => ({
      value: c.id,
      label: c.name,
      email: c.email,
    }));
  }, [clients]);

  // Selected client object
  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === clientId) || null;
  }, [clients, clientId]);

  // ─── Inline Table Item Actions ──────────────────────────────────────────────
  const addLine = () => {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  };

  const removeLine = (idx) => {
    if (lines.length === 1) {
      setLines([{ ...EMPTY_LINE }]);
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, field, value) => {
    setLines((prev) =>
      prev.map((line, i) => (i === idx ? { ...line, [field]: value } : line)),
    );
  };

  // Handler select existing item from react-select dropdown
  const handleSelectItem = (idx, selectedOption) => {
    if (!selectedOption) {
      updateLine(idx, "item_name", "");
      return;
    }
    updateLine(idx, "item_name", selectedOption.label);
    if (
      selectedOption.price !== undefined &&
      selectedOption.price !== null &&
      selectedOption.price > 0
    ) {
      updateLine(idx, "unit_price", formatThousand(selectedOption.price));
    }
  };

  // Handler auto-create new item directly into Master Items list via interactive modal
  const handleCreateItem = async (idx, inputValue) => {
    const trimmed = (inputValue || "").trim();
    if (!trimmed) return;

    const existingRowPrice = parseRawNumber(lines[idx]?.unit_price);
    const defaultPriceStr =
      existingRowPrice > 0 ? String(existingRowPrice) : "";

    const result = await Swal.fire({
      title: "Tambah Layanan / Item Baru",
      html: `
        <div class="text-left text-xs flex flex-col gap-3 mt-2">
          <div>
            <label class="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
              Nama Item / Layanan <span class="text-rose-500">*</span>
            </label>
            <input id="swal-item-name" class="swal2-input m-0! w-full! text-xs! h-10! rounded-xl! border-slate-300! box-border!" value="${trimmed}" placeholder="Contoh: Jasa Pembuatan Website" />
          </div>
          <div>
            <label class="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
              Harga Standar Satuan <span class="text-rose-500">*</span>
            </label>
            <div class="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white">
              <span class="px-3 py-2 font-bold text-xs text-slate-600 bg-slate-50 border-r border-slate-300 select-none">Rp</span>
              <input
                id="swal-item-price"
                type="text"
                inputmode="numeric"
                class="flex-1 px-3 py-2 border-0 outline-none text-xs font-bold text-slate-900 bg-transparent font-mono"
                value="${formatThousand(defaultPriceStr)}"
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <label class="block text-[11px] font-extrabold uppercase text-slate-600 mb-1">
              Deskripsi Singkat (Opsional)
            </label>
            <textarea id="swal-item-desc" class="swal2-textarea m-0! w-full! text-xs! h-16! rounded-xl! border-slate-300! box-border!" placeholder="Rincian atau spesifikasi layanan..."></textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Simpan & Terapkan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#6366f1",
      cancelButtonColor: "#94a3b8",
      customClass: { popup: "swal-custom-popup" },
      focusConfirm: false,
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      didOpen: () => {
        const priceInput = document.getElementById("swal-item-price");
        if (priceInput) {
          priceInput.addEventListener("input", (e) => {
            const rawNumbers = e.target.value.replace(/[^0-9]/g, "");
            if (!rawNumbers) {
              e.target.value = "";
              return;
            }
            const num = parseInt(rawNumbers, 10);
            e.target.value = new Intl.NumberFormat("id-ID").format(num);
          });
        }
      },
      preConfirm: async () => {
        const nameVal = document
          .getElementById("swal-item-name")
          ?.value?.trim();
        const priceRaw = document.getElementById("swal-item-price")?.value;
        const descVal = document
          .getElementById("swal-item-desc")
          ?.value?.trim();

        if (!nameVal) {
          Swal.showValidationMessage("Nama item / layanan wajib diisi.");
          return false;
        }

        const priceNum = parseRawNumber(priceRaw);

        try {
          Swal.showLoading();
          const res = await api.post("/api/items", {
            name: nameVal,
            price: priceNum,
            description: descVal || null,
          });
          return {
            item: res.data?.item || res.data,
            name: nameVal,
            price: priceNum,
            description: descVal,
          };
        } catch (err) {
          Swal.showValidationMessage(
            err.response?.data?.message || "Gagal menyimpan item ke database.",
          );
          return false;
        }
      },
    });

    if (result.isConfirmed && result.value) {
      const created = result.value.item;
      const finalName = result.value.name;
      const finalPrice = result.value.price;

      // 1. Tambahkan ke master data savedItems
      if (created) {
        setSavedItems((prev) => [
          created,
          ...prev.filter((i) => i.id !== created.id),
        ]);
      }

      // 2. Terapkan langsung ke baris tabel saat ini
      updateLine(idx, "item_name", finalName);
      if (finalPrice > 0) {
        updateLine(idx, "unit_price", formatThousand(finalPrice));
      }

      toast(
        "success",
        `Layanan "${finalName}" berhasil disimpan ke master dan diterapkan!`,
      );
    }
  };

  // Handler input Item Name directly if needed
  const handleItemNameChange = (idx, val) => {
    updateLine(idx, "item_name", val);

    // Auto-fill price if matched in catalog
    const matched = savedItems.find(
      (it) => it.name.toLowerCase().trim() === val.toLowerCase().trim(),
    );
    if (matched && matched.price !== undefined) {
      updateLine(idx, "unit_price", formatThousand(matched.price));
    }
  };

  // Handler input Qty
  const handleQtyChange = (idx, rawVal) => {
    const digits = rawVal.replace(/[^0-9]/g, "");
    updateLine(idx, "quantity", digits ? formatThousand(digits) : "");
  };

  // Handler input Harga Satuan
  const handlePriceChange = (idx, rawVal) => {
    const digits = rawVal.replace(/[^0-9]/g, "");
    updateLine(idx, "unit_price", digits ? formatThousand(digits) : "");
  };

  // ─── Dynamic Calculations ──────────────────────────────────────────────────
  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      const q = parseRawNumber(line.quantity) || 0;
      const p = parseRawNumber(line.unit_price) || 0;
      return sum + q * p;
    }, 0);
  }, [lines]);

  const rawDiscount = parseRawNumber(discountValue) || 0;
  const discountAmt = useMemo(() => {
    if (discountType === "percent") {
      return (subtotal * Math.min(100, Math.max(0, rawDiscount))) / 100;
    }
    return Math.min(subtotal, Math.max(0, rawDiscount));
  }, [discountType, rawDiscount, subtotal]);

  const afterDiscount = Math.max(0, subtotal - discountAmt);
  const taxAmt = (afterDiscount * (parseFloat(taxRate) || 0)) / 100;
  const grandTotal = afterDiscount + taxAmt;

  const rawAmountPaid = useMemo(() => {
    if (paymentOption === "unpaid") return 0;
    if (paymentOption === "paid") return grandTotal;
    const parsed = parseRawNumber(paidAmount);
    return Math.min(grandTotal, Math.max(0, parsed));
  }, [paymentOption, paidAmount, grandTotal]);

  const balanceDue = Math.max(0, grandTotal - rawAmountPaid);

  // ─── Submit Handler ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!clientId) {
      toast("error", "Pilih klien tujuan invoice terlebih dahulu");
      setActiveTab("form");
      return;
    }

    const validLines = lines.filter(
      (l) =>
        l.item_name.trim() &&
        parseRawNumber(l.quantity) > 0 &&
        parseRawNumber(l.unit_price) >= 0,
    );

    if (validLines.length === 0) {
      toast(
        "error",
        "Masukkan minimal 1 item dengan nama, jumlah, dan harga satuan yang valid",
      );
      setActiveTab("form");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        issue_date: issueDate,
        due_date: dueDate || null,
        tax_rate: parseFloat(taxRate) || 0,
        discount: discountAmt,
        amount_paid: rawAmountPaid,
        payment_date: rawAmountPaid > 0 && paymentDate ? paymentDate : null,
        items: validLines.map((l) => ({
          item_name: l.item_name.trim(),
          quantity: parseRawNumber(l.quantity) || 1,
          unit_price: parseRawNumber(l.unit_price) || 0,
        })),
      };

      if (mode === "create") {
        const res = await api.post("/api/invoices", payload);
        toast("success", "Invoice draft berhasil dibuat!");
        const newId = res.data?.invoice?.id || res.data?.id;
        if (newId) {
          router.push(`/dashboard/invoices/${newId}`);
        } else {
          router.push("/dashboard/invoices");
        }
      } else {
        await api.put(`/api/invoices/${invoiceId}`, payload);
        toast("success", "Invoice berhasil diperbarui!");
        router.push(`/dashboard/invoices/${invoiceId}`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Gagal menyimpan invoice";
      if (err.response?.status === 403 && err.response?.data?.tier_limit) {
        Swal.fire({
          icon: "warning",
          title: "Batas Kuota Tercapai",
          text: msg,
          confirmButtonText: "Upgrade ke PRO",
          confirmButtonColor: "#6366f1",
          showCancelButton: true,
          cancelButtonText: "Tutup",
        }).then((res) => {
          if (res.isConfirmed) router.push("/dashboard/subscription");
        });
      } else {
        toast("error", msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto pb-16 px-3 sm:px-6">
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/invoices"
              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-xs"
              title="Kembali ke Daftar Invoice"
              aria-label="Kembali ke Daftar Invoice"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {mode === "create"
                ? "Buat Invoice Baru"
                : `Edit Invoice #${initialData?.invoice_number || ""}`}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 pl-11">
            {mode === "create"
              ? "Isi formulir transaksi di bawah ini dengan live preview otomatis."
              : "Perbarui rincian draf invoice Anda secara langsung."}
          </p>
        </div>

        {/* Single Primary Action Button (Top Header) */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center justify-center min-h-11 px-3.5 sm:px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition"
          >
            Batal
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center justify-center min-h-11 gap-2 px-4 sm:px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs sm:text-sm font-bold shadow-xs transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{" "}
                Menyimpan...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {mode === "edit" ? "Simpan Perubahan" : "Buat Invoice"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile Tab Switcher (< 768px) ───────────────────────────── */}
      <div className="md:hidden flex items-center p-1 mb-5 rounded-xl bg-slate-100 border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("form")}
          className={`flex-1 min-h-11 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === "form"
              ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span>Formulir Invoice</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`flex-1 min-h-11 py-2 px-3 rounded-lg text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === "preview"
              ? "bg-white text-indigo-700 shadow-xs border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Live Preview</span>
          <span className="ml-1 text-[11px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
            {formatRupiah(rawAmountPaid > 0 ? balanceDue : grandTotal)}
          </span>
        </button>
      </div>

      {/* ── Responsive Split-Screen Layout (Grid md:grid-cols-12) ───── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* ═══════════════════════════════════════════════════════════════════
            LEFT PANE: INPUT FORM (Full on Mobile if tab='form', 6/12 on md, 7/12 on lg)
           ═══════════════════════════════════════════════════════════════════ */}
        <div
          className={`md:col-span-6 lg:col-span-7 flex flex-col gap-6 ${
            activeTab === "form" ? "block" : "hidden md:block"
          }`}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {/* 1. Client & Dates Information Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-indigo-600" />
                <span>Informasi Klien & Tanggal</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Client Select */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Klien Penerima Tagihan{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  {isMounted ? (
                    <CreatableSelect
                      instanceId="client-select"
                      isClearable
                      placeholder="Cari atau pilih klien terdaftar..."
                      options={clientOptions}
                      value={
                        selectedClient
                          ? {
                              value: selectedClient.id,
                              label: selectedClient.name,
                              email: selectedClient.email,
                            }
                          : null
                      }
                      onChange={(selected) =>
                        setClientId(selected ? selected.value : "")
                      }
                      formatOptionLabel={(option) => (
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">
                            {option.label}
                          </span>
                          {option.email && (
                            <span className="text-xs text-slate-400 font-medium">
                              {option.email}
                            </span>
                          )}
                        </div>
                      )}
                      styles={customSelectStyles}
                      menuPortalTarget={
                        typeof document !== "undefined" ? document.body : null
                      }
                      menuPosition="fixed"
                      noOptionsMessage={() => "Klien tidak ditemukan"}
                    />
                  ) : (
                    <select
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all min-h-11"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      required
                    >
                      <option value="">Pilih Klien Terdaftar</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.email ? `(${c.email})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                  {clients.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1.5">
                      Belum ada klien terdaftar.{" "}
                      <Link
                        href="/dashboard/clients"
                        className="text-indigo-600 font-bold hover:underline"
                      >
                        + Tambah Klien Baru
                      </Link>
                    </p>
                  )}
                </div>

                {/* Issue Date */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Tanggal Terbit</span>{" "}
                    <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Jatuh Tempo</span>
                  </label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all"
                    value={dueDate}
                    min={issueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 2. Responsive Inline Editable Table for Invoice Items */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Rincian Item & Layanan</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ketik langsung pada tabel untuk mengubah nama, jumlah, atau
                    harga satuan.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center justify-center min-h-11 gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition border border-indigo-200 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris</span>
                </button>
              </div>

              {/* Inline Editable Table Container */}
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-slate-50/50">
                <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-135">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                      <th className="py-2.5 px-3 w-[46%]">
                        Nama Item / Layanan
                      </th>
                      <th className="py-2.5 px-2 text-center w-[14%]">Qty</th>
                      <th className="py-2.5 px-2 text-right w-[24%]">
                        Harga Satuan
                      </th>
                      <th className="py-2.5 px-3 text-right w-[16%]">Total</th>
                      <th className="py-2.5 px-2 w-10 text-center" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 bg-white">
                    {lines.map((line, idx) => {
                      const lineTotal =
                        (parseRawNumber(line.quantity) || 0) *
                        (parseRawNumber(line.unit_price) || 0);

                      return (
                        <tr
                          key={idx}
                          className="hover:bg-indigo-50/20 transition-colors"
                        >
                          {/* Item Name (React Select Creatable with Auto-Save) */}
                          <td className="p-2 min-w-50">
                            {isMounted ? (
                              <CreatableSelect
                                instanceId={`line-item-select-${idx}`}
                                isClearable
                                placeholder="Pilih / ketik layanan..."
                                options={itemOptions}
                                value={
                                  line.item_name
                                    ? {
                                        value: line.item_name,
                                        label: line.item_name,
                                      }
                                    : null
                                }
                                onChange={(selected) =>
                                  handleSelectItem(idx, selected)
                                }
                                onCreateOption={(val) =>
                                  handleCreateItem(idx, val)
                                }
                                formatCreateLabel={(inputValue) =>
                                  `+ Tambah "${inputValue}" ke Master Layanan`
                                }
                                formatOptionLabel={(option) => (
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-800">
                                      {option.label}
                                    </span>
                                    {option.price !== undefined &&
                                      option.price !== null &&
                                      option.price > 0 && (
                                        <span className="text-[11px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded font-bold">
                                          {formatRupiah(option.price)}
                                        </span>
                                      )}
                                  </div>
                                )}
                                styles={customSelectStyles}
                                menuPortalTarget={
                                  typeof document !== "undefined"
                                    ? document.body
                                    : null
                                }
                                menuPosition="fixed"
                              />
                            ) : (
                              <input
                                type="text"
                                className="w-full px-2.5 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-200 bg-white"
                                placeholder="Nama produk/jasa..."
                                value={line.item_name}
                                onChange={(e) =>
                                  handleItemNameChange(idx, e.target.value)
                                }
                              />
                            )}
                          </td>

                          {/* Quantity */}
                          <td className="p-2">
                            <input
                              type="text"
                              inputMode="numeric"
                              className="w-full px-2 py-2 text-xs sm:text-sm font-bold text-center rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-mono bg-white"
                              placeholder="1"
                              value={line.quantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) =>
                                handleQtyChange(idx, e.target.value)
                              }
                              required
                            />
                          </td>

                          {/* Unit Price */}
                          <td className="p-2">
                            <div className="relative flex items-center">
                              <span className="absolute left-2.5 text-[11px] font-bold text-slate-400 select-none">
                                Rp
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="w-full pl-8 pr-2.5 py-2 text-xs sm:text-sm font-bold text-right rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-mono bg-white"
                                placeholder="0"
                                value={line.unit_price}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) =>
                                  handlePriceChange(idx, e.target.value)
                                }
                                required
                              />
                            </div>
                          </td>

                          {/* Calculated Line Subtotal */}
                          <td className="p-2 text-right">
                            <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm block">
                              {formatRupiah(lineTotal)}
                            </span>
                          </td>

                          {/* Delete Action */}
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Hapus baris item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Add Row Button */}
              <button
                type="button"
                onClick={addLine}
                className="w-full mt-3 py-2 px-4 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50 text-indigo-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Baris Item Baru</span>
              </button>
            </div>

            {/* 3. Adjustments (Discount, Tax, Notes) Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2 mb-4">
                <Percent className="w-4 h-4 text-indigo-600" />
                <span>Diskon, Pajak & Catatan</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Discount */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Potongan Diskon
                    </label>
                    <div className="flex rounded-lg p-0.5 bg-slate-100 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType("fixed");
                          setDiscountValue("");
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                          discountType === "fixed"
                            ? "bg-white text-indigo-600 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Rp
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType("percent");
                          setDiscountValue("");
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                          discountType === "percent"
                            ? "bg-white text-indigo-600 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">
                      {discountType === "fixed" ? "Rp" : "%"}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="w-full px-3.5 pl-9 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-mono font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all"
                      placeholder="0"
                      value={discountValue}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        if (discountType === "percent") {
                          const digits = e.target.value.replace(/[^0-9.]/g, "");
                          if (parseFloat(digits) > 100) setDiscountValue("100");
                          else setDiscountValue(digits);
                        } else {
                          const digits = e.target.value.replace(/[^0-9]/g, "");
                          setDiscountValue(formatThousand(digits));
                        }
                      }}
                    />
                  </div>
                  {discountAmt > 0 && (
                    <p className="text-xs text-rose-600 font-semibold mt-1">
                      − {formatRupiah(discountAmt)}
                    </p>
                  )}
                </div>

                {/* Tax */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Pajak PPN (%)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">
                      %
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="w-full px-3.5 pl-8 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-mono font-bold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all"
                      placeholder="0"
                      value={taxRate}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^0-9.]/g, "");
                        if (parseFloat(cleaned) > 100) setTaxRate("100");
                        else setTaxRate(cleaned);
                      }}
                    />
                  </div>
                  {taxAmt > 0 && (
                    <p className="text-xs text-indigo-600 font-semibold mt-1">
                      + {formatRupiah(taxAmt)} ({taxRate}%)
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Catatan / Syarat Pembayaran (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs sm:text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all resize-none"
                    placeholder="Contoh: Pembayaran jatuh tempo 14 hari setelah invoice diterbitkan..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 4. Previous Payment / DP Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <span>Status & Riwayat Pembayaran Sebelumnya</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Catat status pelunasan atau pembayaran uang muka (DP) yang telah diterima sebelumnya.
                  </p>
                </div>
              </div>

              {/* Status Payment Tabs Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl mb-4 border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentOption("unpaid");
                    setPaidAmount("");
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    paymentOption === "unpaid"
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  <span>Belum Dibayar</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentOption("dp");
                    if (!paidAmount || parseRawNumber(paidAmount) === 0) {
                      setPaidAmount(formatThousand(Math.round(grandTotal * 0.5)));
                    }
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    paymentOption === "dp"
                      ? "bg-white text-amber-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Uang Muka (DP) / Sebagian</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPaymentOption("paid");
                    setPaidAmount(formatThousand(grandTotal));
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    paymentOption === "paid"
                      ? "bg-white text-emerald-700 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Sudah Lunas</span>
                </button>
              </div>

              {/* Conditional Form Controls depending on paymentOption */}
              {paymentOption === "dp" && (
                <div className="p-4 bg-amber-50/50 border border-amber-200/70 rounded-xl mb-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Input Nominal DP / Pembayaran Sebelumnya */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Jumlah Yang Sudah Dibayar / DP <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[11px] font-mono font-semibold text-amber-700">
                          {grandTotal > 0 && rawAmountPaid > 0
                            ? `(${Math.round((rawAmountPaid / grandTotal) * 100)}% dari total)`
                            : ""}
                        </span>
                      </div>
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-xs font-bold text-slate-400">
                          Rp
                        </span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="w-full px-3.5 pl-9 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-mono font-bold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all"
                          placeholder="0"
                          value={paidAmount}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/[^0-9]/g, "");
                            setPaidAmount(digits ? formatThousand(digits) : "");
                          }}
                        />
                      </div>
                      {/* Shortcut Quick Percent buttons */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[10px] font-bold text-slate-400">Cepat:</span>
                        {[25, 30, 50, 75].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() =>
                              setPaidAmount(
                                formatThousand(Math.round((grandTotal * pct) / 100))
                              )
                            }
                            className="px-2 py-0.5 rounded-md bg-white border border-amber-200 text-amber-800 text-[10px] font-bold hover:bg-amber-100 transition shadow-2xs"
                          >
                            DP {pct}%
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Input Tanggal Pembayaran DP */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                        Tanggal Pembayaran / DP Diterima
                      </label>
                      <div className="relative flex items-center">
                        <Calendar className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="date"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs sm:text-sm font-semibold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-100 transition-all"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        Tanggal saat uang muka / pembayaran awal diterima dari klien.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {paymentOption === "paid" && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl mb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div>
                      <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs sm:text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Status Invoice: Lunas Penuh</span>
                      </div>
                      <p className="text-xs text-emerald-700 mt-1">
                        Klien telah melunasi tagihan penuh sejumlah{" "}
                        <b className="font-mono text-emerald-900">{formatRupiah(grandTotal)}</b>.
                      </p>
                    </div>

                    {/* Input Tanggal Pelunasan */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1.5">
                        Tanggal Pelunasan / Pembayaran
                      </label>
                      <div className="relative flex items-center">
                        <Calendar className="absolute left-3 w-4 h-4 text-emerald-600 pointer-events-none" />
                        <input
                          type="date"
                          className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border border-emerald-300 text-slate-900 text-xs sm:text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition-all"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Calculation Breakdown Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Total Tagihan
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                    {formatRupiah(grandTotal)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Sudah Dibayar / DP
                  </span>
                  <span className="font-mono font-bold text-emerald-700 text-sm mt-0.5">
                    {formatRupiah(rawAmountPaid)}
                  </span>
                  {rawAmountPaid > 0 && paymentDate && (
                    <span className="text-[10px] text-slate-500 font-medium">
                      Tgl: {formatDateDisplay(paymentDate, lang)}
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:border-l sm:border-slate-200 sm:pl-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Sisa Tagihan (Saldo)
                  </span>
                  <span
                    className={`font-mono font-black text-sm mt-0.5 ${
                      balanceDue <= 0 ? "text-emerald-600" : "text-amber-700"
                    }`}
                  >
                    {formatRupiah(balanceDue)}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {balanceDue <= 0 ? "✓ Lunas" : "Harus dilunasi klien"}
                  </span>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT PANE: REAL-TIME LIVE PREVIEW (Sticky on Desktop, Tab on Mobile)
           ═══════════════════════════════════════════════════════════════════ */}
        <div
          className={`md:col-span-6 lg:col-span-5 md:sticky md:top-6 flex flex-col gap-4 ${
            activeTab === "preview" ? "block" : "hidden md:block"
          }`}
        >
          {/* Live Preview Document Card */}
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden text-slate-800">
            {/* Live Indicator Banner */}
            <div className="bg-linear-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white px-5 py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="font-extrabold uppercase tracking-wider text-[11px]">
                  Real-time Live Preview
                </span>
              </div>
              <span className="font-mono text-emerald-300 font-bold text-xs">
                {rawAmountPaid > 0 && balanceDue <= 0
                  ? "LUNAS (Rp 0)"
                  : formatRupiah(rawAmountPaid > 0 ? balanceDue : grandTotal)}
              </span>
            </div>

            {/* Document Body */}
            <div className="p-6 sm:p-7 flex flex-col gap-6 text-xs sm:text-sm">
              {/* 1. Header (Logo & Business Info) */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  {userProfile?.logo_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={userProfile.logo_url}
                      alt="Logo Bisnis"
                      className="max-h-11 max-w-30 object-contain"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                      {userProfile?.business_name || "SnapBill Business"}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {userProfile?.email || "vendor@snapbill.id"}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      rawAmountPaid >= grandTotal && grandTotal > 0
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : rawAmountPaid > 0
                          ? "bg-amber-100 text-amber-800 border border-amber-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {rawAmountPaid >= grandTotal && grandTotal > 0
                      ? "LUNAS (PAID)"
                      : rawAmountPaid > 0
                        ? "DP / SEBAGIAN"
                        : mode === "edit"
                          ? "DRAFT"
                          : "NEW INVOICE"}
                  </span>
                  <p className="text-xs font-mono font-extrabold text-indigo-700 mt-1">
                    #{initialData?.invoice_number || "INV-PREVIEW"}
                  </p>
                </div>
              </div>

              {/* 2. Client & Invoice Meta Details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">
                    Ditagihkan Kepada:
                  </span>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">
                    {selectedClient?.name || "(Belum Memilih Klien)"}
                  </p>
                  {selectedClient?.email && (
                    <p className="text-slate-500 mt-0.5">
                      {selectedClient.email}
                    </p>
                  )}
                  {selectedClient?.phone && (
                    <p className="text-slate-500">{selectedClient.phone}</p>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">
                    Jadwal Tagihan:
                  </span>
                  <p className="text-slate-700">
                    Terbit:{" "}
                    <b className="text-slate-900">
                      {formatDateDisplay(issueDate, lang)}
                    </b>
                  </p>
                  <p className="text-slate-700 mt-0.5">
                    Jatuh Tempo:{" "}
                    <b className="text-slate-900">
                      {formatDateDisplay(dueDate, lang)}
                    </b>
                  </p>
                </div>
              </div>

              {/* 3. Items Breakdown Table */}
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-[10px] font-extrabold uppercase text-slate-500">
                      <th className="py-2 px-3">Item</th>
                      <th className="py-2 px-1 text-center">Qty</th>
                      <th className="py-2 px-2 text-right">Harga</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lines.map((line, idx) => {
                      const lineTotal =
                        (parseRawNumber(line.quantity) || 0) *
                        (parseRawNumber(line.unit_price) || 0);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {line.item_name || (
                              <span className="text-slate-300 italic">
                                Item tanpa nama
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-1 text-center font-mono text-slate-600">
                            {line.quantity || "0"}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-slate-600">
                            {formatRupiah(parseRawNumber(line.unit_price))}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatRupiah(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 4. Financial Calculations Summary */}
              <div className="flex justify-end pt-2">
                <div className="w-full sm:w-64 flex flex-col gap-1.5 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {formatRupiah(subtotal)}
                    </span>
                  </div>

                  {discountAmt > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>
                        Diskon{" "}
                        {discountType === "percent"
                          ? `(${discountValue}%)`
                          : ""}
                      </span>
                      <span className="font-mono font-bold">
                        − {formatRupiah(discountAmt)}
                      </span>
                    </div>
                  )}

                  {taxAmt > 0 && (
                    <div className="flex justify-between text-indigo-600">
                      <span>Pajak ({taxRate}%)</span>
                      <span className="font-mono font-bold">
                        + {formatRupiah(taxAmt)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-xs sm:text-sm font-bold text-slate-700 pt-2 border-t border-slate-200 mt-1">
                    <span>Total Tagihan</span>
                    <span className="font-mono text-slate-900">
                      {formatRupiah(grandTotal)}
                    </span>
                  </div>

                  {rawAmountPaid > 0 && (
                    <div className="flex justify-between text-xs text-emerald-700">
                      <div>
                        <span className="font-semibold">Sudah Dibayar / DP</span>
                        {paymentDate && (
                          <span className="block text-[10px] text-slate-500 font-normal">
                            Tgl: {formatDateDisplay(paymentDate, lang)}
                          </span>
                        )}
                      </div>
                      <span className="font-mono font-bold">
                        − {formatRupiah(rawAmountPaid)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm sm:text-base font-black text-slate-900 pt-2 border-t-2 border-dashed border-slate-300 mt-1">
                    <span>Sisa Tagihan (Saldo)</span>
                    <span
                      className={`font-mono ${
                        balanceDue <= 0 ? "text-emerald-600" : "text-amber-600"
                      }`}
                    >
                      {formatRupiah(balanceDue)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Notes in Preview if present */}
              {notes && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900">
                  <b className="block text-[11px] font-bold uppercase text-amber-800 mb-0.5">
                    Catatan:
                  </b>
                  <p className="whitespace-pre-line text-slate-700">{notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
