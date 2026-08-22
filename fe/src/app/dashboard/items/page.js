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

export default function ItemsPage() {
  const { t, lang } = useTranslation();
  const [items, setItems]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal]         = useState(0);
  const [totalAll, setTotalAll]   = useState(0);

  const ITEM_FIELDS = [
    { name: 'name',        label: t('items.form_name'),  placeholder: 'Contoh: Jasa Desain Logo & Branding', required: true },
    { name: 'description', label: t('items.form_desc'),  placeholder: 'Deskripsi singkat layanan atau spesifikasi produk...', type: 'textarea', required: false },
    { name: 'price',       label: t('items.form_price'), placeholder: 'Contoh: 500.000', type: 'currency', required: true },
  ];

  // Debounce search input
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
        params: {
          page,
          limit: 10,
          search: debouncedSearch,
          paginate: 'true',
        },
      });
      if (res.data && Array.isArray(res.data.data)) {
        setItems(res.data.data);
        setTotal(res.data.total || 0);
        setTotalAll(res.data.totalAll || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setItems(res.data);
        setTotal(res.data.length);
        setTotalAll(res.data.length);
        setTotalPages(1);
      }
    } catch {
      toast('error', 'Gagal memuat data item');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // --- Add ---
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

  // --- Edit ---
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

  // --- Delete ---
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
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('items.title')}</h1>
          <p className="page-desc">{t('items.desc')}</p>
        </div>
        <button className="btn-primary" onClick={handleAdd} id="btn-add-item">
          {t('items.btn_add')}
        </button>
      </div>

      {/* Glass Card Container */}
      <div className="glass-card" style={{ padding: '20px 24px' }}>
        {/* Search & count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="search-bar-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="search"
              className="form-input search-input"
              placeholder={t('items.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="glass-pill" style={{ color: 'var(--text-secondary)' }}>
            {t('common.total')}: <b>{total}</b> item
          </span>
        </div>

        {/* Table */}
        <div className="table-container">
          {loading ? (
            <div className="loading-screen" style={{ minHeight: '30vh' }}>
              <div className="loading-spinner" />
            </div>
          ) : items.length === 0 ? (
            <div className="table-empty">
              <span className="table-empty-icon">📦</span>
              <p>{search ? t('invoices.empty_title') : t('items.empty_title')}</p>
            </div>
          ) : (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('items.table_name')}</th>
                    <th>{t('items.table_desc')}</th>
                    <th className="td-right">{t('items.table_price')}</th>
                    <th style={{ textAlign: 'right' }}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="td-num">{(page - 1) * 10 + idx + 1}</td>
                      <td className="td-name">{item.name}</td>
                      <td className="td-secondary" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description || '—'}
                      </td>
                      <td className="td-right td-price" style={{ color: 'var(--emerald-dark)' }}>
                        {formatRupiah(item.price)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="td-actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn-action btn-edit"
                            onClick={() => handleEdit(item)}
                            title={t('common.edit')}
                          >
                            ✏️ {t('common.edit')}
                          </button>
                          <button
                            className="btn-action btn-delete"
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
