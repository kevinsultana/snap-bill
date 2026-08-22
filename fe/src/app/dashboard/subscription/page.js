'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from '@/lib/toast';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';

function formatDateFull(dateStr, lang = 'id') {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) + (lang === 'en' ? ' WIB (UTC+7)' : ' WIB');
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
  const { t, lang } = useTranslation();

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
            title: t('subscription.pending_title'),
            text: 'Pembayaran Anda masih dalam status Pending. Silakan klik tombol "Buka Pembayaran" untuk melihat kode transfer / QRIS.',
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
          toast('error', `Transaksi ${data.status}. Silakan buat sesi pembayaran baru.`);
        }
      }
    } catch {
      if (showToast) toast('error', 'Gagal memverifikasi status pembayaran ke Midtrans');
    } finally {
      setCheckingStatus(false);
    }
  }, [fetchStatus, t]);

  // Initial load: ambil status langganan & cek jika ada pending order_id
  useEffect(() => {
    fetchStatus();

    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('pending_sub_payment_url');
      if (savedUrl) setPendingPaymentUrl(savedUrl);
    }

    if (urlSubscribed && urlOrderId) {
      handleCheckStatus(urlOrderId, true);
    } else if (typeof window !== 'undefined') {
      const savedOrderId = localStorage.getItem('pending_sub_order_id');
      if (savedOrderId) {
        handleCheckStatus(savedOrderId, false);
      }
    }
  }, [fetchStatus, handleCheckStatus, urlOrderId, urlSubscribed]);

  // Handler Upgrade Paket Pro
  const handleUpgrade = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/api/subscriptions/create-snap');
      const { payment_url, order_id } = res.data;

      if (typeof window !== 'undefined') {
        if (order_id) localStorage.setItem('pending_sub_order_id', order_id);
        if (payment_url) localStorage.setItem('pending_sub_payment_url', payment_url);
      }
      setPendingPaymentUrl(payment_url);
      setPendingTransaction({ order_id, status: 'pending' });

      if (payment_url) {
        const win = window.open(payment_url, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
          window.location.href = payment_url;
        }
      }
    } catch (err) {
      toast('error', err.response?.data?.message || 'Gagal memulai transaksi Midtrans');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler Pembatalan Langganan Pro
  const handleCancelSubscription = async () => {
    const result = await Swal.fire({
      title: t('subscription.cancel_confirm_title'),
      text: t('subscription.cancel_confirm_text'),
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: t('subscription.cancel_confirm_btn'),
      cancelButtonText: t('subscription.cancel_keep_btn'),
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#6366f1',
      customClass: { popup: 'swal-custom-popup' },
    });

    if (result.isConfirmed) {
      setActionLoading(true);
      try {
        const res = await api.post('/api/subscriptions/cancel');
        await fetchStatus();

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('subscription_updated'));
        }

        Swal.fire({
          icon: 'success',
          title: 'Langganan Telah Dibatalkan',
          text: res.data?.message || 'Akun Anda telah dikembalikan ke paket Free (kuota 10 invoice per bulan).',
          confirmButtonColor: '#6366f1',
          customClass: { popup: 'swal-custom-popup' },
        });
      } catch (err) {
        toast('error', err.response?.data?.message || 'Gagal membatalkan langganan');
      } finally {
        setActionLoading(false);
      }
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
          <h1 className="page-title">{t('subscription.title')}</h1>
          <p className="page-desc">
            {t('subscription.desc')}
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
                        {t('subscription.pending_title')}
                      </h4>
                      <span style={{ background: '#f59e0b', color: '#ffffff', fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 9999, textTransform: 'uppercase' }}>
                        Pending
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#78350f', lineHeight: 1.5 }}>
                      {t('subscription.pending_desc')}
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
                      <span>{t('subscription.btn_reopen_payment')}</span>
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
                    <span>{checkingStatus ? 'Memeriksa...' : t('subscription.btn_check_status')}</span>
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
                    {t('subscription.btn_new_session')}
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
                    {isPro ? t('subscription.active_pro_badge') : t('subscription.free_badge')}
                  </span>
                </div>

                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                  {isPro ? t('subscription.pro_hero_title') : t('subscription.free_hero_title')}
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0, maxWidth: 580 }}>
                  {isPro
                    ? t('subscription.pro_hero_desc')
                    : t('subscription.free_hero_desc')}
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                {isPro ? (
                  <>
                    <button
                      type="button"
                      onClick={handleUpgrade}
                      disabled={actionLoading}
                      className="btn-primary"
                      style={{ padding: '10px 20px', fontSize: 14, fontWeight: 700 }}
                    >
                      {actionLoading ? 'Memproses...' : t('subscription.btn_extend_pro')}
                    </button>

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
                      {t('subscription.btn_cancel_sub')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={actionLoading}
                    className="btn-primary"
                    style={{ padding: '10px 22px', fontSize: 14, fontWeight: 700 }}
                  >
                    {actionLoading ? 'Memproses...' : t('subscription.btn_upgrade_hero')}
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
                  {t('subscription.active_until')}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 800, color: isPro ? '#0f172a' : '#64748b' }}>
                  {isPro ? formatDateFull(statusData?.subscription_ends_at, lang) : t('subscription.no_expiry')}
                </p>
                {isPro && daysLeft !== null && (
                  <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, fontWeight: 700, color: daysLeft <= 3 ? '#e11d48' : '#10b981' }}>
                    {t('subscription.days_left', { days: daysLeft })}
                  </span>
                )}
              </div>

              {/* Kuota Invoice */}
              <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                  {t('subscription.invoices_created_this_month')}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  {isPro ? `${invoiceCount} Invoice (${t('subscription.unlimited')})` : `${invoiceCount} / 10 Invoice`}
                </p>
                {!isPro && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ height: 6, background: '#f1f5f9', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${usedPercent}%`, background: usedPercent >= 80 ? '#f43f5e' : '#6366f1', borderRadius: 9999 }} />
                    </div>
                    <span style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, display: 'block' }}>
                      {t('subscription.remaining_quota', { count: statusData?.remainingInvoices ?? 0 })}
                    </span>
                  </div>
                )}
              </div>

              {/* Status Payment Gateway BYOK */}
              <div style={{ background: '#ffffff', padding: '16px 18px', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                  {t('subscription.midtrans_status')}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 800, color: isPro ? '#10b981' : '#94a3b8' }}>
                  {isPro ? t('subscription.midtrans_active') : t('subscription.midtrans_inactive')}
                </p>
                <span style={{ display: 'inline-block', marginTop: 4, fontSize: 11, color: '#64748b' }}>
                  {isPro ? t('subscription.midtrans_active_desc') : t('subscription.midtrans_inactive_desc')}
                </span>
              </div>
            </div>
          </div>

          {/* Pricing Comparison Cards */}
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16 }}>
            {t('subscription.plan_choice_title')}
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
                  {t('subscription.current_plan_badge')}
                </span>
              )}

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>{t('landing.pricing_free_title')}</h4>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{t('landing.pricing_free_desc')}</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-main)' }}>Rp 0</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}> {t('landing.pricing_free_period')}</span>
              </div>

              <ul style={{ margin: '0 0 24px', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, color: '#334155' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> <b>{t('landing.pricing_free_f1')}</b>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> {t('landing.pricing_free_f2')}
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> {t('landing.pricing_free_f3')}
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> {t('landing.pricing_free_f4')}
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
                  <span style={{ color: '#cbd5e1', fontWeight: 800 }}>✕</span> Midtrans Gateway (BYOK)
                </li>
              </ul>

              <div style={{ marginTop: 'auto' }}>
                <button
                  type="button"
                  disabled={!isPro}
                  className="btn-secondary"
                  style={{ width: '100%', textAlign: 'center', opacity: !isPro ? 0.7 : 1, cursor: !isPro ? 'default' : 'pointer' }}
                >
                  {!isPro ? t('subscription.using_now_btn') : t('landing.pricing_free_title')}
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
                {isPro ? '✓ Pro Aktif' : t('landing.pricing_pro_badge')}
              </span>

              <div style={{ marginBottom: 16 }}>
                <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>{t('landing.pricing_pro_title')}</h4>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{t('landing.pricing_pro_desc')}</p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: '#4f46e5' }}>Rp 99.000</span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}> {t('landing.pricing_pro_period')}</span>
              </div>

              <ul style={{ margin: '0 0 24px', paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, color: '#1e293b' }}>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> <b>{t('landing.pricing_pro_f1')}</b>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> <b>{t('landing.pricing_pro_f2')}</b>
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> {t('landing.pricing_pro_f3')}
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> {t('landing.pricing_pro_f4')}
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> {t('landing.pricing_pro_f5')}
                </li>
                <li style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span> {t('landing.pricing_pro_f6')}
                </li>
              </ul>

              <div style={{ marginTop: 'auto' }}>
                {isPro ? (
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={actionLoading}
                    className="btn-primary"
                    style={{ width: '100%', textAlign: 'center', padding: '12px 20px', fontSize: 14, fontWeight: 700 }}
                  >
                    {actionLoading ? 'Menghubungkan Midtrans...' : t('subscription.btn_extend_pro')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    disabled={actionLoading}
                    className="btn-primary"
                    style={{ width: '100%', textAlign: 'center', padding: '12px 20px', fontSize: 14, fontWeight: 700 }}
                  >
                    {actionLoading ? 'Menghubungkan Midtrans...' : t('subscription.upgrade_now_btn')}
                  </button>
                )}
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
