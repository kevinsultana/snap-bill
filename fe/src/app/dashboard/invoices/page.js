'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';
import Pagination from '@/components/Pagination';

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(dateStr, lang = 'id') {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

const STATUS_TAILWIND = {
  draft:                'bg-slate-100 text-slate-700 border border-slate-200',
  unpaid:               'bg-amber-50 text-amber-800 border border-amber-200',
  pending_verification: 'bg-blue-50 text-blue-800 border border-blue-200',
  paid:                 'bg-emerald-50 text-emerald-800 border border-emerald-200',
  overdue:              'bg-rose-50 text-rose-800 border border-rose-200',
  cancelled:            'bg-slate-100 text-slate-600 border border-slate-200',
};

const INPUT_CLS = 'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all';

export default function InvoicesPage() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [channelCounts, setChannelCounts] = useState({ all: 0, midtrans: 0, manual: 0 });
  const [userSettings, setUserSettings] = useState(null);

  const STATUS_CONFIG = {
    draft:                { label: t('invoices.status_draft') },
    unpaid:               { label: t('invoices.status_unpaid') },
    pending_verification: { label: t('invoices.status_pending_verification') },
    paid:                 { label: t('invoices.status_paid') },
    overdue:              { label: t('invoices.status_overdue') },
    cancelled:            { label: t('invoices.status_cancelled') },
  };

  useEffect(() => {
    const handler = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/invoices', {
        params: { page, limit: 10, search: debouncedSearch, status: filterStatus, channel: filterChannel, paginate: 'true' },
      });
      if (res.data && Array.isArray(res.data.data)) {
        setInvoices(res.data.data);
        setTotal(res.data.total || 0);
        setTotalAll(res.data.totalAll || 0);
        setTotalPages(res.data.totalPages || 1);
        if (res.data.counts) setStatusCounts(res.data.counts);
        if (res.data.channelCounts) setChannelCounts(res.data.channelCounts);
      } else if (Array.isArray(res.data)) {
        setInvoices(res.data); setTotal(res.data.length); setTotalAll(res.data.length); setTotalPages(1);
      }
    } catch { toast('error', 'Gagal memuat data invoice'); } finally { setLoading(false); }
  }, [page, debouncedSearch, filterStatus, filterChannel]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { api.get('/api/settings').then((r) => setUserSettings(r.data)).catch(() => {}); }, []);

  const isPro = userSettings?.tier === 'pro' && (!userSettings?.subscription_ends_at || new Date(userSettings.subscription_ends_at) > new Date());

  const handleSubmitInvoice = async (inv) => {
    const result = await Swal.fire({
      title: 'Terbitkan Invoice ini?',
      html: `<p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 10px;">Invoice <b style="color:#0f172a;">#${inv.invoice_number}</b> akan diterbitkan ke klien <b style="color:#0f172a;">${inv.client?.name || ''}</b>.</p><p style="color:#64748b;font-size:12px;margin:0;">Status akan diubah menjadi <b>Belum Dibayar</b>, PDF dibuat, dan email tagihan dikirim ke klien.</p>`,
      icon: 'question', showCancelButton: true, confirmButtonText: '🚀 Ya, Terbitkan',
      cancelButtonText: t('common.cancel'), confirmButtonColor: '#6366f1', cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' }, showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => { try { Swal.showLoading(); return (await api.post(`/api/invoices/${inv.id}/submit`)).data; } catch (err) { Swal.showValidationMessage(err.response?.data?.message || 'Gagal menerbitkan invoice.'); return false; } },
    });
    if (result.isConfirmed && result.value) {
      await Swal.fire({ icon: 'success', title: '🎉 Invoice Berhasil Diterbitkan!', html: `<p style="color:#475569;font-size:13px;margin:0 0 8px;">Link pembayaran publik untuk klien telah aktif:</p><div style="margin-top:6px;padding:12px;background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;word-break:break-all;font-family:monospace;font-size:12px;color:#4f46e5;user-select:all;">${result.value.public_link}</div>`, confirmButtonText: 'Selesai', confirmButtonColor: '#6366f1', customClass: { popup: 'swal-custom-popup' } });
      fetchInvoices();
    }
  };

  const handleCancelInvoice = async (inv) => {
    const result = await Swal.fire({ title: 'Batalkan Invoice ini?', html: `<p style="color:#475569;font-size:14px;line-height:1.6;margin:0;">Invoice <b style="color:#0f172a;">#${inv.invoice_number}</b> akan ditandai sebagai <b>Dibatalkan</b>.</p>`, icon: 'warning', showCancelButton: true, confirmButtonText: '🚫 Ya, Batalkan', cancelButtonText: t('common.cancel'), confirmButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8', customClass: { popup: 'swal-custom-popup' }, showLoaderOnConfirm: true, allowOutsideClick: () => !Swal.isLoading(), preConfirm: async () => { try { Swal.showLoading(); return (await api.post(`/api/invoices/${inv.id}/cancel`)).data; } catch (err) { Swal.showValidationMessage(err.response?.data?.message || 'Gagal membatalkan.'); return false; } } });
    if (result.isConfirmed) { toast('success', `Invoice #${inv.invoice_number} berhasil dibatalkan.`); fetchInvoices(); }
  };

  const handleRefreshMidtrans = async (inv) => {
    const result = await Swal.fire({ title: 'Ajukan Ulang Sesi Midtrans?', html: `<p style="color:#475569;font-size:14px;">Sistem akan membuatkan token baru untuk invoice <b>#${inv.invoice_number}</b>.</p>`, icon: 'question', showCancelButton: true, confirmButtonText: '🔄 Ya, Ajukan Ulang', cancelButtonText: t('common.cancel'), confirmButtonColor: '#6366f1', cancelButtonColor: '#94a3b8', customClass: { popup: 'swal-custom-popup' }, showLoaderOnConfirm: true, allowOutsideClick: () => !Swal.isLoading(), preConfirm: async () => { try { Swal.showLoading(); return (await api.post(`/api/invoices/${inv.id}/refresh-midtrans`)).data; } catch (err) { Swal.showValidationMessage(err.response?.data?.message || 'Gagal membuat sesi baru.'); return false; } } });
    if (result.isConfirmed && result.value) { toast('success', `Sesi Midtrans untuk #${inv.invoice_number} berhasil diperbarui!`); fetchInvoices(); }
  };

  const handleReviewPayment = (inv) => {
    const isPdf = inv.receipt_url?.toLowerCase().endsWith('.pdf');
    const receiptContent = inv.receipt_url ? isPdf
      ? `<div style="margin:16px 0;padding:20px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;text-align:center;"><div style="font-size:36px;margin-bottom:8px;">📄</div><p style="color:#0f172a;font-weight:700;font-size:14px;margin:0 0 8px;">${t('invoices.receipt_pdf_doc')}</p><a href="${inv.receipt_url}" target="_blank" rel="noopener noreferrer" style="color:#4f46e5;font-weight:700;text-decoration:underline;font-size:13px;">👁️ ${t('invoices.receipt_click_pdf')}</a></div>`
      : `<div style="margin:16px 0;text-align:center;"><div style="max-height:320px;overflow-y:auto;background:#f8fafc;padding:10px;border-radius:14px;border:1px solid #e2e8f0;"><img src="${inv.receipt_url}" alt="Bukti Pembayaran" style="max-width:100%;max-height:280px;border-radius:8px;object-fit:contain;margin:0 auto;display:block;"/></div><a href="${inv.receipt_url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:8px;color:#4f46e5;font-weight:600;font-size:12px;">🔍 ${t('invoices.receipt_open_full')}</a></div>`
      : `<div style="margin:20px 0;padding:20px;background:#f8fafc;border-radius:14px;border:1px solid #e2e8f0;text-align:center;color:#64748b;"><p style="margin:0;">${t('invoices.receipt_not_uploaded')}</p></div>`;

    Swal.fire({
      title: t('invoices.verify_modal_title'),
      html: `<div style="text-align:left;font-size:14px;"><p style="margin-bottom:6px;"><b>No. Invoice:</b> #${inv.invoice_number}</p><p style="margin-bottom:6px;"><b>Klien:</b> ${inv.client?.name || '—'}</p><p style="margin-bottom:12px;"><b>Total Tagihan:</b> <span style="font-weight:800;color:#059669;">${formatRupiah(inv.total)}</span></p><p style="margin:10px 0 4px;font-weight:600;color:#475569;">${t('invoices.receipt_image')}</p>${receiptContent}</div>`,
      showDenyButton: true, showCancelButton: true, confirmButtonText: t('invoices.verify_approve'),
      denyButtonText: t('invoices.verify_reject'), cancelButtonText: t('common.close'),
      confirmButtonColor: '#10b981', denyButtonColor: '#f43f5e', cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup swal-review-popup' }, showLoaderOnConfirm: true, showLoaderOnDeny: true, allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => { try { Swal.showLoading(); await api.post(`/api/invoices/${inv.id}/verify`, { action: 'approve' }); return { action: 'approve' }; } catch (err) { Swal.showValidationMessage(err.response?.data?.message || 'Gagal menyetujui pembayaran.'); return false; } },
      preDeny: async () => { try { Swal.showLoading(); await api.post(`/api/invoices/${inv.id}/verify`, { action: 'reject' }); return { action: 'reject' }; } catch (err) { Swal.showValidationMessage(err.response?.data?.message || 'Gagal menolak pembayaran.'); return false; } },
    }).then((result) => {
      if (result.isConfirmed) { toast('success', `Invoice #${inv.invoice_number} berhasil disetujui (LUNAS)!`); fetchInvoices(); }
      else if (result.isDenied) { toast('info', `Pembayaran Invoice #${inv.invoice_number} ditolak.`); fetchInvoices(); }
    });
  };

  const handleDelete = async (inv) => {
    if (inv.status !== 'draft') { toast('error', 'Hanya invoice draft yang bisa dihapus'); return; }
    const confirmed = await confirmDelete(`Invoice #${inv.invoice_number}`);
    if (!confirmed) return;
    try { await api.delete(`/api/invoices/${inv.id}`); toast('success', 'Invoice berhasil dihapus'); fetchInvoices(); }
    catch (err) { toast('error', err.response?.data?.message || 'Gagal menghapus invoice'); }
  };

  const getPaymentChannel = (inv) => {
    if (inv.receipt_url || inv.status === 'pending_verification') return 'manual';
    if (inv.payment_url) return 'midtrans';
    return 'unspecified';
  };

  // Channel tab config
  const channelTabs = [
    { key: 'all',      label: t('invoices.channel_all'),      icon: '📋', count: channelCounts.all ?? totalAll, activeClass: 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20' },
    { key: 'midtrans', label: t('invoices.channel_midtrans'), icon: '⚡', count: channelCounts.midtrans || 0,   activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20' },
    { key: 'manual',   label: t('invoices.channel_manual'),   icon: '🏦', count: channelCounts.manual || 0,     activeClass: 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-16">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{t('invoices.title')}</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{t('invoices.desc')}</p>
        </div>
        <Link
          href="/dashboard/invoices/create"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold shadow-md shadow-indigo-500/20 transition-all"
          id="btn-create-invoice"
        >
          ➕ {t('invoices.btn_create')}
        </Link>
      </div>

      {/* Main Card */}
      <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-sm p-5 sm:p-6">

        {/* ── 1. Payment Channel Tabs ── */}
        <div className="flex flex-wrap gap-2.5 mb-5 pb-5 border-b border-slate-100">
          {channelTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setFilterChannel(tab.key); setPage(1); }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                filterChannel === tab.key ? tab.activeClass : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                filterChannel === tab.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* ── 2. Status Filter Pills ── */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => { setFilterStatus('all'); setPage(1); }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
              filterStatus === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t('common.all')} ({totalAll})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setFilterStatus(filterStatus === key ? 'all' : key); setPage(1); }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all ${
                filterStatus === key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold ${STATUS_TAILWIND[key]}`}>{cfg.label}</span>
              <span>{statusCounts[key] || 0}</span>
            </button>
          ))}
        </div>

        {/* ── 3. Search Toolbar ── */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">🔍</span>
            <input
              type="search"
              className={`${INPUT_CLS} pl-9 max-w-xs`}
              placeholder={t('invoices.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
            {t('common.total')}: <b className="ml-1 text-slate-900">{total}</b>&nbsp;invoice
          </span>
        </div>

        {/* ── 4. Table ── */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <span className="text-4xl">🧾</span>
            <p className="text-sm font-semibold text-slate-700">
              {search || filterStatus !== 'all' || filterChannel !== 'all' ? t('invoices.empty_desc') : t('dashboard.empty_invoices_title')}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[780px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3">{t('dashboard.table_invoice_num')}</th>
                    <th className="py-2.5 px-3">{t('dashboard.table_client')}</th>
                    <th className="py-2.5 px-3">{t('invoices.table_payment_method')}</th>
                    <th className="py-2.5 px-3">{t('invoices.form_issue_date')}</th>
                    <th className="py-2.5 px-3">{t('dashboard.table_due_date')}</th>
                    <th className="py-2.5 px-3 text-right">{t('dashboard.table_total')}</th>
                    <th className="py-2.5 px-3">{t('dashboard.table_status')}</th>
                    <th className="py-2.5 px-3 text-right">{t('dashboard.table_action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map((inv) => {
                    const color = STATUS_TAILWIND[inv.status] || STATUS_TAILWIND.draft;
                    const label = STATUS_CONFIG[inv.status]?.label || inv.status;
                    const channel = getPaymentChannel(inv);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-indigo-700">#{inv.invoice_number}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900">{inv.client?.name || '—'}</td>
                        <td className="py-3 px-3">
                          {channel === 'midtrans' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">⚡ {t('invoices.method_midtrans')}</span>
                          ) : channel === 'manual' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">🏦 {t('invoices.method_manual')}</span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 text-xs">{formatDate(inv.issue_date, lang)}</td>
                        <td className="py-3 px-3 text-slate-500 text-xs">{formatDate(inv.due_date, lang)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{formatRupiah(inv.total)}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${color}`}>{label}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {inv.status === 'pending_verification' && (
                              <button type="button" onClick={() => handleReviewPayment(inv)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition">🔍 Review</button>
                            )}
                            {inv.status === 'draft' && (
                              <button type="button" onClick={() => handleSubmitInvoice(inv)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 transition">🚀 Submit</button>
                            )}
                            {inv.status === 'draft' && (
                              <Link href={`/dashboard/invoices/${inv.id}/edit`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200 transition">✏️ {t('common.edit')}</Link>
                            )}
                            <Link href={`/dashboard/invoices/${inv.id}`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold border border-slate-200 transition">👁️ {t('common.view')}</Link>
                            {(inv.status === 'unpaid' || inv.status === 'overdue' || inv.status === 'pending_verification') && isPro && inv.payment_url && !inv.receipt_url && inv.status !== 'pending_verification' && (
                              <button type="button" onClick={() => handleRefreshMidtrans(inv)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200 transition">🔄 {t('invoices.btn_resubmit_midtrans')}</button>
                            )}
                            {(inv.status === 'unpaid' || inv.status === 'overdue' || inv.status === 'pending_verification') && (
                              <button type="button" onClick={() => handleCancelInvoice(inv)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold border border-rose-200 transition">🚫 {t('invoices.btn_cancel_invoice')}</button>
                            )}
                            {inv.status === 'cancelled' && isPro && (
                              <button type="button" onClick={() => handleRefreshMidtrans(inv)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold border border-emerald-200 transition">🔄 {t('invoices.btn_reactivate_midtrans')}</button>
                            )}
                            {inv.status === 'draft' && (
                              <button onClick={() => handleDelete(inv)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-bold border border-rose-200 transition" title="Hapus Draft">🗑️</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={10} onPageChange={setPage} lang={lang} />
          </>
        )}
      </div>
    </div>
  );
}
