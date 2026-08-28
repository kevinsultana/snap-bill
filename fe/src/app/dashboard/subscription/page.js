'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from '@/lib/toast';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { Clock, CreditCard, RefreshCw, Sparkles, Package } from 'lucide-react';

const BTN_PRIMARY = 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed';
const BTN_SECONDARY = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold transition-all disabled:opacity-60';
const BTN_DANGER = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold transition-all disabled:opacity-60';

function formatDateFull(dateStr, lang = 'id') {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
    timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) + (lang === 'en' ? ' WIB (UTC+7)' : ' WIB');
}

function getDaysRemaining(dateStr) {
  if (!dateStr) return null;
  const diffMs = new Date(dateStr).getTime() - Date.now();
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
    } catch { toast('error', 'Gagal memuat informasi langganan'); return null; }
    finally { setLoading(false); }
  }, []);

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
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        setPendingTransaction(null); setPendingPaymentUrl(null);
        await fetchStatus();
        if (showToast) Swal.fire({ icon: 'success', title: 'Selamat Datang di SnapBill PRO!', text: data.message || 'Pembayaran berhasil diverifikasi!', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
      } else if (data.status === 'pending') {
        if (typeof window !== 'undefined') localStorage.setItem('pending_sub_order_id', orderIdToCheck);
        setPendingTransaction(data);
        if (showToast) Swal.fire({ icon: 'info', title: t('subscription.pending_title'), text: 'Pembayaran Anda masih pending. Klik "Buka Pembayaran" untuk melanjutkan.', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
      } else if (['failed', 'expire', 'cancel'].includes(data.status)) {
        if (typeof window !== 'undefined') { localStorage.removeItem('pending_sub_order_id'); localStorage.removeItem('pending_sub_payment_url'); window.history.replaceState({}, document.title, window.location.pathname); }
        setPendingTransaction(null); setPendingPaymentUrl(null);
        if (showToast) toast('error', `Transaksi ${data.status}. Silakan buat sesi pembayaran baru.`);
      }
    } catch { if (showToast) toast('error', 'Gagal memverifikasi status pembayaran ke Midtrans'); }
    finally { setCheckingStatus(false); }
  }, [fetchStatus, t]);

  useEffect(() => {
    fetchStatus();
    if (typeof window !== 'undefined') {
      const savedUrl = localStorage.getItem('pending_sub_payment_url');
      if (savedUrl) setPendingPaymentUrl(savedUrl);
    }
    if (urlSubscribed && urlOrderId) handleCheckStatus(urlOrderId, true);
    else if (typeof window !== 'undefined') {
      const savedOrderId = localStorage.getItem('pending_sub_order_id');
      if (savedOrderId) handleCheckStatus(savedOrderId, false);
    }
  }, [fetchStatus, handleCheckStatus, urlOrderId, urlSubscribed]);

  const handleUpgrade = async () => {
    setActionLoading(true);
    try {
      const res = await api.post('/api/subscriptions/create-snap');
      const paymentUrl = res.data?.redirect_url || res.data?.payment_url;
      const orderId = res.data?.order_id;
      if (typeof window !== 'undefined') {
        if (orderId) localStorage.setItem('pending_sub_order_id', orderId);
        if (paymentUrl) localStorage.setItem('pending_sub_payment_url', paymentUrl);
      }
      setPendingPaymentUrl(paymentUrl);
      setPendingTransaction({ order_id: orderId, status: 'pending' });
      if (paymentUrl) window.location.href = paymentUrl;
    } catch (err) { toast('error', err.response?.data?.message || 'Gagal memulai transaksi Midtrans'); }
    finally { setActionLoading(false); }
  };

  const handleCancelSubscription = async () => {
    const result = await Swal.fire({ title: t('subscription.cancel_confirm_title'), text: t('subscription.cancel_confirm_text'), icon: 'warning', showCancelButton: true, confirmButtonText: t('subscription.cancel_confirm_btn'), cancelButtonText: t('subscription.cancel_keep_btn'), confirmButtonColor: '#f43f5e', cancelButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
    if (result.isConfirmed) {
      setActionLoading(true);
      try {
        const res = await api.post('/api/subscriptions/cancel');
        await fetchStatus();
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('subscription_updated'));
        Swal.fire({ icon: 'success', title: 'Langganan Telah Dibatalkan', text: res.data?.message || 'Akun dikembalikan ke paket Free (10 invoice/bulan).', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
      } catch (err) { toast('error', err.response?.data?.message || 'Gagal membatalkan langganan'); }
      finally { setActionLoading(false); }
    }
  };

  const isPro = statusData?.tier === 'pro';
  const daysLeft = isPro ? getDaysRemaining(statusData?.subscription_ends_at) : null;
  const invoiceCount = statusData?.invoiceCountThisMonth || 0;
  const usedPercent = Math.min(100, Math.round((invoiceCount / 10) * 100));

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-16">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{t('subscription.title')}</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{t('subscription.desc')}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Pending Payment Alert */}
          {pendingTransaction && !isPro && (
            <div className="mb-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-yellow-300 rounded-2xl p-5 shadow-sm shadow-amber-100">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 flex-1 min-w-[240px]">
                  <Clock className="w-8 h-8 text-amber-600 shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h4 className="text-sm font-extrabold text-amber-900">{t('subscription.pending_title')}</h4>
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-500 text-white">Pending</span>
                    </div>
                    <p className="text-xs text-amber-800 leading-relaxed mb-2">{t('subscription.pending_desc')}</p>
                    <div className="inline-block text-xs font-semibold text-amber-900 bg-white/70 px-3 py-1.5 rounded-lg border border-amber-200">
                      Order ID: <b className="font-mono">{pendingTransaction.order_id}</b>
                      {pendingTransaction.va_numbers?.[0] && (
                        <span> • <b>{pendingTransaction.va_numbers[0].bank?.toUpperCase()} VA:</b> <code className="font-bold text-amber-700">{pendingTransaction.va_numbers[0].va_number}</code></span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  {pendingPaymentUrl && (
                    <a href={pendingPaymentUrl} target="_blank" rel="noopener noreferrer" className={BTN_PRIMARY} style={{ background: '#6366f1' }}>
                      <CreditCard className="w-4 h-4" /> {t('subscription.btn_reopen_payment')}
                    </a>
                  )}
                  <button type="button" onClick={() => handleCheckStatus(pendingTransaction.order_id, true)} disabled={checkingStatus} className={BTN_PRIMARY} style={{ background: '#d97706' }}>
                    <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} /> {checkingStatus ? 'Memeriksa...' : t('subscription.btn_check_status')}
                  </button>
                  <button type="button" onClick={handleUpgrade} disabled={actionLoading} className={BTN_SECONDARY} style={{ color: '#92400e', borderColor: '#fde68a' }}>
                    {t('subscription.btn_new_session')}
                  </button>
                  <button type="button" onClick={() => { if (typeof window !== 'undefined') { localStorage.removeItem('pending_sub_order_id'); localStorage.removeItem('pending_sub_payment_url'); } setPendingTransaction(null); setPendingPaymentUrl(null); }} className={BTN_SECONDARY} style={{ color: '#92400e', borderColor: '#fde68a' }}>
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Current Status Hero Banner ── */}
          <div className={`relative overflow-hidden rounded-3xl border p-7 sm:p-8 mb-7 ${isPro ? 'bg-gradient-to-br from-white to-emerald-50/60 border-emerald-200' : 'bg-gradient-to-br from-white to-slate-50/80 border-slate-200'} shadow-sm`}>
            {/* Glow */}
            <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none ${isPro ? 'bg-emerald-400/10' : 'bg-indigo-400/10'} blur-2xl`} />

            <div className="flex flex-wrap justify-between items-start gap-5">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  {isPro ? (
                    <Sparkles className="w-7 h-7 text-emerald-600" />
                  ) : (
                    <Package className="w-7 h-7 text-slate-500" />
                  )}
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider text-white ${isPro ? 'bg-emerald-500' : 'bg-slate-500'}`}>
                    {isPro ? t('subscription.active_pro_badge') : t('subscription.free_badge')}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1.5">
                  {isPro ? t('subscription.pro_hero_title') : t('subscription.free_hero_title')}
                </h2>
                <p className="text-sm text-slate-600 max-w-lg leading-relaxed">
                  {isPro ? t('subscription.pro_hero_desc') : t('subscription.free_hero_desc')}
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5 items-center">
                {isPro ? (
                  <>
                    <button type="button" onClick={handleUpgrade} disabled={actionLoading} className={BTN_PRIMARY}>
                      {actionLoading ? 'Memproses...' : t('subscription.btn_extend_pro')}
                    </button>
                    <button type="button" onClick={handleCancelSubscription} disabled={actionLoading} className={BTN_DANGER}>
                      {t('subscription.btn_cancel_sub')}
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={handleUpgrade} disabled={actionLoading} className={BTN_PRIMARY}>
                    {actionLoading ? 'Memproses...' : t('subscription.btn_upgrade_hero')}
                  </button>
                )}
              </div>
            </div>

            {/* Status Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-100">
              {/* Masa Aktif */}
              <div className="bg-white rounded-xl border border-slate-100 px-4 py-3.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">{t('subscription.active_until')}</p>
                <p className={`text-sm font-extrabold ${isPro ? 'text-slate-900' : 'text-slate-400'}`}>
                  {isPro ? formatDateFull(statusData?.subscription_ends_at, lang) : t('subscription.no_expiry')}
                </p>
                {isPro && daysLeft !== null && (
                  <span className={`inline-block mt-1 text-[11px] font-bold ${daysLeft <= 3 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {t('subscription.days_left', { days: daysLeft })}
                  </span>
                )}
              </div>
              {/* Kuota Invoice */}
              <div className="bg-white rounded-xl border border-slate-100 px-4 py-3.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">{t('subscription.invoices_created_this_month')}</p>
                <p className="text-sm font-extrabold text-slate-900">
                  {isPro ? `${invoiceCount} Invoice (${t('subscription.unlimited')})` : `${invoiceCount} / 10 Invoice`}
                </p>
                {!isPro && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${usedPercent >= 80 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${usedPercent}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">{t('subscription.remaining_quota', { count: statusData?.remainingInvoices ?? 0 })}</p>
                  </div>
                )}
              </div>
              {/* Midtrans Status */}
              <div className="bg-white rounded-xl border border-slate-100 px-4 py-3.5">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">{t('subscription.midtrans_status')}</p>
                <p className={`text-sm font-extrabold ${isPro ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {isPro ? t('subscription.midtrans_active') : t('subscription.midtrans_inactive')}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">{isPro ? t('subscription.midtrans_active_desc') : t('subscription.midtrans_inactive_desc')}</p>
              </div>
            </div>
          </div>

          {/* ── Pricing Cards ── */}
          <h3 className="text-lg font-extrabold text-slate-900 mb-4">{t('subscription.plan_choice_title')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Free Plan */}
            <div className={`relative flex flex-col bg-white rounded-3xl border-2 p-7 ${!isPro ? 'border-indigo-500' : 'border-slate-200'}`}>
              {!isPro && (
                <span className="absolute -top-3 right-5 inline-block px-3 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-extrabold uppercase">
                  {t('subscription.current_plan_badge')}
                </span>
              )}
              <div className="mb-4">
                <h4 className="text-lg font-extrabold text-slate-900">{t('landing.pricing_free_title')}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{t('landing.pricing_free_desc')}</p>
              </div>
              <div className="mb-5">
                <span className="text-3xl font-extrabold text-slate-900">Rp 0</span>
                <span className="text-sm text-slate-500"> {t('landing.pricing_free_period')}</span>
              </div>
              <ul className="flex flex-col gap-2.5 text-sm text-slate-700 mb-6 list-none p-0">
                {[t('landing.pricing_free_f1'), t('landing.pricing_free_f2'), t('landing.pricing_free_f3'), t('landing.pricing_free_f4')].map((f, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="text-emerald-500 font-extrabold">✓</span> {i === 0 ? <b>{f}</b> : f}</li>
                ))}
                <li className="flex items-center gap-2 text-slate-400"><span className="font-extrabold">✕</span> Midtrans Gateway (BYOK)</li>
              </ul>
              <div className="mt-auto">
                <button type="button" disabled={!isPro} className={`w-full py-2.5 rounded-xl text-sm font-bold border transition ${!isPro ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-default' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'}`}>
                  {!isPro ? t('subscription.using_now_btn') : t('landing.pricing_free_title')}
                </button>
              </div>
            </div>

            {/* Pro Plan */}
            <div className={`relative flex flex-col bg-gradient-to-br from-white to-indigo-50/60 rounded-3xl border-2 p-7 shadow-lg shadow-indigo-100/50 ${isPro ? 'border-emerald-500' : 'border-indigo-500'}`}>
              <span className={`absolute -top-3 right-5 inline-block px-3 py-0.5 rounded-full text-white text-[11px] font-extrabold uppercase ${isPro ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-600 to-purple-600'}`}>
                {isPro ? '✓ Pro Aktif' : t('landing.pricing_pro_badge')}
              </span>
              <div className="mb-4">
                <h4 className="text-lg font-extrabold text-slate-900">{t('landing.pricing_pro_title')}</h4>
                <p className="text-xs text-slate-500 mt-0.5">{t('landing.pricing_pro_desc')}</p>
              </div>
              <div className="mb-5">
                <span className="text-3xl font-extrabold text-indigo-700">Rp 99.000</span>
                <span className="text-sm text-slate-500"> {t('landing.pricing_pro_period')}</span>
              </div>
              <ul className="flex flex-col gap-2.5 text-sm text-slate-800 mb-6 list-none p-0">
                {[t('landing.pricing_pro_f1'), t('landing.pricing_pro_f2'), t('landing.pricing_pro_f3'), t('landing.pricing_pro_f4'), t('landing.pricing_pro_f5'), t('landing.pricing_pro_f6')].map((f, i) => (
                  <li key={i} className="flex items-center gap-2"><span className="text-emerald-500 font-extrabold">✓</span> {i < 2 ? <b>{f}</b> : f}</li>
                ))}
              </ul>
              <div className="mt-auto">
                <button type="button" onClick={handleUpgrade} disabled={actionLoading} className={`${BTN_PRIMARY} w-full py-3 text-sm`}>
                  {actionLoading ? 'Menghubungkan Midtrans...' : isPro ? t('subscription.btn_extend_pro') : t('subscription.upgrade_now_btn')}
                </button>
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
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    }>
      <SubscriptionContent />
    </Suspense>
  );
}
