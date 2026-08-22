'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { openFormModal, confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import Pagination from '@/components/Pagination';

export default function ClientsPage() {
  const { t, lang } = useTranslation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);

  const CLIENT_FIELDS = [
    { name: 'name',    label: t('clients.form_name'),    placeholder: 'PT. Maju Jaya Bersama', required: true },
    { name: 'email',   label: t('clients.form_email'),   placeholder: 'klien@perusahaan.com', type: 'email', required: false },
    { name: 'phone',   label: t('clients.form_phone'),   placeholder: '08123456789', required: false },
    { name: 'address', label: t('clients.form_address'), placeholder: 'Jl. Sudirman No. 1, Jakarta Selatan', type: 'textarea', required: false },
  ];

  // Debounce search input
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
        params: {
          page,
          limit: 10,
          search: debouncedSearch,
          paginate: 'true',
        },
      });
      if (res.data && Array.isArray(res.data.data)) {
        setClients(res.data.data);
        setTotal(res.data.total || 0);
        setTotalAll(res.data.totalAll || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setClients(res.data);
        setTotal(res.data.length);
        setTotalAll(res.data.length);
        setTotalPages(1);
      }
    } catch {
      toast('error', 'Gagal memuat data klien');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // --- Add ---
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

  // --- Edit ---
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

  // --- Delete ---
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
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('clients.title')}</h1>
          <p className="page-desc">{t('clients.desc')}</p>
        </div>
        <button className="btn-primary" onClick={handleAdd} id="btn-add-client">
          {t('clients.btn_add')}
        </button>
      </div>

      {/* Glass Card Container */}
      <div className="glass-card">
        {/* Search & count */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div className="search-bar-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="search"
              className="form-input search-input"
              placeholder={t('clients.search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="glass-pill" style={{ color: 'var(--text-secondary)' }}>
            {t('common.total')}: <b>{total}</b> {t('nav.clients').toLowerCase()}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="table-loading">
            <div className="loading-spinner" />
          </div>
        ) : clients.length === 0 ? (
          <div className="table-empty">
            <span className="table-empty-icon">👥</span>
            <p>{search ? t('invoices.empty_title') : t('clients.empty_title')}</p>
            {!search && (
              <button className="btn-primary" onClick={handleAdd} style={{ marginTop: 14 }}>
                {t('clients.btn_add')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('clients.table_name')}</th>
                    <th>{t('clients.table_email')}</th>
                    <th>{t('clients.table_phone')}</th>
                    <th>{t('clients.table_address')}</th>
                    <th style={{ width: 130 }}>{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => (
                    <tr key={client.id}>
                      <td className="td-name">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, var(--indigo-subtle), var(--purple-subtle))',
                              color: 'var(--indigo-dark)',
                              fontWeight: 700,
                              fontSize: 13,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid rgba(99, 102, 241, 0.2)',
                              flexShrink: 0,
                            }}
                          >
                            {client.name?.[0]?.toUpperCase() || 'C'}
                          </div>
                          <span style={{ fontWeight: 700 }}>{client.name}</span>
                        </div>
                      </td>
                      <td className="td-secondary">{client.email || '—'}</td>
                      <td className="td-secondary">{client.phone || '—'}</td>
                      <td className="td-secondary" style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {client.address || '—'}
                      </td>
                      <td>
                        <div className="td-actions">
                          <button
                            className="btn-action btn-edit"
                            onClick={() => handleEdit(client)}
                            title={t('common.edit')}
                          >
                            ✏️ {t('common.edit')}
                          </button>
                          <button
                            className="btn-action btn-delete"
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
  );
}
