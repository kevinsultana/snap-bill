'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Swal from 'sweetalert2';
import api from '@/lib/api';
import toast from '@/lib/toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
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
  Sparkles,
  ArrowLeft,
} from 'lucide-react';

// Helper pemformat ribuan (e.g. 1000000 -> "1.000.000")
function formatThousand(val) {
  if (val === undefined || val === null || val === '') return '';
  const str = String(val).replace(/[^0-9]/g, '');
  if (!str) return '';
  return str.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Helper pengurai angka (e.g. "1.000.000" -> 1000000)
function parseRawNumber(val) {
  if (val === undefined || val === null || val === '') return 0;
  const str = String(val).replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function formatRupiah(value) {
  if (!value && value !== 0) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(value));
}

function toDateInput(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
}

function formatDateDisplay(dateStr, lang = 'id') {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const EMPTY_LINE = { item_name: '', quantity: '1', unit_price: '' };

/**
 * InvoiceForm — Split-Screen Desktop & Tabbed Mobile Layout
 * with Real-time Inline Spreadsheet Editing and Live Preview
 */
export default function InvoiceForm({ mode = 'create', invoiceId, initialData }) {
  const router = useRouter();
  const { t, lang } = useTranslation();

  // Mobile Tab state ('form' | 'preview')
  const [activeTab, setActiveTab] = useState('form');

  // Master data state
  const [clients, setClients] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [clientId, setClientId] = useState(initialData?.client_id || '');
  const [issueDate, setIssueDate] = useState(toDateInput(initialData?.issue_date) || toDateInput(new Date()));
  const [dueDate, setDueDate] = useState(toDateInput(initialData?.due_date) || '');
  const [taxRate, setTaxRate] = useState(initialData?.tax_rate ? String(initialData.tax_rate) : '');
  const [discountType, setDiscountType] = useState('fixed'); // 'fixed' (Rp) | 'percent' (%)
  const [discountValue, setDiscountValue] = useState(
    initialData?.discount ? formatThousand(initialData.discount) : ''
  );
  const [notes, setNotes] = useState(initialData?.notes || '');

  // Line items state
  const [lines, setLines] = useState(
    initialData?.items?.length
      ? initialData.items.map((it) => ({
          item_name: it.item_name || '',
          quantity: formatThousand(it.quantity) || '1',
          unit_price: formatThousand(it.unit_price) || '',
        }))
      : [{ ...EMPTY_LINE }]
  );

  // Load clients, saved items, and user profile settings
  useEffect(() => {
    api.get('/api/clients').then((r) => setClients(r.data || [])).catch(() => {});
    api.get('/api/items').then((r) => setSavedItems(r.data || [])).catch(() => {});
    api.get('/api/settings').then((r) => setUserProfile(r.data || {})).catch(() => {});
  }, []);

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
      prev.map((line, i) => (i === idx ? { ...line, [field]: value } : line))
    );
  };

  // Handler input Item Name with catalog auto-match
  const handleItemNameChange = (idx, val) => {
    updateLine(idx, 'item_name', val);

    // Auto-fill price if matched in catalog
    const matched = savedItems.find(
      (it) => it.name.toLowerCase().trim() === val.toLowerCase().trim()
    );
    if (matched && matched.price !== undefined) {
      updateLine(idx, 'unit_price', formatThousand(matched.price));
    }
  };

  // Handler input Qty
  const handleQtyChange = (idx, rawVal) => {
    const digits = rawVal.replace(/[^0-9]/g, '');
    updateLine(idx, 'quantity', digits ? formatThousand(digits) : '');
  };

  // Handler input Harga Satuan
  const handlePriceChange = (idx, rawVal) => {
    const digits = rawVal.replace(/[^0-9]/g, '');
    updateLine(idx, 'unit_price', digits ? formatThousand(digits) : '');
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
    if (discountType === 'percent') {
      return (subtotal * Math.min(100, Math.max(0, rawDiscount))) / 100;
    }
    return Math.min(subtotal, Math.max(0, rawDiscount));
  }, [discountType, rawDiscount, subtotal]);

  const afterDiscount = Math.max(0, subtotal - discountAmt);
  const taxAmt = (afterDiscount * (parseFloat(taxRate) || 0)) / 100;
  const grandTotal = afterDiscount + taxAmt;

  // ─── Submit Handler ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (!clientId) {
      toast('error', 'Pilih klien tujuan invoice terlebih dahulu');
      setActiveTab('form');
      return;
    }

    const validLines = lines.filter(
      (l) => l.item_name.trim() && parseRawNumber(l.quantity) > 0 && parseRawNumber(l.unit_price) >= 0
    );

    if (validLines.length === 0) {
      toast('error', 'Masukkan minimal 1 item dengan nama, jumlah, dan harga satuan yang valid');
      setActiveTab('form');
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
        items: validLines.map((l) => ({
          item_name: l.item_name.trim(),
          quantity: parseRawNumber(l.quantity) || 1,
          unit_price: parseRawNumber(l.unit_price) || 0,
        })),
      };

      if (mode === 'create') {
        const res = await api.post('/api/invoices', payload);
        toast('success', 'Invoice draft berhasil dibuat!');
        const newId = res.data?.invoice?.id || res.data?.id;
        if (newId) {
          router.push(`/dashboard/invoices/${newId}`);
        } else {
          router.push('/dashboard/invoices');
        }
      } else {
        await api.put(`/api/invoices/${invoiceId}`, payload);
        toast('success', 'Invoice berhasil diperbarui!');
        router.push(`/dashboard/invoices/${invoiceId}`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Gagal menyimpan invoice';
      if (err.response?.status === 403 && err.response?.data?.tier_limit) {
        Swal.fire({
          icon: 'warning',
          title: 'Batas Kuota Tercapai',
          text: msg,
          confirmButtonText: 'Upgrade ke PRO ⚡',
          confirmButtonColor: '#6366f1',
          showCancelButton: true,
          cancelButtonText: 'Tutup',
        }).then((res) => {
          if (res.isConfirmed) router.push('/dashboard/subscription');
        });
      } else {
        toast('error', msg);
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
              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-sm"
              title="Kembali ke Daftar Invoice"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {mode === 'create' ? 'Buat Invoice Baru' : `Edit Invoice #${initialData?.invoice_number || ''}`}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 pl-11">
            {mode === 'create'
              ? 'Isi formulir transaksi di bawah ini dengan live preview otomatis.'
              : 'Perbarui rincian draf invoice Anda secara langsung.'}
          </p>
        </div>

        {/* Action Buttons (Desktop Header) */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/dashboard/invoices" className="btn-secondary text-sm px-4 py-2">
            Batal
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 shadow-md"
          >
            {saving ? (
              <>
                <span className="btn-spinner" /> Menyimpan...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {mode === 'edit' ? 'Simpan Perubahan' : 'Simpan Draf Invoice'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile Tab Switcher (< 768px) ───────────────────────────── */}
      <div className="md:hidden flex items-center p-1.5 mb-5 rounded-2xl bg-slate-200/70 backdrop-blur-sm border border-slate-300/60 shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab('form')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'form'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span>Formulir Invoice</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 ${
            activeTab === 'preview'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>Live Preview</span>
          <span className="ml-1 text-[11px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
            {formatRupiah(grandTotal)}
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
            activeTab === 'form' ? 'block' : 'hidden md:block'
          }`}
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">

            {/* 1. Client & Dates Information Card */}
            <div className="glass-card p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-indigo-600" />
                <span>Informasi Klien & Tanggal</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Client Select */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Klien Penerima Tagihan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    className="form-input w-full"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                  >
                    <option value="">— Pilih Klien Terdaftar —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.email ? `(${c.email})` : ''}
                      </option>
                    ))}
                  </select>
                  {clients.length === 0 && (
                    <p className="text-xs text-slate-500 mt-1.5">
                      Belum ada klien terdaftar.{' '}
                      <Link href="/dashboard/clients" className="text-indigo-600 font-bold hover:underline">
                        + Tambah Klien Baru
                      </Link>
                    </p>
                  )}
                </div>

                {/* Issue Date */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Tanggal Terbit</span> <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-input w-full text-sm font-semibold"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Jatuh Tempo</span>
                  </label>
                  <input
                    type="date"
                    className="form-input w-full text-sm font-semibold"
                    value={dueDate}
                    min={issueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* 2. Responsive Inline Editable Table for Invoice Items */}
            <div className="glass-card p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-indigo-600" />
                    <span>Rincian Item & Layanan</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ketik langsung pada tabel untuk mengubah nama, jumlah, atau harga satuan.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addLine}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition border border-indigo-200/60 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris</span>
                </button>
              </div>

              {/* Datalist for catalog autocomplete */}
              <datalist id="catalog-item-suggestions">
                {savedItems.map((item) => (
                  <option key={item.id} value={item.name}>
                    Rp {formatThousand(item.price)}
                  </option>
                ))}
              </datalist>

              {/* Inline Editable Table Container */}
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-slate-50/50">
                <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[520px]">
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                      <th className="py-2.5 px-3 w-[44%]">Nama Item / Layanan</th>
                      <th className="py-2.5 px-2 text-center w-[16%]">Qty</th>
                      <th className="py-2.5 px-2 text-right w-[24%]">Harga Satuan</th>
                      <th className="py-2.5 px-3 text-right w-[16%]">Total</th>
                      <th className="py-2.5 px-2 w-[40px] text-center" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 bg-white">
                    {lines.map((line, idx) => {
                      const lineTotal =
                        (parseRawNumber(line.quantity) || 0) * (parseRawNumber(line.unit_price) || 0);

                      return (
                        <tr key={idx} className="hover:bg-indigo-50/20 transition-colors">
                          {/* Item Name (Direct typing with autocomplete datalist) */}
                          <td className="p-2">
                            <input
                              type="text"
                              list="catalog-item-suggestions"
                              className="w-full px-2.5 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white"
                              placeholder="Nama produk/jasa..."
                              value={line.item_name}
                              onChange={(e) => handleItemNameChange(idx, e.target.value)}
                              required
                            />
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
                              onChange={(e) => handleQtyChange(idx, e.target.value)}
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
                                onChange={(e) => handlePriceChange(idx, e.target.value)}
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
            <div className="glass-card p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-sm">
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
                          setDiscountType('fixed');
                          setDiscountValue('');
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                          discountType === 'fixed'
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Rp
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscountType('percent');
                          setDiscountValue('');
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                          discountType === 'percent'
                            ? 'bg-white text-indigo-600 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>

                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-bold text-slate-400">
                      {discountType === 'fixed' ? 'Rp' : '%'}
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-input w-full pl-9 text-sm font-mono font-bold"
                      placeholder="0"
                      value={discountValue}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        if (discountType === 'percent') {
                          const digits = e.target.value.replace(/[^0-9.]/g, '');
                          if (parseFloat(digits) > 100) setDiscountValue('100');
                          else setDiscountValue(digits);
                        } else {
                          const digits = e.target.value.replace(/[^0-9]/g, '');
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
                    <span className="absolute left-3 text-xs font-bold text-slate-400">%</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="form-input w-full pl-8 text-sm font-mono font-bold"
                      placeholder="0"
                      value={taxRate}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                        if (parseFloat(cleaned) > 100) setTaxRate('100');
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
                    className="form-input w-full text-xs sm:text-sm py-2"
                    placeholder="Contoh: Pembayaran jatuh tempo 14 hari setelah invoice diterbitkan..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Mobile Submit Button (Bottom of Form) */}
            <div className="md:hidden flex flex-col gap-3">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-md"
              >
                {saving ? (
                  <>
                    <span className="btn-spinner" /> Menyimpan...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {mode === 'edit' ? 'Simpan Perubahan' : 'Simpan Draf Invoice'}
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            RIGHT PANE: REAL-TIME LIVE PREVIEW (Sticky on Desktop, Tab on Mobile)
           ═══════════════════════════════════════════════════════════════════ */}
        <div
          className={`md:col-span-6 lg:col-span-5 md:sticky md:top-6 flex flex-col gap-4 ${
            activeTab === 'preview' ? 'block' : 'hidden md:block'
          }`}
        >
          {/* Live Preview Document Card */}
          <div className="rounded-3xl bg-white border border-slate-200/90 shadow-xl overflow-hidden text-slate-800">

            {/* Live Indicator Banner */}
            <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white px-5 py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="font-extrabold uppercase tracking-wider text-[11px]">Real-time Live Preview</span>
              </div>
              <span className="font-mono text-emerald-300 font-bold text-xs">
                {formatRupiah(grandTotal)}
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
                      className="max-h-11 max-w-[120px] object-contain"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      ⚡
                    </div>
                  )}
                  <div>
                    <h3 className="font-black text-slate-900 text-sm sm:text-base leading-tight">
                      {userProfile?.business_name || 'SnapBill Business'}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {userProfile?.email || 'vendor@snapbill.id'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                    {mode === 'edit' ? 'DRAFT' : 'NEW INVOICE'}
                  </span>
                  <p className="text-xs font-mono font-extrabold text-indigo-700 mt-1">
                    #{initialData?.invoice_number || 'INV-PREVIEW'}
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
                    {selectedClient?.name || '— Belum Memilih Klien —'}
                  </p>
                  {selectedClient?.email && <p className="text-slate-500 mt-0.5">{selectedClient.email}</p>}
                  {selectedClient?.phone && <p className="text-slate-500">{selectedClient.phone}</p>}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">
                    Jadwal Tagihan:
                  </span>
                  <p className="text-slate-700">
                    Terbit: <b className="text-slate-900">{formatDateDisplay(issueDate, lang)}</b>
                  </p>
                  <p className="text-slate-700 mt-0.5">
                    Jatuh Tempo: <b className="text-slate-900">{formatDateDisplay(dueDate, lang)}</b>
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
                        (parseRawNumber(line.quantity) || 0) * (parseRawNumber(line.unit_price) || 0);

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {line.item_name || <span className="text-slate-300 italic">Item tanpa nama</span>}
                          </td>
                          <td className="py-2.5 px-1 text-center font-mono text-slate-600">
                            {line.quantity || '0'}
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
                    <span className="font-mono font-semibold text-slate-800">{formatRupiah(subtotal)}</span>
                  </div>

                  {discountAmt > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>Diskon {discountType === 'percent' ? `(${discountValue}%)` : ''}</span>
                      <span className="font-mono font-bold">− {formatRupiah(discountAmt)}</span>
                    </div>
                  )}

                  {taxAmt > 0 && (
                    <div className="flex justify-between text-indigo-600">
                      <span>Pajak ({taxRate}%)</span>
                      <span className="font-mono font-bold">+ {formatRupiah(taxAmt)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm sm:text-base font-black text-slate-900 pt-2 border-t border-slate-200 mt-1">
                    <span>Total Pembayaran</span>
                    <span className="font-mono text-emerald-600">{formatRupiah(grandTotal)}</span>
                  </div>
                </div>
              </div>

              {/* 5. Notes in Preview if present */}
              {notes && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900">
                  <b className="block text-[11px] font-bold uppercase text-amber-800 mb-0.5">Catatan:</b>
                  <p className="whitespace-pre-line text-slate-700">{notes}</p>
                </div>
              )}

            </div>
          </div>

          {/* Quick Submit inside Preview (Mobile & Desktop) */}
          <div className="glass-card p-4 rounded-2xl bg-white/90 border border-slate-200 shadow-sm flex items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-400 block font-semibold">Total Tagihan</span>
              <p className="text-lg font-black text-emerald-600 font-mono">{formatRupiah(grandTotal)}</p>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary text-xs sm:text-sm px-4 py-2.5 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="btn-spinner" /> Menyimpan...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {mode === 'edit' ? 'Simpan' : 'Buat Invoice'}
                </>
              )}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
