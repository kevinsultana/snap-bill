'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';
import Swal from 'sweetalert2';
import { useTranslation } from '@/lib/i18n/useTranslation';

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

import Pagination from '@/components/Pagination';

function formatDate(dateStr, lang = 'id') {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function InvoicesPage() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all'); // 'all' | 'midtrans' | 'manual'
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [channelCounts, setChannelCounts] = useState({ all: 0, midtrans: 0, manual: 0 });

  const STATUS_CONFIG = {
    draft:                { label: t('invoices.status_draft'),                color: 'badge-gray'    },
    unpaid:               { label: t('invoices.status_unpaid'),               color: 'badge-amber'   },
    pending_verification: { label: t('invoices.status_pending_verification'), color: 'badge-blue'   },
    paid:                 { label: t('invoices.status_paid'),                 color: 'badge-emerald' },
    overdue:              { label: t('invoices.status_overdue'),              color: 'badge-red'     },
    cancelled:            { label: t('invoices.status_cancelled'),            color: 'badge-gray'    },
  };

  const [userSettings, setUserSettings] = useState(null);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/invoices', {
        params: {
          page,
          limit: 10,
          search: debouncedSearch,
          status: filterStatus,
          channel: filterChannel,
          paginate: 'true',
        },
      });
      if (res.data && Array.isArray(res.data.data)) {
        setInvoices(res.data.data);
        setTotal(res.data.total || 0);
        setTotalAll(res.data.totalAll || 0);
        setTotalPages(res.data.totalPages || 1);
        if (res.data.counts) setStatusCounts(res.data.counts);
        if (res.data.channelCounts) setChannelCounts(res.data.channelCounts);
      } else if (Array.isArray(res.data)) {
        setInvoices(res.data);
        setTotal(res.data.length);
        setTotalAll(res.data.length);
        setTotalPages(1);
      }
    } catch {
      toast('error', 'Gagal memuat data invoice');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterStatus, filterChannel]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useEffect(() => {
    api.get('/api/settings').then((r) => setUserSettings(r.data)).catch(() => {});
  }, []);

  const isPro = userSettings?.tier === 'pro' && (!userSettings?.subscription_ends_at || new Date(userSettings.subscription_ends_at) > new Date());

  // ─── Submit Invoice ────────────────────────────────────────────────────────
  const handleSubmitInvoice = async (inv) => {
    const result = await Swal.fire({
      title: 'Terbitkan Invoice ini?',
      html: `
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
          Invoice <b style="color: #0f172a;">#${inv.invoice_number}</b> akan diterbitkan ke klien <b style="color: #0f172a;">${inv.client?.name || ''}</b>.
        </p>
        <p style="color: #64748b; font-size: 12px; margin: 0;">
          Status akan diubah menjadi <b>Belum Dibayar</b>, PDF dibuat, dan email tagihan dikirim ke klien.
        </p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🚀 Ya, Terbitkan',
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          const res = await api.post(`/api/invoices/${inv.id}/submit`);
          return res.data;
        } catch (err) {
          Swal.showValidationMessage(
            err.response?.data?.message || 'Terjadi kesalahan saat menerbitkan invoice.'
          );
          return false;
        }
      },
    });

    if (result.isConfirmed && result.value) {
      await Swal.fire({
        icon: 'success',
        title: '🎉 Invoice Berhasil Diterbitkan!',
        html: `
          <p style="color: #475569; font-size: 13px; margin: 0 0 8px;">Link pembayaran publik untuk klien telah aktif:</p>
          <div style="margin-top: 6px; padding: 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; word-break: break-all; font-family: monospace; font-size: 12px; color: #4f46e5; user-select: all;">
            ${result.value.public_link}
          </div>
        `,
        confirmButtonText: 'Selesai',
        confirmButtonColor: '#6366f1',
        customClass: { popup: 'swal-custom-popup' },
      });
      fetchInvoices();
    }
  };

  // ─── Batalkan Invoice (Cancel) ─────────────────────────────────────────────
  const handleCancelInvoice = async (inv) => {
    const result = await Swal.fire({
      title: 'Batalkan Invoice ini?',
      html: `
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
          Invoice <b style="color: #0f172a;">#${inv.invoice_number}</b> akan ditandai sebagai <b>Dibatalkan</b> dan sesi pembayaran Midtrans akan dinonaktifkan.
        </p>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '🚫 Ya, Batalkan',
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#f43f5e',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          const res = await api.post(`/api/invoices/${inv.id}/cancel`);
          return res.data;
        } catch (err) {
          Swal.showValidationMessage(err.response?.data?.message || 'Gagal membatalkan invoice.');
          return false;
        }
      },
    });

    if (result.isConfirmed) {
      toast('success', `Invoice #${inv.invoice_number} berhasil dibatalkan.`);
      fetchInvoices();
    }
  };

  // ─── Refresh / Re-Create Midtrans Session (Ajukan Ulang) ───────────────────
  const handleRefreshMidtrans = async (inv) => {
    const result = await Swal.fire({
      title: 'Ajukan Ulang Sesi Midtrans?',
      html: `
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 10px;">
          Sistem akan membuatkan token dan link pembayaran Midtrans yang baru untuk invoice <b style="color: #0f172a;">#${inv.invoice_number}</b>.
        </p>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '🔄 Ya, Ajukan Ulang',
      cancelButtonText: t('common.cancel'),
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#94a3b8',
      customClass: { popup: 'swal-custom-popup' },
      showLoaderOnConfirm: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          const res = await api.post(`/api/invoices/${inv.id}/refresh-midtrans`);
          return res.data;
        } catch (err) {
          Swal.showValidationMessage(err.response?.data?.message || 'Gagal membuat sesi pembayaran baru.');
          return false;
        }
      },
    });

    if (result.isConfirmed && result.value) {
      toast('success', `Sesi Midtrans untuk #${inv.invoice_number} berhasil diperbarui!`);
      fetchInvoices();
    }
  };

  // ─── Review Pembayaran (Approve / Reject) Modal ────────────────────────────
  const handleReviewPayment = (inv) => {
    const isPdf = inv.receipt_url && inv.receipt_url.toLowerCase().endsWith('.pdf');

    const receiptContent = inv.receipt_url
      ? isPdf
        ? `
          <div style="margin: 16px 0; padding: 20px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; text-align: center;">
            <div style="font-size: 36px; margin-bottom: 8px;">📄</div>
            <p style="color: #0f172a; font-weight: 700; font-size: 14px; margin: 0 0 8px;">${t('invoices.receipt_pdf_doc')}</p>
            <a href="${inv.receipt_url}" target="_blank" rel="noopener noreferrer" style="color: #4f46e5; font-weight: 700; text-decoration: underline; font-size: 13px;">
              👁️ ${t('invoices.receipt_click_pdf')}
            </a>
          </div>
        `
        : `
          <div style="margin: 16px 0; text-align: center;">
            <div style="max-height: 320px; overflow-y: auto; background: #f8fafc; padding: 10px; border-radius: 14px; border: 1px solid #e2e8f0;">
              <img
                src="${inv.receipt_url}"
                alt="Bukti Pembayaran"
                style="max-width: 100%; max-height: 280px; border-radius: 8px; object-fit: contain; margin: 0 auto; display: block;"
              />
            </div>
            <a href="${inv.receipt_url}" target="_blank" rel="noopener noreferrer" style="display: inline-block; margin-top: 8px; color: #4f46e5; font-weight: 600; font-size: 12px;">
              🔍 ${t('invoices.receipt_open_full')}
            </a>
          </div>
        `
      : `
        <div style="margin: 20px 0; padding: 20px; background: #f8fafc; border-radius: 14px; border: 1px solid #e2e8f0; text-align: center; color: #64748b;">
          <p style="margin: 0;">${t('invoices.receipt_not_uploaded')}</p>
        </div>
      `;

    Swal.fire({
      title: t('invoices.verify_modal_title'),
      html: `
        <div style="text-align: left; font-size: 14px;">
          <p style="margin-bottom: 6px;"><b>No. Invoice:</b> #${inv.invoice_number}</p>
          <p style="margin-bottom: 6px;"><b>Klien:</b> ${inv.client?.name || '—'}</p>
          <p style="margin-bottom: 12px;"><b>Total Tagihan:</b> <span style="font-weight: 800; color: #059669;">${formatRupiah(inv.total)}</span></p>
          <p style="margin: 10px 0 4px; font-weight: 600; color: #475569;">${t('invoices.receipt_image')}</p>
          ${receiptContent}
        </div>
      `,
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: t('invoices.verify_approve'),
      denyButtonText: t('invoices.verify_reject'),
      cancelButtonText: t('common.close'),
      confirmButtonColor: '#10b981',
      denyButtonColor: '#f43f5e',
      cancelButtonColor: '#94a3b8',
      customClass: {
        popup: 'swal-custom-popup swal-review-popup',
      },
      showLoaderOnConfirm: true,
      showLoaderOnDeny: true,
      allowOutsideClick: () => !Swal.isLoading(),
      preConfirm: async () => {
        try {
          Swal.showLoading();
          await api.post(`/api/invoices/${inv.id}/verify`, { action: 'approve' });
          return { action: 'approve' };
        } catch (err) {
          Swal.showValidationMessage(err.response?.data?.message || 'Gagal menyetujui pembayaran.');
          return false;
        }
      },
      preDeny: async () => {
        try {
          Swal.showLoading();
          await api.post(`/api/invoices/${inv.id}/verify`, { action: 'reject' });
          return { action: 'reject' };
        } catch (err) {
          Swal.showValidationMessage(err.response?.data?.message || 'Gagal menolak pembayaran.');
          return false;
        }
      },
    }).then((result) => {
      if (result.isConfirmed) {
        toast('success', `Invoice #${inv.invoice_number} berhasil disetujui (LUNAS)!`);
        fetchInvoices();
      } else if (result.isDenied) {
        toast('info', `Pembayaran Invoice #${inv.invoice_number} ditolak. Status kembali Belum Dibayar.`);
        fetchInvoices();
      }
    });
  };

  // ─── Delete Invoice ────────────────────────────────────────────────────────
  const handleDelete = async (inv) => {
    if (inv.status !== 'draft') {
      toast('error', 'Hanya invoice draft yang bisa dihapus');
      return;
    }
    const confirmed = await confirmDelete(`Invoice #${inv.invoice_number}`);
    if (!confirmed) return;
    try {
      await api.delete(`/api/invoices/${inv.id}`);
      toast('success', 'Invoice berhasil dihapus');
      fetchInvoices();
    } catch (err) {
      toast('error', err.response?.data?.message || 'Gagal menghapus invoice');
    }
  };

  // Helper penentu metode / saluran pembayaran
  const getPaymentChannel = (inv) => {
    if (inv.receipt_url || inv.status === 'pending_verification') return 'manual';
    if (inv.payment_url) return 'midtrans';
    return 'unspecified';
  };

  const handleChannelSelect = (ch) => {
    setFilterChannel(ch);
    setPage(1);
  };

  const handleStatusSelect = (st) => {
    setFilterStatus(st);
    setPage(1);
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('invoices.title')}</h1>
          <p className="page-desc">{t('invoices.desc')}</p>
        </div>
        <Link href="/dashboard/invoices/create" className="btn-primary" id="btn-create-invoice">
          {t('invoices.btn_create')}
        </Link>
      </div>

      {/* Glass Card Container */}
      <div className="glass-card" style={{ padding: '24px' }}>

        {/* ── 1. Payment Channel Segmented Tabs (Pemisah Midtrans vs Manual) ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18, borderBottom: '1px solid rgba(226, 232, 240, 0.8)', paddingBottom: 16 }}>
          <button
            type="button"
            style={{
              padding: '8px 18px',
              fontSize: 13,
              borderRadius: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid',
              background: filterChannel === 'all' ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'rgba(255, 255, 255, 0.85)',
              color: filterChannel === 'all' ? '#ffffff' : 'var(--text-secondary)',
              borderColor: filterChannel === 'all' ? '#6366f1' : '#cbd5e1',
              boxShadow: filterChannel === 'all' ? '0 4px 14px rgba(99, 102, 241, 0.25)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => handleChannelSelect('all')}
          >
            <span>📋</span>
            <span>{t('invoices.channel_all')}</span>
            <span style={{ background: filterChannel === 'all' ? 'rgba(255, 255, 255, 0.25)' : '#f1f5f9', color: filterChannel === 'all' ? '#ffffff' : '#64748b', padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 800 }}>
              {channelCounts.all ?? totalAll}
            </span>
          </button>

          <button
            type="button"
            style={{
              padding: '8px 18px',
              fontSize: 13,
              borderRadius: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid',
              background: filterChannel === 'midtrans' ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(255, 255, 255, 0.85)',
              color: filterChannel === 'midtrans' ? '#ffffff' : 'var(--text-secondary)',
              borderColor: filterChannel === 'midtrans' ? '#10b981' : '#cbd5e1',
              boxShadow: filterChannel === 'midtrans' ? '0 4px 14px rgba(16, 185, 129, 0.25)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => handleChannelSelect('midtrans')}
          >
            <span>⚡</span>
            <span>{t('invoices.channel_midtrans')}</span>
            <span style={{ background: filterChannel === 'midtrans' ? 'rgba(255, 255, 255, 0.25)' : '#f1f5f9', color: filterChannel === 'midtrans' ? '#ffffff' : '#059669', padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 800 }}>
              {channelCounts.midtrans || 0}
            </span>
          </button>

          <button
            type="button"
            style={{
              padding: '8px 18px',
              fontSize: 13,
              borderRadius: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              border: '1px solid',
              background: filterChannel === 'manual' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'rgba(255, 255, 255, 0.85)',
              color: filterChannel === 'manual' ? '#ffffff' : 'var(--text-secondary)',
              borderColor: filterChannel === 'manual' ? '#3b82f6' : '#cbd5e1',
              boxShadow: filterChannel === 'manual' ? '0 4px 14px rgba(59, 130, 246, 0.25)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => handleChannelSelect('manual')}
          >
            <span>🏦</span>
            <span>{t('invoices.channel_manual')}</span>
            <span style={{ background: filterChannel === 'manual' ? 'rgba(255, 255, 255, 0.25)' : '#f1f5f9', color: filterChannel === 'manual' ? '#ffffff' : '#2563eb', padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 800 }}>
              {channelCounts.manual || 0}
            </span>
          </button>
        </div>

        {/* ── 2. Status Filter Pills ────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          <button
            className={`btn-toggle-type ${filterStatus === 'all' ? 'active' : ''}`}
            style={{ padding: '6px 14px', fontSize: 12, borderRadius: 9999 }}
            onClick={() => handleStatusSelect('all')}
          >
            {t('common.all')} ({totalAll})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              className={`btn-toggle-type ${filterStatus === key ? 'active' : ''}`}
              style={{ padding: '6px 14px', fontSize: 12, borderRadius: 9999 }}
              onClick={() => handleStatusSelect(filterStatus === key ? 'all' : key)}
            >
              <span className={`status-badge ${cfg.color}`} style={{ padding: '2px 8px', fontSize: 11 }}>
                {cfg.label}
              </span>
              <span style={{ marginLeft: 6, fontWeight: 700 }}>{statusCounts[key] || 0}</span>
            </button>
          ))}
        </div>

        {/* Search Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="search-bar-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="search"
              className="form-input search-input"
              placeholder={t('invoices.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="glass-pill" style={{ color: 'var(--text-secondary)' }}>
            {t('common.total')}: <b>{total}</b> invoice
          </span>
        </div>

        {/* Table */}
        <div className="table-container">
          {loading ? (
            <div className="loading-screen" style={{ minHeight: '30vh' }}>
              <div className="loading-spinner" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="table-empty">
              <span className="table-empty-icon">🧾</span>
              <p>{search || filterStatus !== 'all' || filterChannel !== 'all' ? t('invoices.empty_desc') : t('dashboard.empty_invoices_title')}</p>
            </div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('dashboard.table_invoice_num')}</th>
                    <th>{t('dashboard.table_client')}</th>
                    <th>{t('invoices.table_payment_method')}</th>
                    <th>{t('invoices.form_issue_date')}</th>
                    <th>{t('dashboard.table_due_date')}</th>
                    <th className="td-right">{t('dashboard.table_total')}</th>
                    <th>{t('dashboard.table_status')}</th>
                    <th style={{ textAlign: 'right' }}>{t('dashboard.table_action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                    const channel = getPaymentChannel(inv);
                    return (
                      <tr key={inv.id}>
                        <td className="td-invoice-num">#{inv.invoice_number}</td>
                        <td className="td-name">{inv.client?.name || '—'}</td>
                        <td>
                          {channel === 'midtrans' ? (
                            <span
                              className="status-badge"
                              style={{
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#059669',
                                border: '1px solid rgba(16, 185, 129, 0.25)',
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '3px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <span>⚡</span> {t('invoices.method_midtrans')}
                            </span>
                          ) : channel === 'manual' ? (
                            <span
                              className="status-badge"
                              style={{
                                background: 'rgba(59, 130, 246, 0.12)',
                                color: '#2563eb',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '3px 8px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <span>🏦</span> {t('invoices.method_manual')}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                          )}
                        </td>
                        <td className="td-secondary">{formatDate(inv.issue_date, lang)}</td>
                        <td className="td-secondary">{formatDate(inv.due_date, lang)}</td>
                        <td className="td-right td-price" style={{ color: 'var(--text-main)' }}>
                          {formatRupiah(inv.total)}
                        </td>
                        <td>
                          <span className={`status-badge ${cfg.color}`}>{cfg.label}</span>
                        </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="td-actions" style={{ justifyContent: 'flex-end' }}>
                          {inv.status === 'pending_verification' && (
                            <button
                              type="button"
                              className="btn-action btn-review"
                              onClick={() => handleReviewPayment(inv)}
                              title="Review Bukti Pembayaran Klien"
                            >
                              🔍 Review
                            </button>
                          )}

                          {inv.status === 'draft' && (
                            <button
                              type="button"
                              className="btn-action btn-submit"
                              onClick={() => handleSubmitInvoice(inv)}
                              title="Terbitkan ke Klien"
                            >
                              🚀 Submit
                            </button>
                          )}

                          {inv.status === 'draft' && (
                            <Link
                              href={`/dashboard/invoices/${inv.id}/edit`}
                              className="btn-action btn-edit"
                            >
                              ✏️ {t('common.edit')}
                            </Link>
                          )}

                          <Link
                            href={`/dashboard/invoices/${inv.id}`}
                            className="btn-action btn-view"
                          >
                            👁️ {t('common.view')}
                          </Link>

                          {(inv.status === 'unpaid' || inv.status === 'overdue' || inv.status === 'pending_verification') && (
                            <>
                              {isPro && (
                                <button
                                  type="button"
                                  className="btn-action"
                                  style={{ color: 'var(--indigo)', borderColor: 'rgba(99, 102, 241, 0.3)' }}
                                  onClick={() => handleRefreshMidtrans(inv)}
                                  title="Buat Ulang Sesi Midtrans / Ajukan Ulang"
                                >
                                  🔄 {t('invoices.btn_resubmit_midtrans')}
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-action"
                                style={{ color: 'var(--rose)', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                                onClick={() => handleCancelInvoice(inv)}
                                title="Batalkan Invoice"
                              >
                                🚫 {t('invoices.btn_cancel_invoice')}
                              </button>
                            </>
                          )}

                          {inv.status === 'cancelled' && isPro && (
                            <button
                              type="button"
                              className="btn-action"
                              style={{ color: 'var(--emerald)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                              onClick={() => handleRefreshMidtrans(inv)}
                              title="Aktifkan Kembali & Buat Ulang Sesi Midtrans"
                            >
                              🔄 {t('invoices.btn_reactivate_midtrans')}
                            </button>
                          )}

                          {inv.status === 'draft' && (
                            <button
                              className="btn-action btn-delete"
                              onClick={() => handleDelete(inv)}
                              title="Hapus Draft"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination Component */}
              <Pagination
                page={page}
                totalPages={totalPages}
                total={total}
                limit={10}
                onPageChange={setPage}
                lang={lang}
              />
            </>
          )}
        </div>

      </div>
    </div>
  );
}
