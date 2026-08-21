'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { openFormModal, confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';

const ITEM_FIELDS = [
  { name: 'name',        label: 'Nama Item / Layanan', placeholder: 'Contoh: Jasa Desain Logo & Branding', required: true },
  { name: 'description', label: 'Deskripsi (Opsional)', placeholder: 'Deskripsi singkat layanan atau spesifikasi produk...', type: 'textarea', required: false },
  { name: 'price',       label: 'Harga Satuan',        placeholder: 'Contoh: 500.000', type: 'currency', required: true },
];

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function ItemsPage() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.get('/api/items');
      setItems(res.data);
    } catch {
      toast('error', 'Gagal memuat data item');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // --- Add ---
  const handleAdd = () => {
    openFormModal({
      title: '➕ Tambah Item / Layanan',
      fields: ITEM_FIELDS,
      onSubmit: async (values) => {
        try {
          await api.post('/api/items', values);
          toast('success', 'Item berhasil ditambahkan!');
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
      title: '✏️ Edit Item / Layanan',
      fields: ITEM_FIELDS,
      initialValues: { ...item, price: Number(item.price) },
      onSubmit: async (values) => {
        try {
          await api.put(`/api/items/${item.id}`, values);
          toast('success', 'Item berhasil diperbarui!');
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
      toast('success', 'Item berhasil dihapus');
      fetchItems();
    } catch (err) {
      toast('error', err.response?.data?.message || 'Gagal menghapus item');
    }
  };

  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      (i.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📦 Katalog Item & Layanan</h1>
          <p className="page-desc">Simpan master produk atau layanan untuk mempercepat pembuatan invoice.</p>
        </div>
        <button className="btn-primary" onClick={handleAdd} id="btn-add-item">
          + Tambah Item
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
              placeholder="Cari nama produk atau deskripsi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="glass-pill" style={{ color: 'var(--text-secondary)' }}>
            Total: <b>{filtered.length}</b> item
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
              <span className="table-empty-icon">📦</span>
              <p>{search ? 'Tidak ada item yang cocok dengan pencarian.' : 'Belum ada item. Tambahkan item pertama Anda!'}</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nama Item / Layanan</th>
                  <th>Deskripsi</th>
                  <th className="td-right">Harga Satuan</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="td-num">{idx + 1}</td>
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
                          title="Edit"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => handleDelete(item)}
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
