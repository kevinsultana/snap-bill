'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Swal from 'sweetalert2';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/dashboard/clients', label: 'Klien', icon: '👥' },
  { href: '/dashboard/items', label: 'Item / Layanan', icon: '📦' },
  { href: '/dashboard/invoices', label: 'Invoice', icon: '🧾' },
  { href: '/dashboard/subscription', label: 'Langganan', icon: '💎' },
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

  const fetchUserData = useCallback(() => {
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
  }, [router]);

  useEffect(() => {
    fetchUserData();
  }, [pathname, searchParams, fetchUserData]);

  // Listen to subscription_updated custom event from any page
  useEffect(() => {
    const handleSubUpdate = () => {
      fetchUserData();
    };
    window.addEventListener('subscription_updated', handleSubUpdate);
    return () => window.removeEventListener('subscription_updated', handleSubUpdate);
  }, [fetchUserData]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Redirect ke halaman langganan untuk upgrade
  const handleUpgradePro = () => {
    router.push('/dashboard/subscription');
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
            <Link href="/dashboard/subscription" className="tier-pro-badge" style={{ textDecoration: 'none', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>👑</span>
                  <b>PRO ACTIVE</b>
                </div>
                <span style={{ fontSize: 10, color: '#b45309' }}>Lihat ↗</span>
              </div>
              <span style={{ fontSize: 11, color: '#92400e', fontWeight: 600, display: 'block', marginTop: 2 }}>Unlimited Invoices</span>
            </Link>
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
