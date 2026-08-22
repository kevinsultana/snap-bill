'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function formatRupiah(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(num || 0));
}

function formatDate(dateStr, lang = 'id') {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function PublicPayPage() {
  const { token } = useParams();
  const searchParams = useSearchParams();
  const txStatus = searchParams?.get('transaction_status');
  const statusCode = searchParams?.get('status_code');
  const { t, lang } = useTranslation();

  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const orderId = searchParams?.get('order_id');
  const [checkingStatus, setCheckingStatus] = useState(false);

  // File upload state
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [payingSnap, setPayingSnap] = useState(false);

  const STATUS_MAP = {
    draft:                { label: t('invoices.status_draft'),                badgeClass: 'badge-gray',    desc: 'Invoice ini masih dalam bentuk draf tagihan.' },
    unpaid:               { label: t('invoices.status_unpaid'),               badgeClass: 'badge-amber',   desc: 'Silakan lakukan pembayaran sesuai rincian total di bawah ini.' },
    pending_verification: { label: t('invoices.status_pending_verification'), badgeClass: 'badge-blue',    desc: 'Bukti transfer Anda telah diterima dan sedang diverifikasi oleh pihak pemilik usaha.' },
    paid:                 { label: t('invoices.status_paid'),                 badgeClass: 'badge-emerald', desc: 'Pembayaran telah berhasil diverifikasi dan lunas. Terima kasih atas kerja sama Anda!' },
    overdue:              { label: t('invoices.status_overdue'),              badgeClass: 'badge-red',     desc: 'Tagihan telah melewati batas waktu tanggal jatuh tempo.' },
  };

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/public/invoices/${token}`);
      setInvoice(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Invoice tidak ditemukan atau tautan pembayaran tidak valid.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Cek status pembayaran ke server & Midtrans Core API
  const handleCheckPaymentStatus = useCallback(async (showToast = true) => {
    setCheckingStatus(true);
    try {
      const res = await axios.post(`${API_URL}/api/public/invoices/${token}/check-status`, {
        order_id: orderId || undefined,
      });

      if (res.data?.invoice) {
        setInvoice(res.data.invoice);
      }

      if (res.data?.status === 'paid') {
        Swal.fire({
          icon: 'success',
          title: '🎉 Pembayaran Berhasil Terverifikasi!',
          text: 'Terima kasih, tagihan invoice Anda telah lunas.',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
      } else if (showToast) {
        Swal.fire({
          icon: 'info',
          title: 'Status Pembayaran',
          text: 'Transaksi masih dalam proses atau menunggu pembayaran.',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
      }
    } catch (err) {
      if (showToast) {
        Swal.fire({
          icon: 'error',
          title: 'Gagal Memeriksa Status',
          text: err.response?.data?.message || 'Terjadi kesalahan saat memeriksa status.',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
      }
    } finally {
      setCheckingStatus(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  // Otomatis cek status transaksi ke Midtrans jika ada query order_id / txStatus
  useEffect(() => {
    if (orderId || txStatus) {
      handleCheckPaymentStatus(false);
    }
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
        icon: 'warning',
        title: 'Ukuran File Terlalu Besar',
        text: 'Ukuran maksimal bukti transfer adalah 5MB.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      return;
    }

    setSelectedFile(file);

    if (file.type.startsWith('image/')) {
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
    formData.append('receipt', selectedFile);

    try {
      await axios.post(`${API_URL}/api/public/invoices/${token}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await Swal.fire({
        icon: 'success',
        title: 'Bukti Transfer Terkirim! 🎉',
        text: 'Bukti pembayaran Anda berhasil diunggah dan akan segera diverifikasi oleh pemilik usaha.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });

      setSelectedFile(null);
      setPreviewUrl(null);
      fetchInvoice();
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Mengunggah',
        text: err.response?.data?.message || 'Terjadi kesalahan saat mengunggah bukti pembayaran.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
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
      const res = await axios.post(`${API_URL}/api/public/invoices/${token}/pay`);
      if (res.data?.payment_url) {
        window.location.href = res.data.payment_url;
      } else {
        fetchInvoice();
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Membuka Pembayaran Online',
        text: err.response?.data?.message || 'Tidak dapat membuat sesi pembayaran Midtrans.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    } finally {
      setPayingSnap(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="page-container" style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: 40 }}>
          <span style={{ fontSize: 48 }}>⚠️</span>
          <h2 style={{ margin: '14px 0 8px', color: 'var(--text-main)' }}>Invoice Tidak Ditemukan</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
            {error || 'Tautan pembayaran ini tidak valid atau tagihan telah dihapus.'}
          </p>
        </div>
      </div>
    );
  }

  const user = invoice.user || {};
  const client = invoice.client || {};
  const items = invoice.items || [];
  const bankAccounts = Array.isArray(user.bank_accounts) ? user.bank_accounts : [];
  const statusInfo = STATUS_MAP[invoice.status] || STATUS_MAP.unpaid;

  return (
    <div className="pay-portal-container">

      {/* Top Header Card */}
      <div className="glass-card" style={{ padding: '24px 28px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {user.logo_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={user.logo_url}
              alt="Logo"
              style={{ maxHeight: 42, maxWidth: 120, objectFit: 'contain' }}
            />
          ) : (
            <div className="sidebar-logo" style={{ width: 42, height: 42, fontSize: 20 }}>⚡</div>
          )}
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              {user.business_name || 'SnapBill Invoice'}
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {t('pay_portal.official_portal')}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <LanguageSwitcher size="small" />

          <a
            href={`${API_URL}/api/public/invoices/${token}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
            style={{ padding: '6px 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Download PDF Faktur Invoice Resmi"
          >
            <span>📄</span>
            <span>{t('common.download_pdf')}</span>
          </a>
          <span className={`status-badge ${statusInfo.badgeClass}`} style={{ fontSize: 13, padding: '6px 14px' }}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Midtrans Callback Return Banner */}
      {(txStatus === 'settlement' || txStatus === 'capture' || statusCode === '200') && invoice.status !== 'paid' && (
        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(209, 250, 229, 0.95), rgba(236, 253, 245, 0.95))', border: '1px solid #34d399', padding: '18px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 32 }}>🎉</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontWeight: 800, color: '#065f46', fontSize: 15 }}>{t('pay_portal.status_success_midtrans_title')}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#047857' }}>
              {t('pay_portal.status_success_midtrans_desc')}
            </p>
          </div>
        </div>
      )}

      {(txStatus === 'pending' || statusCode === '201') && invoice.status !== 'paid' && (
        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.95), rgba(254, 249, 195, 0.95))', border: '1px solid #facc15', padding: '18px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 240 }}>
            <span style={{ fontSize: 32 }}>⏳</span>
            <div>
              <h3 style={{ margin: 0, fontWeight: 800, color: '#854d0e', fontSize: 15 }}>{t('pay_portal.status_pending_midtrans_title')}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: '#a16207' }}>
                {t('pay_portal.status_pending_midtrans_desc')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleCheckPaymentStatus(true)}
            disabled={checkingStatus}
            className="btn-primary"
            style={{ padding: '10px 18px', fontSize: 13, whiteSpace: 'nowrap' }}
          >
            {checkingStatus ? (
              <>
                <span className="btn-spinner" /> Memeriksa...
              </>
            ) : (
              <>🔄 Cek Status Pembayaran</>
            )}
          </button>
        </div>
      )}

      {/* Status Notice Banner */}
      {invoice.status === 'paid' && (
        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(209, 250, 229, 0.9), rgba(236, 253, 245, 0.9))', border: '1px solid #6ee7b7', padding: '18px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 32 }}>🎉</span>
          <div>
            <h3 style={{ margin: 0, fontWeight: 800, color: '#065f46', fontSize: 15 }}>{t('pay_portal.status_paid_title')}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#047857' }}>
              {t('pay_portal.status_paid_desc')}
            </p>
          </div>
        </div>
      )}

      {invoice.status === 'pending_verification' && (
        <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(224, 231, 255, 0.9), rgba(243, 232, 255, 0.9))', border: '1px solid #a5b4fc', padding: '18px 24px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 32 }}>⏳</span>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontWeight: 800, color: '#312e81', fontSize: 15 }}>{t('pay_portal.status_pending_verif_title')}</h3>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#4338ca' }}>
              {t('pay_portal.status_pending_verif_desc')}
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Details + Payment Actions */}
      <div className="pay-portal-grid">

        {/* ── Left Column: Rincian Invoice & Item ──────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Info Card */}
          <div className="glass-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{t('dashboard.table_invoice_num')}</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--indigo-dark)', fontFamily: 'var(--font-mono)', margin: '2px 0 0' }}>
                  #{invoice.invoice_number}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{t('dashboard.table_total')}</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: '#047857', fontFamily: 'var(--font-mono)', margin: '2px 0 0' }}>
                  {formatRupiah(invoice.total)}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 13 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>{t('pay_portal.invoice_for')}:</p>
                <p style={{ fontWeight: 700, color: 'var(--text-main)' }}>{client.name || '—'}</p>
                {client.email && <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{client.email}</p>}
                {client.phone && <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{client.phone}</p>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 2 }}>{t('common.date')}:</p>
                <p style={{ color: 'var(--text-secondary)' }}>{t('pay_portal.issued_on')} {formatDate(invoice.issue_date, lang)}</p>
                <p style={{ color: invoice.status === 'overdue' ? 'var(--rose)' : 'var(--text-main)', fontWeight: 600 }}>
                  {t('pay_portal.due_on')} {formatDate(invoice.due_date, lang)}
                </p>
              </div>
            </div>
          </div>

          {/* Items Table Card */}
          <div className="glass-card" style={{ padding: 24, overflow: 'hidden' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
              📦 {t('invoices.form_section_items')}
            </h3>

            <div className="table-container" style={{ marginBottom: 16 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('invoices.form_item_name')}</th>
                    <th className="td-right">{t('invoices.form_qty')}</th>
                    <th className="td-right">{t('invoices.form_price')}</th>
                    <th className="td-right">{t('invoices.form_subtotal')}</th>
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
            </div>

            {/* Totals */}
            <div style={{ background: 'rgba(248, 250, 252, 0.9)', padding: '16px 20px', borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div className="total-row">
                <span>{t('common.subtotal')}</span>
                <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{formatRupiah(invoice.subtotal)}</span>
              </div>
              {Number(invoice.discount) > 0 && (
                <div className="total-row total-discount">
                  <span>{t('common.discount')}</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>− {formatRupiah(invoice.discount)}</span>
                </div>
              )}
              {Number(invoice.tax_rate) > 0 && (
                <div className="total-row" style={{ color: 'var(--indigo-dark)' }}>
                  <span>{t('common.tax')} ({Number(invoice.tax_rate)}%)</span>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>+ {formatRupiah(((Number(invoice.subtotal) - Number(invoice.discount)) * Number(invoice.tax_rate)) / 100)}</span>
                </div>
              )}
              <div className="total-row total-grand" style={{ borderTop: '2px dashed #cbd5e1', paddingTop: 12 }}>
                <span style={{ fontWeight: 800 }}>{t('invoices.form_total_payment')}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--indigo-dark)', fontFamily: 'var(--font-mono)' }}>
                  {formatRupiah(invoice.total)}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ── Right Column: Payment Options ───────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* 1. Midtrans Snap Online Payment */}
          {invoice.status !== 'paid' && user.tier === 'pro' && user.has_midtrans && (
            <div className="glass-card glass-card-highlight" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <span>💳</span> {t('pay_portal.auto_payment_title')}
                </h3>
                <span className="status-badge badge-emerald" style={{ fontSize: 10, fontWeight: 800 }}>
                  {t('pay_portal.instant_badge')}
                </span>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
                {t('pay_portal.auto_payment_desc')}
              </p>

              <button
                type="button"
                onClick={handlePaySnap}
                disabled={payingSnap}
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: 15, justifyContent: 'center' }}
              >
                {payingSnap ? (
                  <>
                    <span className="btn-spinner" /> Membuka Gateway Pembayaran...
                  </>
                ) : (
                  t('pay_portal.btn_pay_snap')
                )}
              </button>
            </div>
          )}

          {/* 2. Manual Bank Transfer Option */}
          {invoice.status !== 'paid' && (
            <div className="glass-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 6px' }}>
                <span>🏦</span> {t('pay_portal.manual_transfer_title')}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                {t('pay_portal.manual_transfer_desc')}
              </p>

              {bankAccounts.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  {t('pay_portal.no_bank_accounts')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {bankAccounts.map((b, idx) => (
                    <div key={idx} className="bank-item-glass">
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--indigo)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{b.bank_name}</span>
                        <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-mono)', margin: '2px 0' }}>{b.account_number}</p>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>a.n. {b.account_holder || user.business_name || 'Pemilik Usaha'}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 12, padding: '6px 12px' }}
                        onClick={() => handleCopyAccount(b.account_number, idx)}
                        title="Salin Nomor Rekening"
                      >
                        {copiedIndex === idx ? `✅ ${t('common.copied')}` : `📋 ${t('common.copy')}`}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Receipt Section */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 18 }}>
                <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', marginBottom: 4 }}>
                  {t('pay_portal.upload_proof_title')}
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                  {t('pay_portal.upload_proof_hint')}
                </p>

                <form onSubmit={handleUploadReceipt}>
                  <div style={{ border: '2px dashed #cbd5e1', borderRadius: 14, padding: 20, textAlign: 'center', background: 'rgba(248, 250, 252, 0.6)', cursor: 'pointer', transition: 'border-color 0.2s' }}>
                    <input
                      type="file"
                      id="receipt-file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                    <label htmlFor="receipt-file" style={{ cursor: 'pointer', display: 'block' }}>
                      {previewUrl ? (
                        <div>
                          <img
                            src={previewUrl}
                            alt="Preview Bukti"
                            style={{ maxHeight: 120, borderRadius: 8, margin: '0 auto 8px', objectFit: 'contain' }}
                          />
                          <p style={{ fontSize: 12, color: 'var(--indigo-dark)', fontWeight: 700 }}>Ganti file terpilih</p>
                        </div>
                      ) : selectedFile ? (
                        <div>
                          <div style={{ fontSize: 32, marginBottom: 4 }}>📄</div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>{selectedFile.name}</p>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 32, marginBottom: 6 }}>📎</div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                            Pilih foto / tangkapan layar bukti transfer
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            Klik di sini untuk memilih file
                          </p>
                        </div>
                      )}
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={!selectedFile || uploading}
                    className="btn-primary"
                    style={{ width: '100%', marginTop: 14, padding: '12px' }}
                  >
                    {uploading ? (
                      <>
                        <span className="btn-spinner" /> {t('pay_portal.uploading')}
                      </>
                    ) : (
                      t('pay_portal.btn_upload_proof')
                    )}
                  </button>
                </form>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
