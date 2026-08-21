'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { openFormModal, confirmDelete } from '@/lib/modals';
import { toast } from '@/lib/toast';

const ITEM_FIELDS = [
  { name: 'name',        label: 'Nama Item',   placeholder: 'Jasa Desain Logo', required: true },
  { name: 'description', label: 'Deskripsi',   placeholder: 'Deskripsi singkat item...', type: 'textarea', required: false },
  { name: 'price',       label: 'Harga (Rp)',  placeholder: '500000', type: 'number', required: true, step: '0.01' },
];

// Format angka ke Rupiah
function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(Number(value));
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
      title: '➕ Tambah Item',
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
      title: '✏️ Edit Item',
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
          <h1 className="page-title">Item / Layanan</h1>
          <p className="page-desc">Kelola daftar produk dan layanan yang bisa dimasukkan ke invoice.</p>
        </div>
        <button className="btn-primary btn-inline" onClick={handleAdd} id="btn-add-item">
          + Tambah Item
        </button>
      </div>

      {/* Search & count */}
      <div className="table-toolbar">
        <input
          type="search"
          className="form-input search-input"
          placeholder="🔍  Cari nama atau deskripsi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="record-count">{filtered.length} item</span>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <div className="table-loading">
            <div className="loading-spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="table-empty">
            <span className="table-empty-icon">📦</span>
            <p>{search ? 'Tidak ada item yang cocok.' : 'Belum ada item. Tambahkan item atau layanan pertama Anda!'}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nama Item</th>
                <th>Deskripsi</th>
                <th className="td-right">Harga</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr key={item.id}>
                  <td className="td-num">{idx + 1}</td>
                  <td className="td-name">{item.name}</td>
                  <td className="td-secondary td-desc">
                    {item.description || <span className="td-empty">—</span>}
                  </td>
                  <td className="td-price">{formatRupiah(item.price)}</td>
                  <td className="td-actions">
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
