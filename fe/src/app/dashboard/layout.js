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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
        <div style="text-align: left; font-size: 13px; color: #475569; line-height: 1.6;">
          <p style="margin: 0 0 12px; font-size: 15px; color: #0f172a; font-weight: 700;">
            Hanya <b>Rp 99.000 / bulan</b> untuk fitur bisnis tanpa batas:
          </p>
          <ul style="margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px;">
            <li><b style="color: #10b981;">✓</b> <b>Unlimited Invoices</b> (Tanpa batas kuota)</li>
            <li><b style="color: #10b981;">✓</b> Integrasi Pembayaran Otomatis Midtrans (BYOK)</li>
            <li><b style="color: #10b981;">✓</b> Upload Bukti Transfer Bank & Verifikasi Cepat</li>
            <li><b style="color: #10b981;">✓</b> Notifikasi Email Klien & Generate PDF Puppeteer</li>
          </ul>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: '💳 Bayar via Midtrans (Rp 99.000)',
      cancelButtonText: 'Nanti Saja',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#94a3b8',
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
      text: 'Sesi Anda saat ini akan diakhiri.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Ya, Keluar',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#94a3b8',
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

      {/* ── Desktop Floating Glass Sidebar ────────────────────────────── */}
      <aside className="sidebar glass-card">
        <div className="sidebar-brand">
          <div className="sidebar-logo">⚡</div>
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
              <span style={{ fontSize: 11, color: '#92400e', fontWeight: 600 }}>Unlimited Invoices</span>
            </div>
          ) : (
            <div className="tier-free-box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.04em' }}>PAKET FREE</span>
                <span style={{ fontSize: 11, color: '#4f46e5', fontWeight: 700 }}>
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
              {user?.business_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="sidebar-user-info">
              <p className="sidebar-user-email">{user?.business_name || user?.email}</p>
              <p className="sidebar-user-tier" style={{ color: isPro ? '#b45309' : '#4f46e5' }}>
                {isPro ? '👑 Pro Member' : 'Free Plan'}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-logout" title="Keluar dari akun">
            Keluar
          </button>
        </div>
      </aside>

      {/* ── Mobile Header & Navigation Drawer ─────────────────────────── */}
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="sidebar-logo" style={{ width: 32, height: 32, fontSize: 16 }}>⚡</div>
          <span className="sidebar-name" style={{ fontSize: 18 }}>Snap<b>Bill</b></span>
        </div>
        <button
          type="button"
          className="btn-hamburger"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      <div
        className={`mobile-drawer-overlay ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <div className={`mobile-drawer ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-brand" style={{ marginBottom: 20 }}>
          <div className="sidebar-logo">⚡</div>
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

        <div style={{ marginTop: 'auto' }}>
          <div className="sidebar-footer" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
            <div className="sidebar-user">
              <div className="sidebar-avatar">
                {user?.business_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="sidebar-user-info">
                <p className="sidebar-user-email">{user?.business_name || user?.email}</p>
                <p className="sidebar-user-tier" style={{ color: isPro ? '#b45309' : '#4f46e5' }}>
                  {isPro ? '👑 Pro Member' : 'Free Plan'}
                </p>
              </div>
            </div>
            <button onClick={handleLogout} className="btn-logout">
              Keluar
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Dashboard Content ────────────────────────────────────── */}
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
