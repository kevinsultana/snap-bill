'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { openFormModal, confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import Pagination from '@/components/Pagination';

const INPUT_CLS =
  'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-150';

export default function ClientsPage() {
  const { t, lang } = useTranslation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const CLIENT_FIELDS = [
    { name: 'name',    label: t('clients.form_name'),    placeholder: 'PT. Maju Jaya Bersama', required: true },
    { name: 'email',   label: t('clients.form_email'),   placeholder: 'klien@perusahaan.com', type: 'email', required: false },
    { name: 'phone',   label: t('clients.form_phone'),   placeholder: '08123456789', required: false },
    { name: 'address', label: t('clients.form_address'), placeholder: 'Jl. Sudirman No. 1, Jakarta Selatan', type: 'textarea', required: false },
  ];

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/clients', {
        params: { page, limit: 10, search: debouncedSearch, paginate: 'true' },
      });
      if (res.data && Array.isArray(res.data.data)) {
        setClients(res.data.data);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setClients(res.data);
        setTotal(res.data.length);
        setTotalPages(1);
      }
    } catch {
      toast('error', 'Gagal memuat data klien');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const handleAdd = () => {
    openFormModal({
      title: t('clients.modal_add_title'),
      fields: CLIENT_FIELDS,
      onSubmit: async (values) => {
        try {
          await api.post('/api/clients', values);
          toast('success', t('clients.toast_created'));
          fetchClients();
        } catch (err) {
          toast('error', err.response?.data?.message || 'Gagal menambahkan klien');
        }
      },
    });
  };

  const handleEdit = (client) => {
    openFormModal({
      title: t('clients.modal_edit_title'),
      fields: CLIENT_FIELDS,
      initialValues: client,
      onSubmit: async (values) => {
        try {
          await api.put(`/api/clients/${client.id}`, values);
          toast('success', t('clients.toast_updated'));
          fetchClients();
        } catch (err) {
          toast('error', err.response?.data?.message || 'Gagal memperbarui klien');
        }
      },
    });
  };

  const handleDelete = async (client) => {
    const confirmed = await confirmDelete(client.name);
    if (!confirmed) return;
    try {
      await api.delete(`/api/clients/${client.id}`);
      toast('success', t('clients.toast_deleted'));
      fetchClients();
    } catch (err) {
      toast('error', err.response?.data?.message || 'Gagal menghapus klien');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-16">

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{t('clients.title')}</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{t('clients.desc')}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold shadow-md shadow-indigo-500/20 transition-all"
          onClick={handleAdd}
          id="btn-add-client"
        >
          ➕ {t('clients.btn_add')}
        </button>
      </div>

      {/* Card Container */}
      <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-sm p-5 sm:p-6">

        {/* Search & Count */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-5">
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">🔍</span>
            <input
              type="search"
              className={`${INPUT_CLS} pl-9 max-w-xs`}
              placeholder={t('clients.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
            {t('common.total')}: <b className="ml-1 text-slate-900">{total}</b>&nbsp;{t('nav.clients').toLowerCase()}
          </span>
        </div>

        {/* Table Area */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <span className="text-4xl">👥</span>
            <p className="text-sm font-semibold text-slate-700">
              {search ? t('invoices.empty_title') : t('clients.empty_title')}
            </p>
            {!search && (
              <button
                className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition"
                onClick={handleAdd}
              >
                {t('clients.btn_add')}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Horizontally scrollable table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[560px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-4">{t('clients.table_name')}</th>
                    <th className="py-2.5 px-3">{t('clients.table_email')}</th>
                    <th className="py-2.5 px-3">{t('clients.table_phone')}</th>
                    <th className="py-2.5 px-3">{t('clients.table_address')}</th>
                    <th className="py-2.5 px-3 text-right w-[130px]">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name with Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-200/40 shrink-0">
                            {client.name?.[0]?.toUpperCase() || 'C'}
                          </div>
                          <span className="font-bold text-slate-900 truncate max-w-[160px]">{client.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-xs">{client.email || '—'}</td>
                      <td className="py-3 px-3 text-slate-500 text-xs">{client.phone || '—'}</td>
                      <td className="py-3 px-3 text-slate-500 text-xs max-w-[200px] truncate">
                        {client.address || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-[11px] font-bold border border-slate-200 hover:border-indigo-200 transition"
                            onClick={() => handleEdit(client)}
                            title={t('common.edit')}
                          >
                            ✏️ {t('common.edit')}
                          </button>
                          <button
                            className="inline-flex items-center px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-500 text-[11px] font-bold border border-slate-200 hover:border-rose-200 transition"
                            onClick={() => handleDelete(client)}
                            title={t('common.delete')}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
  );
}
