'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 pb-16">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 rounded-3xl shadow-sm p-10 text-center max-w-lg mx-auto">
          <span className="text-5xl block mb-3">⚠️</span>
          <p className="text-sm font-semibold text-slate-700 mb-5">{error}</p>
          <Link
            href="/dashboard/invoices"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md transition"
          >
            ← Kembali ke daftar invoice
          </Link>
        </div>
      </div>
    );
  }

  return <InvoiceForm mode="edit" invoiceId={id} initialData={invoice} />;
}
