'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import InvoiceForm from '../../_components/InvoiceForm';

export default function EditInvoicePage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    api.get(`/api/invoices/${id}`)
      .then((res) => {
        if (res.data.status !== 'draft') {
          setError('Hanya invoice berstatus draft yang dapat diedit.');
        } else {
          setInvoice(res.data);
        }
      })
      .catch(() => setError('Invoice tidak ditemukan.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="loading-screen"><div className="loading-spinner" /></div>
  );

  if (error) return (
    <div className="page-container">
      <div className="error-card">
        <span className="error-icon">⚠️</span>
        <p>{error}</p>
        <a href="/dashboard/invoices" className="btn-secondary" style={{ display: 'inline-block', marginTop: 16 }}>
          ← Kembali ke daftar invoice
        </a>
      </div>
    </div>
  );

  return <InvoiceForm mode="edit" invoiceId={id} initialData={invoice} />;
}
