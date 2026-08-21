'use client';

import { useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

export default function PublicInvoiceRedirectPage() {
  const { token } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (token) {
      const q = searchParams ? searchParams.toString() : '';
      router.replace(`/pay/${token}${q ? `?${q}` : ''}`);
    }
  }, [token, searchParams, router]);

  return (
    <div className="pay-portal-container" style={{ textAlign: 'center', paddingTop: 80 }}>
      <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
      <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Mengarahkan ke portal pembayaran invoice...</p>
    </div>
  );
}
