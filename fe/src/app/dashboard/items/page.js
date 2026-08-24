'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { openFormModal, confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import Pagination from '@/components/Pagination';

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

const INPUT_CLS =
  'w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm font-semibold placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 transition-all duration-150';

export default function ItemsPage() {
  const { t, lang } = useTranslation();
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]         = useState(0);

  const ITEM_FIELDS = [
    { name: 'name',        label: t('items.form_name'),  placeholder: 'Contoh: Jasa Desain Logo & Branding', required: true },
    { name: 'description', label: t('items.form_desc'),  placeholder: 'Deskripsi singkat layanan atau spesifikasi produk...', type: 'textarea', required: false },
    { name: 'price',       label: t('items.form_price'), placeholder: 'Contoh: 500.000', type: 'currency', required: true },
  ];

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/items', {
        params: { page, limit: 10, search: debouncedSearch, paginate: 'true' },
      });
      if (res.data && Array.isArray(res.data.data)) {
        setItems(res.data.data);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setItems(res.data);
        setTotal(res.data.length);
        setTotalPages(1);
      }
    } catch {
      toast('error', 'Gagal memuat data item');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleAdd = () => {
    openFormModal({
      title: t('items.modal_add_title'),
      fields: ITEM_FIELDS,
      onSubmit: async (values) => {
        try {
          await api.post('/api/items', values);
          toast('success', t('items.toast_created'));
          fetchItems();
        } catch (err) {
          toast('error', err.response?.data?.message || 'Gagal menambahkan item');
        }
      },
    });
  };

  const handleEdit = (item) => {
    openFormModal({
      title: t('items.modal_edit_title'),
      fields: ITEM_FIELDS,
      initialValues: { ...item, price: Number(item.price) },
      onSubmit: async (values) => {
        try {
          await api.put(`/api/items/${item.id}`, values);
          toast('success', t('items.toast_updated'));
          fetchItems();
        } catch (err) {
          toast('error', err.response?.data?.message || 'Gagal memperbarui item');
        }
      },
    });
  };

  const handleDelete = async (item) => {
    const confirmed = await confirmDelete(item.name);
    if (!confirmed) return;
    try {
      await api.delete(`/api/items/${item.id}`);
      toast('success', t('items.toast_deleted'));
      fetchItems();
    } catch (err) {
      toast('error', err.response?.data?.message || 'Gagal menghapus item');
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-16">

      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{t('items.title')}</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{t('items.desc')}</p>
        </div>
        <button
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-bold shadow-md shadow-indigo-500/20 transition-all"
          onClick={handleAdd}
          id="btn-add-item"
        >
          ➕ {t('items.btn_add')}
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
              placeholder={t('items.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600">
            {t('common.total')}: <b className="ml-1 text-slate-900">{total}</b>&nbsp;item
          </span>
        </div>

        {/* Table Area */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <span className="text-4xl">📦</span>
            <p className="text-sm font-semibold text-slate-700">
              {search ? t('invoices.empty_title') : t('items.empty_title')}
            </p>
          </div>
        ) : (
          <>
            {/* Horizontally scrollable table */}
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[520px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-2.5 px-3 w-10">#</th>
                    <th className="py-2.5 px-3">{t('items.table_name')}</th>
                    <th className="py-2.5 px-3">{t('items.table_desc')}</th>
                    <th className="py-2.5 px-3 text-right">{t('items.table_price')}</th>
                    <th className="py-2.5 px-3 text-right w-[140px]">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 text-slate-400 font-mono text-xs">{(page - 1) * 10 + idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{item.name}</td>
                      <td className="py-3 px-3 text-slate-500 text-xs max-w-[280px] truncate">
                        {item.description || '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                        {formatRupiah(item.price)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 text-[11px] font-bold border border-slate-200 hover:border-indigo-200 transition"
                            onClick={() => handleEdit(item)}
                            title={t('common.edit')}
                          >
                            ✏️ {t('common.edit')}
                          </button>
                          <button
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-500 text-[11px] font-bold border border-slate-200 hover:border-rose-200 transition"
                            onClick={() => handleDelete(item)}
                            title={t('common.delete')}
                          >
                            🗑️ {t('common.delete')}
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
