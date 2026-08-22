'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from '@/lib/toast';
import Swal from 'sweetalert2';

function formatDateFull(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' WIB';
}

function getDaysRemaining(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diffMs = target - now;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function SubscriptionContent() {
  const searchParams = useSearchParams();
  const urlOrderId = searchParams?.get('order_id');
  const urlSubscribed = searchParams?.get('subscribed');

  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const [pendingPaymentUrl, setPendingPaymentUrl] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/api/subscriptions/status');
      setStatusData(res.data);
      return res.data;
    } catch {
      toast('error', 'Gagal memuat informasi langganan');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Cek status pembayaran Midtrans secara otentik
  const handleCheckStatus = useCallback(async (orderIdToCheck, showToast = false) => {
    if (!orderIdToCheck) return;
    setCheckingStatus(true);
    try {
      const res = await api.post('/api/subscriptions/check-status', { order_id: orderIdToCheck });
      const data = res.data;

      if (data.status === 'settlement' || data.isPro) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pending_sub_order_id');
          localStorage.removeItem('pending_sub_payment_url');
          window.dispatchEvent(new CustomEvent('subscription_updated'));
        }
        setPendingTransaction(null);
        setPendingPaymentUrl(null);
        await fetchStatus();

        Swal.fire({
          icon: 'success',
          title: '🎉 Selamat Datang di SnapBill PRO!',
          text: data.message || 'Pembayaran langganan Pro Anda telah berhasil diverifikasi lunas. Nikmati fitur tanpa batas!',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
      } else if (data.status === 'pending') {
        if (typeof window !== 'undefined') {
          localStorage.setItem('pending_sub_order_id', orderIdToCheck);
        }
        setPendingTransaction(data);

        if (showToast) {
          Swal.fire({
            icon: 'info',
            title: 'Menunggu Pembayaran',
            text: 'Pembayaran Anda masih dalam status Pending. Silakan klik tombol "Buka Halaman Pembayaran" untuk melihat kode transfer / QRIS.',
            confirmButtonColor: '#6366f1',
            customClass: { popup: 'swal-custom-popup' },
          });
        }
      } else if (data.status === 'failed' || data.status === 'expire' || data.status === 'cancel') {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pending_sub_order_id');
          localStorage.removeItem('pending_sub_payment_url');
        }
        setPendingTransaction(null);
        setPendingPaymentUrl(null);
        if (showToast) {
          toast('warning', data.message || 'Transaksi pembayaran dibatalkan atau telah kedaluwarsa.');
        }
      }
    } catch (err) {
      if (showToast) {
        toast('error', err.response?.data?.message || 'Gagal mengecek status pembayaran ke Midtrans.');
      }
    } finally {
      setCheckingStatus(false);
    }
  }, [fetchStatus]);

  // Load awal: fetch status & auto-check query order_id / localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPaymentUrl = localStorage.getItem('pending_sub_payment_url');
      if (savedPaymentUrl) setPendingPaymentUrl(savedPaymentUrl);
    }

    fetchStatus().then((currentSub) => {
      let activeOrderId = urlOrderId;
      if (!activeOrderId && typeof window !== 'undefined') {
        activeOrderId = localStorage.getItem('pending_sub_order_id');
      }

      // Jika user sudah Pro, hapus pending order lama
      if (currentSub?.tier === 'pro') {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('pending_sub_order_id');
          localStorage.removeItem('pending_sub_payment_url');
        }
        setPendingTransaction(null);
        setPendingPaymentUrl(null);
        return;
      }

      if (activeOrderId) {
        handleCheckStatus(activeOrderId, Boolean(urlOrderId || urlSubscribed));
      }
    });
  }, [urlOrderId, urlSubscribed, fetchStatus, handleCheckStatus]);

  // Upgrade ke Pro via Midtrans Checkout
  const handleUpgrade = async () => {
    const result = await Swal.fire({
      title: '⚡ Upgrade ke SnapBill PRO',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #475569; line-height: 1.6;">
          <p style="margin: 0 0 12px; font-size: 15px; color: #0f172a; font-weight: 700;">
            Hanya <b>Rp 99.000 / bulan</b> untuk membuka seluruh fitur bisnis tanpa batas:
          </p>
          <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px;">
            <li><b style="color: #10b981;">✓</b> <b>Unlimited Invoices</b> (Buat invoice tanpa batas kuota bulanan)</li>
            <li><b style="color: #10b981;">✓</b> <b>Midtrans Payment Gateway (BYOK)</b> untuk pembayaran instan klien</li>
            <li><b style="color: #10b981;">✓</b> <b>Kuitansi Otomatis & Email Terima Kasih</b> saat invoice lunas</li>
            <li><b style="color: #10b981;">✓</b> <b>Generate PDF Faktur Resmi Puppeteer</b> berkualitas tinggi</li>
          </ul>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '💳 Bayar via Midtrans (Rp 99.000)',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
    });

    if (!result.isConfirmed) return;

    setActionLoading(true);
    try {
      const res = await api.post('/api/subscriptions/create-snap');
      if (res.data?.order_id && typeof window !== 'undefined') {
        localStorage.setItem('pending_sub_order_id', res.data.order_id);
      }
      if (res.data?.redirect_url) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('pending_sub_payment_url', res.data.redirect_url);
        }
        setPendingPaymentUrl(res.data.redirect_url);
        window.location.href = res.data.redirect_url;
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memproses Langganan',
        text: err.response?.data?.message || 'Terjadi kendala saat menghubungkan ke payment gateway.',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Batalkan Langganan Pro
  const handleCancelSubscription = async () => {
    const result = await Swal.fire({
      title: 'Batalkan Langganan Pro?',
      html: `
        <div style="text-align: left; font-size: 13.5px; color: #475569; line-height: 1.6;">
          <p style="margin: 0 0 10px; color: #0f172a; font-weight: 700;">
            Apakah Anda yakin ingin membatalkan paket SnapBill Pro Anda?
          </p>
          <p style="margin: 0 0 10px;">
            Setelah dibatalkan:
          </p>
          <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; color: #64748b;">
            <li>Akun Anda akan kembali ke <b>Paket Free</b> (limit 10 invoice/bulan).</li>
            <li>Integrasi Midtrans BYOK untuk klien akan dinonaktifkan.</li>
            <li>Semua invoice, item, dan data klien yang telah Anda buat <b>tetap tersimpan aman</b>.</li>
          </ul>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🚫 Ya, Batalkan Langganan',
      cancelButtonText: 'Pertahankan Paket Pro',
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#6366f1',
      customClass: { popup: 'swal-custom-popup' },
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          const res = await api.post('/api/subscriptions/cancel');
          return res.data;
        } catch (err) {
          Swal.showValidationMessage(err.response?.data?.message || 'Gagal membatalkan langganan.');
          return false;
        }
      },
    });

    if (result.isConfirmed) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pending_sub_order_id');
        localStorage.removeItem('pending_sub_payment_url');
        window.dispatchEvent(new CustomEvent('subscription_updated'));
      }
      setPendingTransaction(null);
      setPendingPaymentUrl(null);
      toast('info', 'Langganan Pro berhasil dibatalkan. Akun Anda kembali ke Paket Free.');
      fetchStatus();
    }
  };

  const isPro = statusData?.tier === 'pro';
  const daysLeft = isPro ? getDaysRemaining(statusData?.subscription_ends_at) : null;
  const invoiceCount = statusData?.invoiceCountThisMonth || 0;
  const usedPercent = Math.min(100, Math.round((invoiceCount / 10) * 100));

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">💎 Paket & Langganan SaaS</h1>
          <p className="page-desc">
            Pantau masa aktif akun SnapBill Anda, upgrade kapasitas pembuatan invoice, atau kelola status langganan.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '40vh' }}>
          <div className="loading-spinner" />
        </div>
      ) : (
        <>
          {/* Pending Payment Alert Banner */}
          {pendingTransaction && !isPro && (
            <div
              className="glass-card"
              style={{
                padding: '20px 24px',
                background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.95), rgba(253, 230, 138, 0.85))',
                border: '1px solid #fde68a',
                borderRadius: 16,
                marginBottom: 28,
                boxShadow: '0 8px 24px -4px rgba(245, 158, 11, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <span style={{ fontSize: 32, lineHeight: 1 }}>⏳</span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#92400e' }}>
                        Menunggu Penyelesaian Pembayaran (Pending)
                      </h4>
                      <span style={{ background: '#f59e0b', color: '#ffffff', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 9999, textTransform: 'uppercase' }}>
                        Pending
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
                      Transaksi langganan Pro Anda sedang menunggu pembayaran di Midtrans.
                    </p>
                    <div style={{ marginTop: 6, fontSize: 12, color: '#92400e', background: 'rgba(255, 255, 255, 0.6)', padding: '6px 12px', borderRadius: 8, display: 'inline-block' }}>
                      Order ID: <b style={{ fontFamily: 'var(--font-mono)' }}>{pendingTransaction.order_id}</b>
                      {pendingTransaction.va_numbers?.[0] && (
                        <span> • <b>{pendingTransaction.va_numbers[0].bank?.toUpperCase()} VA:</b> <code style={{ fontWeight: 800, color: '#b45309' }}>{pendingTransaction.va_numbers[0].va_number}</code></span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {pendingPaymentUrl && (
                    <a
                      href={pendingPaymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary"
                      style={{
                        background: '#6366f1',
                        borderColor: '#6366f1',
                        fontSize: 13,
                        padding: '9px 18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        textDecoration: 'none',
                        boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)',
                      }}
                      title="Buka kembali halaman pembayaran Midtrans"
                    >
                      <span>💳</span>
                      <span>Buka Pembayaran ↗</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleCheckStatus(pendingTransaction.order_id, true)}
                    disabled={checkingStatus}
                    className="btn-primary"
                    style={{
                      background: '#d97706',
                      borderColor: '#d97706',
                      fontSize: 13,
                      padding: '9px 18px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>🔄</span>
                    <span>{checkingStatus ? 'Memeriksa...' : 'Cek Status'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={actionLoading}
                    className="btn-secondary"
                    style={{
                      fontSize: 13,
                      padding: '9px 16px',
                      color: '#92400e',
                      borderColor: '#fde68a',
                      background: '#ffffff',
                    }}
                    title="Buat sesi transaksi baru jika ingin ganti metode pembayaran"
                  >
                    ⚡ Buat Sesi Baru
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        localStorage.removeItem('pending_sub_order_id');
                        localStorage.removeItem('pending_sub_payment_url');
                      }
                      setPendingTransaction(null);
                      setPendingPaymentUrl(null);
                    }}
                    className="btn-secondary"
                    style={{ fontSize: 12, padding: '9px 12px', color: '#92400e', borderColor: '#fde68a' }}
                    title="Tutup pemberitahuan ini"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Current Status Hero Banner */}
          <div
            className="glass-card"
            style={{
              padding: '32px',
              marginBottom: '32px',
              position: 'relative',
              overflow: 'hidden',
              background: isPro
                ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(240, 253, 244, 0.85))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.9))',
              border: isPro ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(226, 232, 240, 0.9)',
            }}
          >
            {/* Background Glow accent */}
            <div
              style={{
                position: 'absolute',
                top: '-40px',
                right: '-40px',
                width: '180px',
                height: '180px',
                background: isPro ? 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 28 }}>{isPro ? '👑' : '📦'}</span>
                  <span
                    style={{
                      background: isPro ? 'linear-gradient(135deg, #10b981, #059669)' : '#64748b',
                      color: '#ffffff',
                      padding: '4px 14px',
                      borderRadius: 9999,
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {isPro ? 'SnapBill PRO (Aktif)' : 'Paket Free (Gratis)'}
                  </span>
                </div>

                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                  {isPro ? 'Anda Menikmati Akses Penuh Fitur Pro' : 'Tingkatkan Bisnis Anda dengan Paket Pro'}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, maxWidth: 580 }}>
                  {isPro
                    ? 'Kuota invoice tanpa batas (unlimited) dan integrasi pembayaran otomatis Midtrans BYOK siap digunakan.'
                    : 'Paket Free dibatasi maksimal 10 invoice per bulan. Upgrade ke Pro untuk invoice unlimited dan payment gateway.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {isPro ? (
                  <button
                    type="button"
                    onClick={handleCancelSubscription}
                    disabled={actionLoading}
                    className="btn-secondary"
                    style={{
                      color: 'var(--rose)',
                      borderColor: 'rgba(244, 63, 94, 0.35)',
                      padding: '10px 18px',
                      fontWeight: 700,
                    }}
                  >
                    🚫 Batalkan Langganan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={actionLoading}
                    className="btn-primary"
                    style={{ padding: '10px 22px', fontSize: 14, fontWeight: 700 }}
                  >
                    {actionLoading ? 'Memproses...' : '⚡ Upgrade ke Pro (Rp 99rb)'}
                  </button>
                )}
              </div>
            </div>

            {/* Status Details Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 16,
                marginTop: 24,
                paddingTop: 20,
                borderTop: '1px solid rgba(226, 232, 240, 0.8)',
              }}
            >
              {/* Masa Aktif */}
              <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                  Masa Aktif Langganan
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 800, color: isPro ? '#0f172a' : '#64748b' }}>
                  {isPro ? formatDateFull(statusData?.subscription_ends_at) : 'Tidak ada masa aktif (Free)'}
                </p>
                {isPro && daysLeft !== null && (
                  <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 700, color: daysLeft <= 3 ? '#e11d48' : '#10b981' }}>
                    ⏳ Sisa waktu: <b>{daysLeft} Hari Lagi</b>
                  </span>
                )}
              </div>

              {/* Kuota Invoice */}
              <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                  Pembuatan Invoice Bulan Ini
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  {isPro ? `${invoiceCount} Invoice (Unlimited ♾️)` : `${invoiceCount} / 10 Invoice`}
                </p>
                {!isPro && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${usedPercent}%`, background: usedPercent >= 80 ? '#f43f5e' : '#6366f1', borderRadius: 9999 }} />
                    </div>
                    <span style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, display: 'block' }}>
                      Sisa kuota: <b>{statusData?.remainingInvoices ?? 0} invoice</b>
                    </span>
                  </div>
                )}
              </div>

              {/* Status Payment Gateway BYOK */}
              <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                  Midtrans Payment BYOK
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 800, color: isPro ? '#10b981' : '#94a3b8' }}>
                  {isPro ? '✓ Aktif & Siap Digunakan' : '✕ Memerlukan Paket Pro'}
                </p>
                <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, color: '#64748b' }}>
                  {isPro ? 'Klien bisa bayar otomatis via QRIS & VA' : 'Upgrade untuk mengaktifkan Midtrans'}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Comparison Cards */}
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
            Pilihan Paket Layanan SnapBill
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginBottom: 36 }}>
            {/* Free Plan Card */}
            <div
              className="glass-card"
              style={{
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                border: !isPro ? '2px solid #6366f1' : '1px solid #e2e8f0',
                position: 'relative',
              }}
            >
              {!isPro && (
                <span
                  style={{
                    position: 'absolute',
                    top: -12,
                    right: 20,
                    background: '#6366f1',
                    color: '#ffffff',
                    padding: '2px 12px',
                    borderRadius: 9999,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  Paket Anda Saat Ini
                </span>
              )}

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>Paket Free</h4>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Untuk freelancer atau bisnis yang baru mulai.</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-main)' }}>Rp 0</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}> / selamanya</span>
              </div>

              <ul style={{ margin: '0 0 24px', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, color: '#334155' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> Maksimal <b>10 Invoice</b> per bulan
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> Manajemen Klien & Item Layanan
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> Upload Bukti Transfer Manual
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> Unduh Faktur Format PDF
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
                  <span style={{ color: '#cbd5e1', fontWeight: 800 }}>✕</span> Tanpa Payment Gateway Midtrans
                </li>
              </ul>

              <div style={{ marginTop: 'auto' }}>
                <button
                  type="button"
                  disabled={!isPro}
                  className="btn-secondary"
                  style={{ width: '100%', textAlign: 'center', opacity: !isPro ? 0.7 : 1, cursor: !isPro ? 'default' : 'pointer' }}
                >
                  {!isPro ? 'Sedang Digunakan' : 'Paket Dasar Gratis'}
                </button>
              </div>
            </div>

            {/* Pro Plan Card */}
            <div
              className="glass-card"
              style={{
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                border: isPro ? '2px solid #10b981' : '2px solid #6366f1',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(238, 242, 255, 0.9))',
                boxShadow: '0 20px 40px -10px rgba(99, 102, 241, 0.2)',
                position: 'relative',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: -12,
                  right: 20,
                  background: isPro ? '#10b981' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  color: '#ffffff',
                  padding: '3px 14px',
                  borderRadius: 9999,
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                }}
              >
                {isPro ? '✓ Paket Aktif' : '🔥 Paling Populer'}
              </span>

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>Paket PRO</h4>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Otomatisasi penagihan dan skala bisnis profesional.</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: '#4f46e5' }}>Rp 99.000</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}> / bulan</span>
              </div>

              <ul style={{ margin: '0 0 24px', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, color: '#1e293b' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> <b>Unlimited Invoices</b> (Tanpa batasan kuota)
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> <b>Midtrans Payment Gateway (BYOK)</b>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> Kuitansi Otomatis & Email Terima Kasih
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> Kirim Ulang Email Notifikasi ke Klien
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> Generate File Faktur PDF Resmi
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> Prioritas Pemrosesan & Dukungan
                </li>
              </ul>

              <div style={{ marginTop: 'auto' }}>
                {isPro ? (
                  <button
                    type="button"
                    disabled
                    className="btn-primary"
                    style={{ width: '100%', textAlign: 'center', background: '#10b981', borderColor: '#10b981', opacity: 0.9, cursor: 'default' }}
                  >
                    ✓ Paket Pro Sedang Aktif
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={actionLoading}
                    className="btn-primary"
                    style={{ width: '100%', textAlign: 'center', padding: '12px 20px', fontSize: 14, fontWeight: 700 }}
                  >
                    {actionLoading ? 'Menghubungkan Midtrans...' : '⚡ Upgrade ke Pro Sekarang'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* FAQ & Information Box */}
          <div className="glass-card" style={{ padding: '24px 28px' }}>
            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: 'var(--text-main)' }}>
              💡 Pertanyaan Umum Seputar Langganan
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5, color: '#475569' }}>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#0f172a' }}>
                  Bagaimana cara pembayaran langganan Pro dilakukan?
                </p>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  Pembayaran diproses secara instan melalui Midtrans. Anda dapat membayar menggunakan QRIS (GoPay, OVO, ShopeePay, DANA), Virtual Account Bank (BCA, Mandiri, BNI, BRI, Permata), maupun Kartu Kredit.
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#0f172a' }}>
                  Apakah data invoice saya akan hilang jika saya membatalkan langganan Pro?
                </p>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  <b>Tidak.</b> Seluruh data invoice, klien, dan item yang telah Anda buat akan tetap tersimpan aman di akun Anda dan dapat diakses kapan saja.
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#0f172a' }}>
                  Bisakah saya berlangganan kembali setelah membatalkan?
                </p>
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  Tentu saja! Anda dapat melakukan upgrade kembali ke Paket Pro kapan pun Anda membutuhkan kuota unlimited dan fitur pembayaran Midtrans.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    }>
      <SubscriptionContent />
    </Suspense>
  );
}
