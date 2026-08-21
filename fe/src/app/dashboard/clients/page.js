'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { openFormModal, confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';

const CLIENT_FIELDS = [
  { name: 'name',    label: 'Nama Klien',  placeholder: 'PT. Maju Jaya', required: true },
  { name: 'email',   label: 'Email',       placeholder: 'klien@email.com', type: 'email', required: false },
  { name: 'phone',   label: 'No. Telepon', placeholder: '08123456789', required: false },
  { name: 'address', label: 'Alamat',      placeholder: 'Jl. Sudirman No. 1, Jakarta', type: 'textarea', required: false },
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
      title: '➕ Tambah Klien',
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
      title: '✏️ Edit Klien',
      fields: CLIENT_FIELDS,
      initialValues: client,
      onSubmit: async (values) => {
        try {
          await api.put(`/api/clients/${client.id}`, values);
          toast('success', 'Klien berhasil diperbarui!');
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
      (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Klien</h1>
          <p className="page-desc">Kelola daftar klien bisnis Anda.</p>
        </div>
        <button className="btn-primary btn-inline" onClick={handleAdd} id="btn-add-client">
          + Tambah Klien
        </button>
      </div>

      {/* Search & count */}
      <div className="table-toolbar">
        <input
          type="search"
          className="form-input search-input"
          placeholder="🔍  Cari nama atau email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="record-count">{filtered.length} klien</span>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div className="table-loading">
            <div className="loading-spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            <span className="table-empty-icon">👥</span>
            <p>{search ? 'Tidak ada klien yang cocok.' : 'Belum ada klien. Tambahkan klien pertama Anda!'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nama Klien</th>
                <th>Email</th>
                <th>No. Telepon</th>
                <th>Alamat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client, idx) => (
                <tr key={client.id}>
                  <td className="td-num">{idx + 1}</td>
                  <td className="td-name">{client.name}</td>
                  <td className="td-secondary">{client.email || <span className="td-empty">—</span>}</td>
                  <td className="td-secondary">{client.phone || <span className="td-empty">—</span>}</td>
                  <td className="td-secondary td-address">{client.address || <span className="td-empty">—</span>}</td>
                  <td className="td-actions">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
