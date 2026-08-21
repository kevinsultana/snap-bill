'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Swal from 'sweetalert2';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/clients', label: 'Klien', icon: '👥' },
  { href: '/dashboard/items', label: 'Item / Layanan', icon: '📦' },
  { href: '/dashboard/invoices', label: 'Invoice', icon: '🧾' },
  { href: '/dashboard/settings', label: 'Pengaturan', icon: '⚙️' },
];

function DashboardLayoutContent({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [user, setUser] = useState(null);
  const [subStatus, setSubStatus] = useState(null);
  const [checking, setChecking] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  const fetchUserData = () => {
    return Promise.all([
      api.get('/api/settings'),
      api.get('/api/subscriptions/status').catch(() => ({ data: null })),
    ])
      .then(([settingsRes, subRes]) => {
        setUser(settingsRes.data);
        if (subRes.data) setSubStatus(subRes.data);
      })
      .catch(() => router.push('/login'))
      .finally(() => setChecking(false));
  };

  useEffect(() => {
    fetchUserData();
  }, [router]);

  // Handle return from Midtrans payment redirect
  useEffect(() => {
    if (searchParams?.get('subscribed') === 'success') {
      api.post('/api/subscriptions/verify-status')
        .then(() => {
          Swal.fire({
            icon: 'success',
            title: '🎉 Selamat Datang di SnapBill PRO!',
            text: 'Langganan Pro Anda telah aktif. Anda kini dapat membuat invoice tanpa batas!',
            confirmButtonColor: '#6366f1',
          });
          fetchUserData();
        })
        .catch(() => {});
    }
  }, [searchParams]);

  // Handle Upgrade to Pro Checkout
  const handleUpgradePro = async () => {
    const result = await Swal.fire({
      title: '⚡ Upgrade ke SnapBill PRO',
      html: `
        <div style="text-align: left; font-size: 13px; color: #94a3b8; line-height: 1.6;">
          <p style="margin: 0 0 12px; font-size: 15px; color: #f1f5f9; font-weight: 600;">
            Hanya <b>Rp 99.000 / bulan</b> untuk fitur tanpa batas:
          </p>
          <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px;">
            <li><b style="color: #10b981;">✓</b> <b>Unlimited Invoices</b> (Tanpa batas kuota bulanan)</li>
            <li><b style="color: #10b981;">✓</b> Integrasi Pembayaran Online Midtrans (BYOK)</li>
            <li><b style="color: #10b981;">✓</b> Upload Bukti Transfer Bank & Verifikasi 1-Klik</li>
            <li><b style="color: #10b981;">✓</b> Notifikasi Email Otomatis & Generate PDF</li>
          </ul>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '💳 Bayar via Midtrans (Rp 99.000)',
      cancelButtonText: 'Nanti Saja',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#374151',
      customClass: { popup: 'swal-custom-popup' },
    });

    if (!result.isConfirmed) return;

    setUpgrading(true);
    try {
      const res = await api.post('/api/subscriptions/create-snap');
      if (res.data.redirect_url) {
        window.location.href = res.data.redirect_url;
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Gagal Memproses Langganan',
        text: err.response?.data?.message || 'Terjadi kendala saat menghubungkan ke payment gateway.',
        confirmButtonColor: '#6366f1',
      });
    } finally {
      setUpgrading(false);
    }
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'Yakin ingin keluar?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Keluar',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#374151',
    });
    if (result.isConfirmed) {
      await api.post('/api/auth/logout');
      router.push('/login');
    }
  };

  if (checking) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  const isPro = subStatus?.tier === 'pro' || user?.tier === 'pro';

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">⚡</span>
          <span className="sidebar-name">Snap<b>Bill</b></span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Tier & Subscription Card in Sidebar */}
        <div className="sidebar-tier-box">
          {isPro ? (
            <div className="tier-pro-badge">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>👑</span>
                <b>PRO ACTIVE</b>
              </div>
              <span style={{ fontSize: 11, color: '#fef08a' }}>Unlimited Invoices</span>
            </div>
          ) : (
            <div className="tier-free-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>PAKET FREE</span>
                <span style={{ fontSize: 11, color: '#818cf8', fontWeight: 600 }}>
                  {subStatus?.invoiceCountThisMonth ?? 0} / 10 inv
                </span>
              </div>
              <div className="tier-progress-bar">
                <div
                  className="tier-progress-fill"
                  style={{
                    width: `${Math.min(100, ((subStatus?.invoiceCountThisMonth ?? 0) / 10) * 100)}%`,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleUpgradePro}
                disabled={upgrading}
                className="btn-upgrade-sidebar"
              >
                {upgrading ? 'Memuat...' : '⚡ Upgrade Pro (Rp 99rb)'}
              </button>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="sidebar-user-info">
              <p className="sidebar-user-email">{user?.business_name || user?.email}</p>
              <p className="sidebar-user-tier" style={{ color: isPro ? '#facc15' : 'var(--indigo-light)' }}>
                {isPro ? '👑 Pro Plan' : 'Free Plan'}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout">Keluar</button>
        </div>
      </aside>

      {/* Main content */}
      <main className="dashboard-main">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <Suspense
      fallback={
        <div className="loading-screen">
          <div className="loading-spinner" />
        </div>
      }
    >
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
