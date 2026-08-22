'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CreatableSelect from 'react-select/creatable';
import Swal from 'sweetalert2';
import api from '@/lib/api';
import toast from '@/lib/toast';

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
  if (!value && value !== 0) return '';
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

const customSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: '42px',
    background: 'rgba(255, 255, 255, 0.9)',
    borderColor: state.isFocused ? '#6366f1' : '#cbd5e1',
    borderRadius: '12px',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(99, 102, 241, 0.2)' : 'none',
    '&:hover': { borderColor: '#94a3b8' },
    fontSize: '13.5px',
    fontFamily: 'inherit',
  }),
  menu: (base) => ({
    ...base,
    background: 'rgba(255, 255, 255, 0.98)',
    backdropFilter: 'blur(12px)',
    borderRadius: '12px',
    boxShadow: '0 12px 30px rgba(15, 23, 42, 0.15)',
    border: '1px solid #e2e8f0',
    zIndex: 9999,
    fontSize: '13px',
  }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? '#6366f1'
      : state.isFocused
        ? '#f1f5f9'
        : 'transparent',
    color: state.isSelected ? '#ffffff' : '#1e293b',
    cursor: 'pointer',
    padding: '10px 14px',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#94a3b8',
    fontSize: '13px',
  }),
  singleValue: (base) => ({
    ...base,
    color: '#0f172a',
    fontWeight: 600,
  }),
};

const EMPTY_LINE = { item_name: '', quantity: '1', unit_price: '' };

/**
 * InvoiceForm — shared between Create and Edit pages.
 * 2-Column Responsive Liquid Glassmorphism Layout
 */
