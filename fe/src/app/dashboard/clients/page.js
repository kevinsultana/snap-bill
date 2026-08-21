'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { openFormModal, confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';

const CLIENT_FIELDS = [
  { name: 'name',    label: 'Nama Klien / Perusahaan',  placeholder: 'PT. Maju Jaya Bersama', required: true },
  { name: 'email',   label: 'Email Klien',       placeholder: 'klien@perusahaan.com', type: 'email', required: false },
  { name: 'phone',   label: 'No. WhatsApp / Telepon', placeholder: '08123456789', required: false },
  { name: 'address', label: 'Alamat Tagihan',      placeholder: 'Jl. Sudirman No. 1, Jakarta Selatan', type: 'textarea', required: false },
];

export default function ClientsPage() {
  const [clients, setClients]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

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
      title: '➕ Tambah Klien Baru',
      fields: CLIENT_FIELDS,
      onSubmit: async (values) => {
        try {
          await api.post('/api/clients', values);
          toast('success', 'Klien berhasil ditambahkan!');
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
      title: '✏️ Edit Data Klien',
      fields: CLIENT_FIELDS,
      initialValues: client,
      onSubmit: async (values) => {
        try {
          await api.put(`/api/clients/${client.id}`, values);
          toast('success', 'Data klien berhasil diperbarui!');
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
      toast('success', 'Klien berhasil dihapus');
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
          <h1 className="page-title">👥 Master Klien</h1>
          <p className="page-desc">Kelola kontak, email, dan alamat klien penagihan bisnis Anda.</p>
        </div>
        <button className="btn-primary" onClick={handleAdd} id="btn-add-client">
          + Tambah Klien
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
              placeholder="Cari nama, email, atau no. telepon..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="glass-pill" style={{ color: 'var(--text-secondary)' }}>
            Total: <b>{filtered.length}</b> klien
          </span>
        </div>

        {/* Table */}
        <div className="table-container">
          {loading ? (
            <div className="loading-screen" style={{ minHeight: '30vh' }}>
              <div className="loading-spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="table-empty">
              <span className="table-empty-icon">👥</span>
              <p>{search ? 'Tidak ada klien yang cocok dengan pencarian.' : 'Belum ada klien. Tambahkan klien pertama Anda!'}</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama Klien</th>
                  <th>Email</th>
                  <th>No. WhatsApp</th>
                  <th>Alamat</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client, idx) => (
                  <tr key={client.id}>
                    <td className="td-num">{idx + 1}</td>
                    <td className="td-name">{client.name}</td>
                    <td className="td-secondary">{client.email || '—'}</td>
                    <td className="td-secondary">{client.phone || '—'}</td>
                    <td className="td-secondary" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.address || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="td-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn-action btn-edit"
                          onClick={() => handleEdit(client)}
                          title="Edit"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => handleDelete(client)}
                          title="Hapus"
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
