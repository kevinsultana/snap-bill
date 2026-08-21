'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const STATUS_MAP = {
  draft:                { label: 'Draft',                   badgeClass: 'badge-gray',    desc: 'Invoice ini masih dalam bentuk draft.' },
  unpaid:               { label: 'Belum Dibayar',           badgeClass: 'badge-amber',   desc: 'Silakan lakukan pembayaran sesuai rincian di bawah.' },
  pending_verification: { label: 'Menunggu Verifikasi',     badgeClass: 'badge-blue',    desc: 'Bukti pembayaran Anda sedang dalam proses verifikasi.' },
  paid:                 { label: 'Lunas',                   badgeClass: 'badge-emerald', desc: 'Pembayaran telah diverifikasi dan lunas. Terima kasih!' },
  overdue:              { label: 'Jatuh Tempo',             badgeClass: 'badge-red',     desc: 'Tagihan telah melewati batas waktu pembayaran.' },
};

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(num || 0));
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function PublicPayPage() {
  const { token } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/public/invoices/${token}`);
      setInvoice(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invoice tidak ditemukan atau link pembayaran tidak valid.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'Ukuran file terlalu besar',
        text: 'Maksimal ukuran file bukti transfer adalah 5MB.',
        confirmButtonColor: '#6366f1',
      });
      return;
    }

    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  // Upload receipt to backend
  const handleUploadReceipt = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      Swal.fire({
        icon: 'warning',
        title: 'Pilih File Terlebih Dahulu',
        text: 'Silakan pilih file bukti transfer Anda (JPG, PNG, WebP, atau PDF).',
        confirmButtonColor: '#6366f1',
      });
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('receipt', selectedFile);

    try {
      const res = await axios.post(`${API_URL}/api/public/invoices/${token}/upload-receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await Swal.fire({
        icon: 'success',
        title: 'Bukti Pembayaran Terkirim!',
        text: 'Terima kasih! Bukti pembayaran berhasil diunggah dan status tagihan telah diubah menjadi Menunggu Verifikasi.',
        confirmButtonColor: '#6366f1',
      });

      setSelectedFile(null);
      setPreviewUrl(null);
      setInvoice(res.data.invoice);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mengunggah',
        text: err.response?.data?.message || 'Terjadi kesalahan saat mengunggah bukti pembayaran.',
        confirmButtonColor: '#6366f1',
      });
    } finally {
      setUploading(false);
    }
  };

  // Copy bank account number to clipboard
  const handleCopyAccount = (accNumber, index) => {
    navigator.clipboard.writeText(accNumber);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (loading) {
    return (
      <div className="pay-page-wrapper">
        <div className="loading-screen">
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="pay-page-wrapper">
        <div className="pay-card" style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#f1f5f9' }}>Link Tidak Valid</h2>
          <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>{error || 'Invoice tidak ditemukan.'}</p>
        </div>
      </div>
    );
  }

  const user = invoice.user || {};
  const client = invoice.client || {};
  const items = invoice.items || [];
  const bankAccounts = Array.isArray(user.bank_accounts) ? user.bank_accounts : [];
  const statusCfg = STATUS_MAP[invoice.status] || STATUS_MAP.draft;

  return (
    <div className="pay-page-wrapper">
      <div className="pay-container">

        {/* ── Brand & Header ────────────────────────────────────────── */}
        <header className="pay-header">
          <div className="pay-brand">
            <div className="pay-logo">⚡</div>
            <div>
              <h1 className="pay-business-name">{user.business_name || 'SnapBill'}</h1>
              <p className="pay-business-email">{user.email || ''}</p>
            </div>
          </div>
          <div className="pay-header-right">
            <span className={`status-badge ${statusCfg.badgeClass}`} style={{ fontSize: 13, padding: '4px 14px' }}>
              {statusCfg.label}
            </span>
          </div>
        </header>

        {/* ── Status Banner (Paid / Pending) ────────────────────────── */}
        {invoice.status === 'paid' && (
          <div className="pay-alert pay-alert-success">
            <span style={{ fontSize: 24 }}>🎉</span>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700, color: '#10b981' }}>Pembayaran Telah Lunas</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#94a3b8' }}>
                Tagihan ini telah berhasil dibayar dan diverifikasi oleh pemilik usaha.
              </p>
            </div>
          </div>
        )}

        {invoice.status === 'pending_verification' && (
          <div className="pay-alert pay-alert-info">
            <span style={{ fontSize: 24 }}>⏳</span>
            <div>
              <h3 style={{ margin: 0, fontWeight: 700, color: '#60a5fa' }}>Menunggu Verifikasi Pembayaran</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#94a3b8' }}>
                Bukti pembayaran telah berhasil dikirimkan dan sedang ditinjau oleh pihak pemilik usaha.
              </p>
              {invoice.receipt_url && (
                <a
                  href={invoice.receipt_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="auth-link"
                  style={{ display: 'inline-block', marginTop: 6, fontSize: 13 }}
                >
                  👁️ Lihat Bukti Pembayaran yang Diunggah
                </a>
              )}
            </div>
          </div>
        )}

        <div className="pay-grid">

          {/* ── Left Column: Invoice Details ──────────────────────────── */}
          <div className="pay-details-col">

            {/* Meta summary card */}
            <div className="pay-card">
              <div className="pay-meta-row">
                <div>
                  <span className="meta-label">Nomor Invoice</span>
                  <p className="pay-inv-number">#{invoice.invoice_number}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="meta-label">Total Tagihan</span>
                  <p className="pay-inv-total">{formatRupiah(invoice.total)}</p>
                </div>
              </div>

              <hr className="pay-divider" />

              <div className="pay-dates-grid">
                <div>
                  <span className="meta-label">Ditujukan Kepada</span>
                  <p style={{ fontWeight: 600, color: '#f1f5f9', margin: '2px 0' }}>{client.name || '—'}</p>
                  {client.email && <p style={{ color: '#94a3b8', fontSize: 12 }}>{client.email}</p>}
                  {client.phone && <p style={{ color: '#94a3b8', fontSize: 12 }}>{client.phone}</p>}
                  {client.address && <p style={{ color: '#64748b', fontSize: 12, marginTop: 2 }}>{client.address}</p>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div>
                    <span className="meta-label">Tanggal Terbit</span>
                    <p style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500 }}>{formatDate(invoice.issue_date)}</p>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <span className="meta-label">Jatuh Tempo</span>
                    <p style={{ color: invoice.status === 'overdue' ? '#ef4444' : '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
                      {formatDate(invoice.due_date)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Items table card */}
            <div className="pay-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #2a2a4a' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>Rincian Item</h3>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="td-right">Qty</th>
                    <th className="td-right">Harga</th>
                    <th className="td-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.id}>
                      <td className="td-name">{it.item_name}</td>
                      <td className="td-right td-secondary">{Number(it.quantity)}</td>
                      <td className="td-right td-secondary">{formatRupiah(it.unit_price)}</td>
                      <td className="td-right td-price">{formatRupiah(it.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals breakdown */}
              <div className="pay-totals-box">
                <div className="total-row">
                  <span>Subtotal</span>
                  <span>{formatRupiah(invoice.subtotal)}</span>
                </div>
                {Number(invoice.discount) > 0 && (
                  <div className="total-row total-discount">
                    <span>Diskon</span>
                    <span>− {formatRupiah(invoice.discount)}</span>
                  </div>
                )}
                {Number(invoice.tax_rate) > 0 && (
                  <div className="total-row">
                    <span>Pajak ({Number(invoice.tax_rate)}%)</span>
                    <span>+ {formatRupiah(((Number(invoice.subtotal) - Number(invoice.discount)) * Number(invoice.tax_rate)) / 100)}</span>
                  </div>
                )}
                <div className="total-row total-grand">
                  <span>Total yang Harus Dibayar</span>
                  <span style={{ color: '#818cf8' }}>{formatRupiah(invoice.total)}</span>
                </div>
              </div>
            </div>

          </div>

          {/* ── Right Column: Payment Portal ─────────────────────────── */}
          <div className="pay-action-col">

            {/* Online Payment via Midtrans (if available & not paid) */}
            {invoice.status !== 'paid' && invoice.payment_url && (
              <div className="pay-card pay-midtrans-card">
                <h3 className="section-title" style={{ fontSize: 15, marginBottom: 8 }}>
                  <span className="section-icon">💳</span> Pembayaran Otomatis
                </h3>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                  Bayar instan via QRIS, Virtual Account BCA/Mandiri/BNI/BRI, GoPay, ShopeePay, atau Kartu Kredit.
                </p>
                <a
                  href={invoice.payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary"
                  style={{ textDecoration: 'none', textAlign: 'center', justifyContent: 'center' }}
                >
                  🚀 Bayar via Midtrans Snap
                </a>
              </div>
            )}

            {/* Manual Bank Transfer Options */}
            {invoice.status !== 'paid' && (
              <div className="pay-card">
                <h3 className="section-title" style={{ fontSize: 15, marginBottom: 8 }}>
                  <span className="section-icon">🏦</span> Transfer Bank Manual
                </h3>
                <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
                  Transfer ke salah satu rekening di bawah ini dan unggah foto/tangkapan layar bukti transfer Anda:
                </p>

                {bankAccounts.length === 0 ? (
                  <p style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                    Belum ada rekening bank yang dikonfigurasi oleh pemilik usaha.
                  </p>
                ) : (
                  <div className="pay-bank-list">
                    {bankAccounts.map((b, idx) => (
                      <div key={idx} className="pay-bank-item">
                        <div>
                          <span className="pay-bank-name">{b.bank_name}</span>
                          <p className="pay-bank-acc">{b.account_number}</p>
                          <span className="pay-bank-holder">a.n. {b.account_holder || user.business_name || 'Pemilik'}</span>
                        </div>
                        <button
                          type="button"
                          className="btn-action"
                          style={{ fontSize: 12, padding: '6px 10px', height: 'fit-content' }}
                          onClick={() => handleCopyAccount(b.account_number, idx)}
                          title="Salin Nomor Rekening"
                        >
                          {copiedIndex === idx ? '✅ Tersalin' : '📋 Salin'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Receipt Form (Active for unpaid / overdue / pending_verification) */}
                <div style={{ marginTop: 24, borderTop: '1px solid #2a2a4a', paddingTop: 20 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9', marginBottom: 6 }}>
                    📤 Unggah Bukti Transfer
                  </h4>
                  <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 14 }}>
                    Format: JPG, PNG, WebP, atau PDF (Maks. 5MB)
                  </p>

                  <form onSubmit={handleUploadReceipt}>
                    <div className="pay-upload-dropzone">
                      <input
                        type="file"
                        id="receipt-file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="receipt-file" className="pay-upload-label">
                        {previewUrl ? (
                          <div style={{ textAlign: 'center' }}>
                            <img
                              src={previewUrl}
                              alt="Preview Bukti"
                              style={{ maxHeight: 120, borderRadius: 8, margin: '0 auto 8px', objectFit: 'contain' }}
                            />
                            <p style={{ fontSize: 12, color: '#818cf8', margin: 0 }}>Ganti file terpilih</p>
                          </div>
                        ) : selectedFile ? (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 32, marginBottom: 4 }}>📄</div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>{selectedFile.name}</p>
                            <span style={{ fontSize: 11, color: '#94a3b8' }}>({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 32, marginBottom: 6 }}>📎</div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', margin: 0 }}>
                              Klik untuk memilih file bukti transfer
                            </p>
                            <p style={{ fontSize: 11, color: '#64748b', margin: '4px 0 0' }}>
                              Seret & lepas gambar atau klik di sini
                            </p>
                          </div>
                        )}
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={!selectedFile || uploading}
                      className="btn-primary"
                      style={{ marginTop: 14, justifyContent: 'center' }}
                    >
                      {uploading ? (
                        <>
                          <span className="btn-spinner" />
                          <span>Mengunggah ke Storage...</span>
                        </>
                      ) : (
                        '📤 Kirim Bukti Transfer'
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