export default function InvoiceForm({ mode = 'create', invoiceId, initialData }) {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [clientId, setClientId] = useState(initialData?.client_id || '');
  const [issueDate, setIssueDate] = useState(toDateInput(initialData?.issue_date) || toDateInput(new Date()));
  const [dueDate, setDueDate] = useState(toDateInput(initialData?.due_date) || '');
  const [taxRate, setTaxRate] = useState(initialData?.tax_rate ? String(initialData.tax_rate) : '');

  // Diskon: Tipe (Rupiah vs Persentase) & Nilai
  const [discountType, setDiscountType] = useState('fixed'); // 'fixed' (Rp) | 'percent' (%)
  const [discountValue, setDiscountValue] = useState(
    initialData?.discount ? formatThousand(initialData.discount) : ''
  );

  const [lines, setLines] = useState(
    initialData?.items?.length
      ? initialData.items.map((it) => ({
        item_name: it.item_name,
        quantity: formatThousand(it.quantity) || '1',
        unit_price: formatThousand(it.unit_price) || '',
      }))
      : [{ ...EMPTY_LINE }]
  );

  // Load clients & saved items
  useEffect(() => {
    api.get('/api/clients').then((r) => setClients(r.data)).catch(() => { });
    api.get('/api/items').then((r) => setSavedItems(r.data)).catch(() => { });
  }, []);

  // ─── Line helpers ──────────────────────────────────────────────────────────
  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);

  const removeLine = (idx) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, field, value) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  // Handler input Qty format ribuan
  const handleQtyChange = (idx, rawVal) => {
    const digits = rawVal.replace(/[^0-9]/g, '');
    const formatted = digits ? formatThousand(digits) : '';
    updateLine(idx, 'quantity', formatted);
  };

  // Handler input Harga Satuan format ribuan
  const handlePriceChange = (idx, rawVal) => {
    const digits = rawVal.replace(/[^0-9]/g, '');
    const formatted = digits ? formatThousand(digits) : '';
    updateLine(idx, 'unit_price', formatted);
  };

  // Handler saat memilih item yang sudah ada di React-Select
  const handleSelectItemOption = (idx, selectedOption) => {
    if (!selectedOption) {
      updateLine(idx, 'item_name', '');
      return;
    }
    const name = selectedOption.value || selectedOption.name;
    const price = selectedOption.price !== undefined ? formatThousand(selectedOption.price) : lines[idx].unit_price;

    setLines((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, item_name: name, unit_price: price } : l
      )
    );
  };

  // Handler saat mengetik nama item baru yang belum terdaftar (Tampilkan popup input harga & deskripsi)
  const handleCreateNewItem = async (idx, inputValue) => {
    const trimmed = inputValue?.trim();
    if (!trimmed) return;

    const currentPrice = lines[idx]?.unit_price ? parseRawNumber(lines[idx].unit_price) : '';

    const { value: formValues } = await Swal.fire({
      title: '📦 Tambah Item Baru ke Katalog',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #334155; line-height: 1.5;">
          <p style="margin: 0 0 14px; font-size: 13px; color: #64748b;">
            Daftarkan item ini ke katalog agar dapat digunakan kembali dengan cepat pada invoice lainnya.
          </p>

          <div style="margin-bottom: 14px;">
            <label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 4px; color: #1e293b;">
              Nama Item / Layanan <span style="color: #f43f5e;">*</span>
            </label>
            <input
              id="swal-item-name"
              class="swal2-input"
              style="margin: 0; width: 100%; height: 42px; font-size: 14px; border-radius: 10px; border: 1px solid #cbd5e1; box-sizing: border-box;"
              placeholder="Contoh: Jasa Desain UI/UX & Website"
              value="${trimmed.replace(/"/g, '&quot;')}"
            />
          </div>

          <div style="margin-bottom: 14px;">
            <label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 4px; color: #1e293b;">
              Harga Standar (Rp) <span style="color: #f43f5e;">*</span>
            </label>
            <div style="position: relative;">
              <span style="position: absolute; left: 12px; top: 11px; font-weight: 700; color: #64748b; font-size: 13px; z-index: 2;">Rp</span>
              <input
                id="swal-item-price"
                class="swal2-input"
                style="margin: 0; width: 100%; height: 42px; font-size: 14px; border-radius: 10px; border: 1px solid #cbd5e1; box-sizing: border-box; padding-left: 38px; font-family: monospace;"
                placeholder="0"
                value="${currentPrice ? formatThousand(currentPrice) : ''}"
              />
            </div>
          </div>

          <div style="margin-bottom: 6px;">
            <label style="display: block; font-weight: 700; font-size: 12px; margin-bottom: 4px; color: #1e293b;">
              Deskripsi (Opsional)
            </label>
            <textarea
              id="swal-item-desc"
              class="swal2-textarea"
              style="margin: 0; width: 100%; height: 60px; font-size: 13px; border-radius: 10px; border: 1px solid #cbd5e1; box-sizing: border-box; resize: vertical; padding: 8px 12px;"
              placeholder="Keterangan rincian atau spesifikasi item..."
            ></textarea>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '💾 Simpan & Terapkan',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
      didOpen: () => {
        const priceInput = document.getElementById('swal-item-price');
        if (priceInput) {
          priceInput.addEventListener('input', (e) => {
            const digits = e.target.value.replace(/[^0-9]/g, '');
            e.target.value = digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
          });
          if (!priceInput.value) {
            priceInput.focus();
          }
        }
      },
      preConfirm: () => {
        const name = document.getElementById('swal-item-name')?.value?.trim();
        const rawPrice = document.getElementById('swal-item-price')?.value;
        const desc = document.getElementById('swal-item-desc')?.value?.trim();

        if (!name) {
          Swal.showValidationMessage('Nama item wajib diisi');
          return false;
        }
        const price = parseRawNumber(rawPrice);
        if (isNaN(price) || price < 0) {
          Swal.showValidationMessage('Harga harus berupa angka valid');
          return false;
        }
        return { name, price, description: desc || null };
      },
    });

    if (!formValues) return;

    // Terapkan nama item dan harga satuan ke baris invoice aktif
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
            ...l,
            item_name: formValues.name,
            unit_price: formatThousand(formValues.price),
          }
          : l
      )
    );

    // Simpan ke database katalog item (/api/items)
    try {
      const res = await api.post('/api/items', {
        name: formValues.name,
        price: formValues.price,
        description: formValues.description,
      });

      if (res.data?.item) {
        setSavedItems((prev) => [res.data.item, ...prev]);
        toast('success', `Item "${formValues.name}" berhasil didaftarkan ke katalog!`);
      }
    } catch (err) {
      toast('error', err.response?.data?.message || 'Gagal menyimpan item ke katalog');
    }
  };

  // ─── Calculations ──────────────────────────────────────────────────────────
  const subtotal = lines.reduce((sum, l) => {
    const qty = parseRawNumber(l.quantity) || 0;
    const price = parseRawNumber(l.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  // Hitung besaran diskon aktual dalam Rupiah
  const numDiscountVal = parseRawNumber(discountValue) || 0;
  let discountAmt = 0;
  if (discountType === 'percent') {
    discountAmt = (subtotal * Math.min(100, Math.max(0, numDiscountVal))) / 100;
  } else {
    discountAmt = Math.min(subtotal, Math.max(0, numDiscountVal));
  }

  const taxAmt = ((subtotal - discountAmt) * (parseFloat(taxRate) || 0)) / 100;
  const total = subtotal - discountAmt + taxAmt;

  // ─── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!clientId) {
      toast('error', 'Pilih klien terlebih dahulu');
      return;
    }
    const hasEmptyLine = lines.some((l) => !l.item_name.trim() || !l.unit_price);
    if (hasEmptyLine) {
      toast('error', 'Lengkapi semua nama item dan harga satuan');
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
        items: lines.map((l) => ({
          item_name: l.item_name.trim(),
          quantity: parseRawNumber(l.quantity) || 1,
          unit_price: parseRawNumber(l.unit_price) || 0,
        })),
      };

      if (mode === 'edit') {
        await api.put(`/api/invoices/${invoiceId}`, payload);
        toast('success', 'Invoice berhasil diperbarui!');
      } else {
        await api.post('/api/invoices', payload);
        toast('success', 'Draft invoice berhasil dibuat!');
      }
      router.push('/dashboard/invoices');
    } catch (err) {
      toast('error', err.response?.data?.message || 'Gagal menyimpan invoice');
    } finally {
      setSaving(false);
    }
  };

  // Convert savedItems to React-Select options
  const itemOptions = savedItems.map((it) => ({
    value: it.name,
    label: `${it.name} — Rp ${formatThousand(it.price)}`,
    name: it.name,
    price: it.price,
    id: it.id,
  }));

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {mode === 'edit' ? '✏️ Edit Invoice' : '🧾 Buat Invoice Baru'}
          </h1>
          <p className="page-desc">
            {mode === 'edit'
              ? 'Perbarui detail invoice draft dan simpan perubahan.'
              : 'Isi detail tagihan, masukkan rincian item, dan terbitkan invoice profesional.'}
          </p>
        </div>
        <Link href="/dashboard/invoices" className="btn-secondary">
          ← Kembali ke Invoice
        </Link>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── 2-Column Responsive Layout ───────────────────────────── */}
        <div className="invoice-form-2col">
          {/* ── Left Column: Form & Line Items ─────────────────────── */}
          <div className="form-left-col">
            {/* 1. Informasi Invoice */}
            <div className="invoice-section">
              <h2 className="section-title">
                <span className="section-icon">📋</span> 1. Informasi Klien & Tanggal
              </h2>

              <div className="invoice-info-grid">
                <div className="form-group">
                  <label className="form-label">
                    Klien Tujuan <span className="req">*</span>
                  </label>
                  <select
                    className="form-input"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                  >
                    <option value="">— Pilih Klien —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {clients.length === 0 && (
                    <p className="form-hint">
                      Belum ada klien.{' '}
                      <Link href="/dashboard/clients" className="auth-link">
                        Tambah klien
                      </Link>{' '}
                      terlebih dahulu.
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Tanggal Terbit <span className="req">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Jatuh Tempo Pembayaran</label>
                  <input
                    type="date"
                    className="form-input"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    min={issueDate}
                  />
                </div>
              </div>
            </div>

            {/* 2. Rincian Item / Layanan (Tabel Terstruktur & Rapi) */}
            <div className="invoice-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="section-title" style={{ margin: 0 }}>
                  <span className="section-icon">📦</span> 2. Rincian Item & Layanan
                </h2>
                <button
                  type="button"
                  onClick={addLine}
                  className="btn-secondary"
                  style={{ fontSize: 13, padding: '7px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                >
                  <span>➕</span>
                  <span>Tambah Baris</span>
                </button>
              </div>

              {/* Table Wrapper */}
              <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0', background: 'rgba(255, 255, 255, 0.65)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 580 }}>
                  <thead>
                    <tr style={{ background: 'rgba(241, 245, 249, 0.95)', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', width: '44%' }}>
                        Nama Item / Layanan
                      </th>
                      <th style={{ padding: '12px 10px', fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', width: '14%', textAlign: 'center' }}>
                        Qty
                      </th>
                      <th style={{ padding: '12px 12px', fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', width: '23%' }}>
                        Harga Satuan (Rp)
                      </th>
                      <th style={{ padding: '12px 14px', fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', width: '15%', textAlign: 'right' }}>
                        Subtotal
                      </th>
                      <th style={{ padding: '12px 8px', width: '44px', textAlign: 'center' }} />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const lineTotal = (parseRawNumber(line.quantity) || 0) * (parseRawNumber(line.unit_price) || 0);

                      // Option value for react-select
                      const currentSelectValue = line.item_name
                        ? { value: line.item_name, label: line.item_name }
                        : null;

                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: idx !== lines.length - 1 ? '1px solid #f1f5f9' : 'none',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(248, 250, 252, 0.4)',
                            verticalAlign: 'middle',
                          }}
                        >
                          {/* Nama Item dengan React Select Creatable */}
                          <td style={{ padding: '10px 14px' }}>
                            <CreatableSelect
                              isClearable
                              styles={customSelectStyles}
                              options={itemOptions}
                              value={currentSelectValue}
                              onChange={(opt) => handleSelectItemOption(idx, opt)}
                              onCreateOption={(input) => handleCreateNewItem(idx, input)}
                              placeholder="Ketik atau pilih nama item..."
                              formatCreateLabel={(inputValue) => `➕ Tambah "${inputValue}" ke katalog`}
                              noOptionsMessage={() => 'Ketik nama item baru untuk mendaftarkannya'}
                              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            />
                          </td>

                          {/* Qty */}
                          <td style={{ padding: '10px 10px' }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="form-input"
                              placeholder="1"
                              value={line.quantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => handleQtyChange(idx, e.target.value)}
                              required
                              style={{
                                textAlign: 'center',
                                fontFamily: 'var(--font-mono)',
                                height: 42,
                                margin: 0,
                                fontWeight: 700,
                              }}
                            />
                          </td>

                          {/* Harga Satuan */}
                          <td style={{ padding: '10px 12px' }}>
                            <div className="input-with-addon" style={{ margin: 0 }}>
                              <span className="input-addon-badge" style={{ fontSize: 11, padding: '0 8px' }}>Rp</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                className="form-input"
                                placeholder="0"
                                value={line.unit_price}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => handlePriceChange(idx, e.target.value)}
                                required
                                style={{
                                  fontFamily: 'var(--font-mono)',
                                  height: 42,
                                  margin: 0,
                                  fontWeight: 700,
                                }}
                              />
                            </div>
                          </td>

                          {/* Subtotal */}
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <span style={{ fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-main)', fontSize: 14 }}>
                              {formatRupiah(lineTotal)}
                            </span>
                          </td>

                          {/* Hapus Baris */}
                          <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn-remove-line"
                              onClick={() => removeLine(idx)}
                              disabled={lines.length === 1}
                              title="Hapus baris item"
                              style={{
                                margin: '0 auto',
                                opacity: lines.length === 1 ? 0.25 : 1,
                                cursor: lines.length === 1 ? 'not-allowed' : 'pointer',
                              }}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 14 }}>
                <button
                  type="button"
                  onClick={addLine}
                  className="btn-add-line"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  + Tambah Baris Item Baru
                </button>
              </div>
            </div>
          </div>

          {/* ── Right Column: Sticky Grand Total Summary Card ──────── */}
          <div className="sticky-summary-card">
            {/* Adjustments (Discount & Tax) */}
            <div className="totals-adjustments-card">
              <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>
                ⚙️ Penyesuaian Harga
              </h3>

              {/* Discount Selector */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Diskon
                  </label>
                  <div className="discount-type-toggle">
                    <button
                      type="button"
                      className={`btn-toggle-type ${discountType === 'fixed' ? 'active' : ''}`}
                      onClick={() => {
                        setDiscountType('fixed');
                        setDiscountValue('');
                      }}
                    >
                      Nominal (Rp)
                    </button>
                    <button
                      type="button"
                      className={`btn-toggle-type ${discountType === 'percent' ? 'active' : ''}`}
                      onClick={() => {
                        setDiscountType('percent');
                        setDiscountValue('');
                      }}
                    >
                      Persen (%)
                    </button>
                  </div>
                </div>

                <div className="input-with-addon">
                  <span className="input-addon-badge">{discountType === 'fixed' ? 'Rp' : '%'}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
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
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                {discountAmt > 0 && (
                  <p className="form-hint" style={{ color: 'var(--rose)', fontWeight: 600 }}>
                    {discountType === 'percent'
                      ? `Potongan: − ${formatRupiah(discountAmt)} (${discountValue}%)`
                      : subtotal > 0
                        ? `Potongan: − ${formatRupiah(discountAmt)} (${((discountAmt / subtotal) * 100).toFixed(1)}%)`
                        : `Potongan: − ${formatRupiah(discountAmt)}`}
                  </p>
                )}
              </div>

              {/* Tax Rate */}
              <div className="form-group">
                <label className="form-label">Pajak Pertambahan Nilai (%)</label>
                <div className="input-with-addon">
                  <span className="input-addon-badge">%</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input"
                    placeholder="0"
                    value={taxRate}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                      if (parseFloat(cleaned) > 100) {
                        setTaxRate('100');
                      } else {
                        setTaxRate(cleaned);
                      }
                    }}
                  />
                </div>
                {taxAmt > 0 && (
                  <p className="form-hint" style={{ color: 'var(--indigo-dark)', fontWeight: 600 }}>
                    Pajak: + {formatRupiah(taxAmt)} ({taxRate}%)
                  </p>
                )}
              </div>
            </div>

            {/* Grand Total Highlight Box */}
            <div className="grand-total-glass-box">
              <h3
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 12,
                }}
              >
                Ringkasan Kalkulasi
              </h3>

              <div className="total-row">
                <span>Subtotal Item</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatRupiah(subtotal)}</span>
              </div>

              {discountAmt > 0 && (
                <div className="total-row total-discount">
                  <span>Diskon {discountType === 'percent' ? `(${discountValue}%)` : ''}</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>− {formatRupiah(discountAmt)}</span>
                </div>
              )}

              {taxAmt > 0 && (
                <div className="total-row" style={{ color: 'var(--indigo-dark)' }}>
                  <span>Pajak ({taxRate}%)</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+ {formatRupiah(taxAmt)}</span>
                </div>
              )}

              <div className="total-row total-grand">
                <div>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--text-muted)',
                      display: 'block',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Total Pembayaran
                  </span>
                  <p className="grand-total-amount">{formatRupiah(total)}</p>
                </div>
              </div>

              {/* Action Submit Button */}
              <button
                type="submit"
                disabled={saving}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: 15, marginTop: 18 }}
              >
                {saving ? (
                  <>
                    <span className="btn-spinner" /> Menyimpan Invoice...
                  </>
                ) : mode === 'edit' ? (
                  '💾 Simpan Perubahan Invoice'
                ) : (
                  '💾 Simpan sebagai Draft Invoice'
                )}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
