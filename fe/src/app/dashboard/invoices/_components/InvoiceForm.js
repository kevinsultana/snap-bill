'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { toast } from '@/lib/toast';

const EMPTY_LINE = { item_name: '', quantity: '1', unit_price: '' };

function formatRupiah(value) {
  if (!value && value !== 0) return '';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(value));
}

function toDateInput(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
}

/**
 * InvoiceForm — shared between Create and Edit pages.
 * 2-Column Responsive Liquid Glassmorphism Layout
 */
export default function InvoiceForm({ mode = 'create', invoiceId, initialData }) {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [saving, setSaving]   = useState(false);

  // Form state
  const [clientId, setClientId]   = useState(initialData?.client_id || '');
  const [issueDate, setIssueDate] = useState(toDateInput(initialData?.issue_date) || toDateInput(new Date()));
  const [dueDate, setDueDate]     = useState(toDateInput(initialData?.due_date) || '');
  const [taxRate, setTaxRate]     = useState(initialData?.tax_rate ? String(initialData.tax_rate) : '');

  // Diskon: Tipe (Rupiah vs Persentase) & Nilai
  const [discountType, setDiscountType]   = useState('fixed'); // 'fixed' (Rp) | 'percent' (%)
  const [discountValue, setDiscountValue] = useState(initialData?.discount ? String(initialData.discount) : '');

  const [lines, setLines] = useState(
    initialData?.items?.length
      ? initialData.items.map((it) => ({
          item_name:  it.item_name,
          quantity:   String(it.quantity),
          unit_price: String(it.unit_price),
        }))
      : [{ ...EMPTY_LINE }]
  );

  // Load clients
  useEffect(() => {
    api.get('/api/clients').then((r) => setClients(r.data)).catch(() => {});
  }, []);

  // ─── Line helpers ──────────────────────────────────────────────────────────
  const addLine = () => setLines((prev) => [...prev, { ...EMPTY_LINE }]);

  const removeLine = (idx) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx, field, value) => {
    setLines((prev) => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  // Helper pembersih input angka/desimal
  const cleanNumericInput = (val) => {
    return val.replace(/[^0-9.]/g, '').replace(/(\..*?)\..*/g, '$1');
  };

  // Fill from saved items dropdown
  const [savedItems, setSavedItems] = useState([]);
  useEffect(() => {
    api.get('/api/items').then((r) => setSavedItems(r.data)).catch(() => {});
  }, []);

  const fillLineFromItem = (idx, itemId) => {
    const item = savedItems.find((i) => i.id === itemId);
    if (!item) return;
    updateLine(idx, 'item_name', item.name);
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx ? { ...l, item_name: item.name, unit_price: String(item.price) } : l
      )
    );
  };

  // ─── Calculations ──────────────────────────────────────────────────────────
  const subtotal = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.unit_price) || 0;
    return sum + qty * price;
  }, 0);

  // Hitung besaran diskon aktual dalam Rupiah
  const numDiscountVal = parseFloat(discountValue) || 0;
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

    if (!clientId) { toast('error', 'Pilih klien terlebih dahulu'); return; }
    const hasEmptyLine = lines.some((l) => !l.item_name.trim() || !l.unit_price);
    if (hasEmptyLine) { toast('error', 'Lengkapi semua baris item'); return; }

    setSaving(true);
    try {
      const payload = {
        client_id: clientId,
        issue_date: issueDate,
        due_date: dueDate || null,
        tax_rate: parseFloat(taxRate) || 0,
        discount: discountAmt, // Kirim nominal diskon aktual
        items: lines.map((l) => ({
          item_name:  l.item_name.trim(),
          quantity:   parseFloat(l.quantity) || 1,
          unit_price: parseFloat(l.unit_price) || 0,
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
            {mode === 'edit' ? 'Perbarui detail invoice draft dan simpan perubahan.' : 'Isi detail tagihan, masukkan rincian item, dan terbitkan invoice profesional.'}
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
              <h2 className="section-title"><span className="section-icon">📋</span> 1. Informasi Klien & Tanggal</h2>

              <div className="invoice-info-grid">
                <div className="form-group">
                  <label className="form-label">Klien Tujuan <span className="req">*</span></label>
                  <select
                    className="form-input"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                  >
                    <option value="">— Pilih Klien —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {clients.length === 0 && (
                    <p className="form-hint">Belum ada klien. <Link href="/dashboard/clients" className="auth-link">Tambah klien</Link> terlebih dahulu.</p>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Tanggal Terbit <span className="req">*</span></label>
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

            {/* 2. Rincian Item / Layanan */}
            <div className="invoice-section">
              <h2 className="section-title"><span className="section-icon">📦</span> 2. Rincian Item & Layanan</h2>

              {/* Line Items Table Header */}
              <div className="line-header">
                <span>Nama Item / Layanan</span>
                <span>Qty</span>
                <span>Harga Satuan (Rp)</span>
                <span style={{ textAlign: 'right' }}>Subtotal</span>
                <span />
              </div>

              {/* Line Items Rows */}
              {lines.map((line, idx) => {
                const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
                return (
                  <div key={idx} className="line-row">
                    {/* Item Name + Item Picker */}
                    <div className="line-name">
                      <label className="line-mobile-label">Nama Item / Layanan</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Contoh: Jasa Pembuatan Website & UI/UX"
                        value={line.item_name}
                        onChange={(e) => updateLine(idx, 'item_name', e.target.value)}
                        required
                      />
                      {savedItems.length > 0 && (
                        <select
                          className="form-input line-picker"
                          defaultValue=""
                          onChange={(e) => { fillLineFromItem(idx, e.target.value); e.target.value = ''; }}
                          title="Pilih dari item tersimpan"
                        >
                          <option value="">📋 Pilih cepat dari katalog item tersimpan</option>
                          {savedItems.map((it) => (
                            <option key={it.id} value={it.id}>{it.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Qty & Price Group on Mobile */}
                    <div className="line-mobile-inputs">
                      <div className="line-mobile-field">
                        <label className="line-mobile-label">Qty</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="form-input line-qty"
                          placeholder="1"
                          value={line.quantity}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateLine(idx, 'quantity', cleanNumericInput(e.target.value))}
                          required
                        />
                      </div>

                      <div className="line-mobile-field" style={{ flex: 2 }}>
                        <label className="line-mobile-label">Harga Satuan (Rp)</label>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="form-input line-price"
                          placeholder="0"
                          value={line.unit_price}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateLine(idx, 'unit_price', cleanNumericInput(e.target.value))}
                          required
                        />
                      </div>
                    </div>

                    {/* Line Total & Remove Action */}
                    <div className="line-total-wrap">
                      <label className="line-mobile-label">Subtotal</label>
                      <span className="line-total">{formatRupiah(lineTotal)}</span>
                    </div>

                    {/* Remove Line Button */}
                    <button
                      type="button"
                      className="btn-remove-line"
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                      title="Hapus baris item"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              <button type="button" onClick={addLine} className="btn-add-line" style={{ marginTop: 14 }}>
                + Tambah Baris Item Baru
              </button>
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
                  <label className="form-label" style={{ margin: 0 }}>Diskon</label>
                  <div className="discount-type-toggle">
                    <button
                      type="button"
                      className={`btn-toggle-type ${discountType === 'fixed' ? 'active' : ''}`}
                      onClick={() => { setDiscountType('fixed'); setDiscountValue(''); }}
                    >
                      Nominal (Rp)
                    </button>
                    <button
                      type="button"
                      className={`btn-toggle-type ${discountType === 'percent' ? 'active' : ''}`}
                      onClick={() => { setDiscountType('percent'); setDiscountValue(''); }}
                    >
                      Persen (%)
                    </button>
                  </div>
                </div>

                <div className="input-with-addon">
                  <span className="input-addon-badge">
                    {discountType === 'fixed' ? 'Rp' : '%'}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input"
                    placeholder="0"
                    value={discountValue}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const cleaned = cleanNumericInput(e.target.value);
                      if (discountType === 'percent' && parseFloat(cleaned) > 100) {
                        setDiscountValue('100');
                      } else {
                        setDiscountValue(cleaned);
                      }
                    }}
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
                      const cleaned = cleanNumericInput(e.target.value);
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
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
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
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
