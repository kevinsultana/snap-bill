'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
 * Props:
 *   mode: 'create' | 'edit'
 *   invoiceId: string (edit mode only)
 *   initialData: object (edit mode only)
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
    // Hanya izinkan angka dan satu titik desimal
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
        discount: discountAmt, // Selalu kirim nilai nominal diskon murni ke backend
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
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {mode === 'edit' ? '✏️ Edit Invoice' : '🧾 Buat Invoice Baru'}
          </h1>
          <p className="page-desc">
            {mode === 'edit' ? 'Perbarui detail invoice draft.' : 'Isi detail invoice, tambahkan item, lalu simpan sebagai draft.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/invoices')}
          className="btn-secondary"
        >
          ← Kembali
        </button>
      </div>

      <form onSubmit={handleSubmit} className="invoice-form">

        {/* ── Info Section ─────────────────────────────────── */}
        <div className="invoice-section">
          <h2 className="section-title"><span className="section-icon">📋</span> Informasi Invoice</h2>

          <div className="invoice-info-grid">
            <div className="form-group">
              <label className="form-label">Klien <span className="req">*</span></label>
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
                <p className="form-hint">Belum ada klien. <a href="/dashboard/clients" className="auth-link">Tambah klien</a> dulu.</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal Invoice <span className="req">*</span></label>
              <input
                type="date"
                className="form-input"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal Jatuh Tempo</label>
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

        {/* ── Line Items ───────────────────────────────────── */}
        <div className="invoice-section">
          <h2 className="section-title"><span className="section-icon">📦</span> Item / Layanan</h2>

          {/* Header row */}
          <div className="line-header">
            <span className="lh-name">Nama Item</span>
            <span className="lh-qty">Qty</span>
            <span className="lh-price">Harga Satuan</span>
            <span className="lh-total">Subtotal</span>
            <span className="lh-del" />
          </div>

          {lines.map((line, idx) => {
            const lineTotal = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
            return (
              <div key={idx} className="line-row">
                {/* Item name + optional saved-item picker */}
                <div className="line-name">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nama item / layanan"
                    value={line.item_name}
                    onChange={(e) => updateLine(idx, 'item_name', e.target.value)}
                    required
                  />
                  {savedItems.length > 0 && (
                    <select
                      className="form-input line-picker"
                      defaultValue=""
                      onChange={(e) => { fillLineFromItem(idx, e.target.value); e.target.value = ''; }}
                      title="Isi dari item tersimpan"
                    >
                      <option value="">📋 Pilih dari item tersimpan</option>
                      {savedItems.map((it) => (
                        <option key={it.id} value={it.id}>{it.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Qty Input (Text with decimal inputMode, no spinner) */}
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

                {/* Unit Price Input (Text with decimal inputMode, no spinner) */}
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

                <span className="line-total">{formatRupiah(lineTotal)}</span>

                <button
                  type="button"
                  className="btn-remove-line"
                  onClick={() => removeLine(idx)}
                  disabled={lines.length === 1}
                  title="Hapus baris"
                >
                  ✕
                </button>
              </div>
            );
          })}

          <button type="button" onClick={addLine} className="btn-add-line">
            + Tambah Baris
          </button>
        </div>

        {/* ── Totals ──────────────────────────────────────── */}
        <div className="invoice-section invoice-totals-section">
          <div className="totals-adjustments">

            {/* Diskon dengan Toggle Rupiah / Persentase */}
            <div className="form-group" style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
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
                <p className="form-hint" style={{ color: '#f87171', marginTop: 4, fontWeight: 500 }}>
                  {discountType === 'percent'
                    ? `Potongan: − ${formatRupiah(discountAmt)} (${discountValue}%)`
                    : subtotal > 0
                    ? `Potongan: − ${formatRupiah(discountAmt)} (${((discountAmt / subtotal) * 100).toFixed(1)}%)`
                    : `Potongan: − ${formatRupiah(discountAmt)}`}
                </p>
              )}
            </div>

            {/* Pajak (%) */}
            <div className="form-group" style={{ flex: 0.8 }}>
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
                <p className="form-hint" style={{ color: 'var(--indigo-light)', marginTop: 4, fontWeight: 500 }}>
                  Pajak: + {formatRupiah(taxAmt)} ({taxRate}%)
                </p>
              )}
            </div>
          </div>

          {/* Summary Box */}
          <div className="totals-summary">
            <div className="total-row">
              <span>Subtotal</span>
              <span>{formatRupiah(subtotal)}</span>
            </div>
            {discountAmt > 0 && (
              <div className="total-row total-discount">
                <span>
                  Diskon {discountType === 'percent' ? `(${discountValue}%)` : ''}
                </span>
                <span>− {formatRupiah(discountAmt)}</span>
              </div>
            )}
            {taxAmt > 0 && (
              <div className="total-row">
                <span>Pajak ({taxRate}%)</span>
                <span>+ {formatRupiah(taxAmt)}</span>
              </div>
            )}
            <div className="total-row total-grand">
              <span>Total Tagihan</span>
              <span style={{ color: 'var(--indigo-light)' }}>{formatRupiah(total)}</span>
            </div>
          </div>
        </div>

        {/* ── Actions ─────────────────────────────────────── */}
        <div className="invoice-actions">
          <button
            type="button"
            onClick={() => router.push('/dashboard/invoices')}
            className="btn-secondary"
          >
            Batal
          </button>
          <button type="submit" disabled={saving} className="btn-primary btn-inline">
            {saving ? <span className="btn-spinner" /> : (mode === 'edit' ? '💾 Simpan Perubahan' : '💾 Simpan sebagai Draft')}
          </button>
        </div>

      </form>
    </div>
  );
}
