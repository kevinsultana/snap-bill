'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { openFormModal, confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';
import { useTranslation } from '@/lib/i18n/useTranslation';

export default function ClientsPage() {
  const { t, lang } = useTranslation();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const CLIENT_FIELDS = [
    { name: 'name',    label: t('clients.form_name'),    placeholder: 'PT. Maju Jaya Bersama', required: true },
    { name: 'email',   label: t('clients.form_email'),   placeholder: 'klien@perusahaan.com', type: 'email', required: false },
    { name: 'phone',   label: t('clients.form_phone'),   placeholder: '08123456789', required: false },
    { name: 'address', label: t('clients.form_address'), placeholder: 'Jl. Sudirman No. 1, Jakarta Selatan', type: 'textarea', required: false },
  ];

  const fetchClients = useCallback(async () => {
    try {
      const res = await api.get('/api/clients');
      setClients(res.data);
    } catch {
      toast('error', 'Gagal memuat data klien');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

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

  const filtered = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').toLowerCase().includes(search.toLowerCase())
  );

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
      <div className="glass-card" style={{ padding: '20px 24px' }}>
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
            {t('common.total')}: <b>{filtered.length}</b> {t('nav.clients').toLowerCase()}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="table-loading">
            <div className="loading-spinner" />
          </div>
        ) : filtered.length === 0 ? (
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
                {filtered.map((client) => (
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
        )}
      </div>
    </div>
  );
}
