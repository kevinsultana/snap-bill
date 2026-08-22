'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useTranslation } from '@/lib/i18n/useTranslation';
import LanguageSwitcher from '@/components/LanguageSwitcher';

export default function LandingPage() {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Cek apakah user sudah memiliki sesi login aktif (cookie JWT)
  useEffect(() => {
    api.get('/api/settings')
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false));
  }, []);

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const faqs = [
    {
      q: t('landing.faq_1_q'),
      a: t('landing.faq_1_a'),
    },
    {
      q: t('landing.faq_2_q'),
      a: t('landing.faq_2_a'),
    },
    {
      q: t('landing.faq_3_q'),
      a: t('landing.faq_3_a'),
    },
    {
      q: t('landing.faq_4_q'),
      a: t('landing.faq_4_a'),
    },
    {
      q: t('landing.faq_5_q'),
      a: t('landing.faq_5_a'),
    },
    {
      q: t('landing.faq_6_q'),
      a: t('landing.faq_6_a'),
    },
  ];

  return (
    <div className="landing-wrapper">
      {/* ── 1. Sticky Navigation Bar ───────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-container">
          <Link href="/" className="landing-brand">
            <div className="sidebar-logo" style={{ width: 36, height: 36, fontSize: 18 }}>⚡</div>
            <span className="sidebar-name" style={{ fontSize: 20 }}>Snap<b>Bill</b></span>
          </Link>

          <div className="landing-nav-links">
            <a href="#fitur" className="nav-link">{t('landing.nav_features')}</a>
            <a href="#harga" className="nav-link">{t('landing.nav_pricing')}</a>
            <a href="#faq" className="nav-link">FAQ</a>
          </div>

          <div className="landing-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <LanguageSwitcher size="small" />

            {isLoggedIn ? (
              <Link href="/dashboard" className="btn-primary" style={{ padding: '7px 16px', fontSize: 13, fontWeight: 700 }}>
                {t('nav.dashboard')} ➜
              </Link>
            ) : (
              <Link href="/login" className="btn-primary" style={{ padding: '7px 18px', fontSize: 13, fontWeight: 700 }}>
                {t('auth.btn_login')}
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── 2. Hero Section ────────────────────────────────────────── */}
      <section className="hero-section">
        <div className="hero-badge">
          <span>⚡</span> {t('landing.hero_badge')}
        </div>

        <h1 className="hero-title">
          {t('landing.hero_title_1')} <br />
          <span className="gradient-text">{t('landing.hero_title_2')}</span>
        </h1>

        <p className="hero-subtitle">
          {t('landing.hero_desc')}
        </p>

        <div className="hero-cta-group">
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="btn-primary" style={{ padding: '14px 30px', fontSize: 15, borderRadius: 14 }}>
                📊 {t('dashboard.welcome')} {t('nav.dashboard')} ➜
              </Link>
              <Link href="/dashboard/invoices/create" className="btn-secondary" style={{ padding: '14px 26px', fontSize: 15, borderRadius: 14 }}>
                {t('dashboard.btn_create_invoice')}
              </Link>
            </>
          ) : (
            <>
              <Link href="/register" className="btn-primary" style={{ padding: '14px 30px', fontSize: 15, borderRadius: 14 }}>
                {t('landing.cta_primary')}
              </Link>
              <a href="#harga" className="btn-secondary" style={{ padding: '14px 26px', fontSize: 15, borderRadius: 14 }}>
                💎 {t('landing.pricing_badge')}
              </a>
            </>
          )}
        </div>

        <div className="hero-metrics">
          <div className="metric-item">
            <span className="metric-val">100%</span>
            <span className="metric-lbl">{t('landing.hero_stat_gateway')}</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-val">{t('landing.hero_stat_settled')}</span>
            <span className="metric-lbl">{t('landing.brand_tagline')}</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-val">{t('landing.hero_stat_invoices')}</span>
            <span className="metric-lbl">Multi-Tenancy</span>
          </div>
        </div>

        {/* Hero Interactive Mockup Preview */}
        <div className="hero-mockup-wrapper">
          <div className="glass-card mockup-card">
            <div className="mockup-header">
              <div className="mockup-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <div className="mockup-url">https://snapbill.id/pay/inv-demo-2026</div>
              <span className="status-badge badge-emerald" style={{ fontSize: 11 }}>{t('invoices.status_paid')}</span>
            </div>

            <div className="mockup-body">
              <div className="mockup-inv-row">
                <div>
                  <p className="mockup-inv-title">Invoice #INV-202608-0042</p>
                  <p className="mockup-inv-client">Ditujukan ke: PT. Samudera Digital Nusantara</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="mockup-inv-label">{t('common.total')}</p>
                  <p className="mockup-inv-amount">Rp 4.500.000</p>
                </div>
              </div>

              <div className="mockup-items-mini">
                <div className="mockup-item-row">
                  <span>Jasa UI/UX Design & Branding SaaS</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Rp 3.500.000</span>
                </div>
                <div className="mockup-item-row">
                  <span>Development Next.js & Integrasi Payment</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Rp 1.000.000</span>
                </div>
              </div>

              <div className="mockup-actions-mini">
                <div className="mockup-badge-info">
                  <span>💳 Terbayar via QRIS Midtrans</span>
                </div>
                <div className="mockup-badge-info">
                  <span>📄 PDF Terkirim ke Email Klien</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Features Section ─────────────────────────────────────── */}
      <section id="fitur" className="landing-section">
        <div className="section-title-wrap">
          <span className="section-kicker">{t('landing.features_badge')}</span>
          <h2 className="section-heading">{t('landing.features_title')}</h2>
          <p className="section-sub">{t('landing.hero_desc')}</p>
        </div>

        <div className="features-grid">
          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5' }}>
              📄
            </div>
            <h3 className="feature-title">{t('landing.feat_3_title')}</h3>
            <p className="feature-desc">{t('landing.feat_3_desc')}</p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
              💳
            </div>
            <h3 className="feature-title">{t('landing.feat_1_title')}</h3>
            <p className="feature-desc">{t('landing.feat_1_desc')}</p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
              🏦
            </div>
            <h3 className="feature-title">{t('landing.feat_2_title')}</h3>
            <p className="feature-desc">{t('landing.feat_2_desc')}</p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706' }}>
              📧
            </div>
            <h3 className="feature-title">{t('landing.feat_4_title')}</h3>
            <p className="feature-desc">{t('landing.feat_4_desc')}</p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#9333ea' }}>
              👥
            </div>
            <h3 className="feature-title">{t('landing.feat_5_title')}</h3>
            <p className="feature-desc">{t('landing.feat_5_desc')}</p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#db2777' }}>
              ⚡
            </div>
            <h3 className="feature-title">{t('landing.feat_6_title')}</h3>
            <p className="feature-desc">{t('landing.feat_6_desc')}</p>
          </div>
        </div>
      </section>

      {/* ── 4. Pricing Section (Free vs Pro) ───────────────────────── */}
      <section id="harga" className="landing-section">
        <div className="section-title-wrap">
          <span className="section-kicker">{t('landing.pricing_badge')}</span>
          <h2 className="section-heading">{t('landing.pricing_title')}</h2>
        </div>

        <div className="pricing-grid">
          {/* FREE PLAN */}
          <div className="glass-card pricing-card">
            <div className="pricing-header">
              <h3 className="pricing-tier-name">{t('landing.pricing_free_title')}</h3>
              <p className="pricing-tier-desc">{t('landing.pricing_free_desc')}</p>
              <div className="pricing-price-box">
                <span className="pricing-currency">Rp</span>
                <span className="pricing-amount">0</span>
                <span className="pricing-period">{t('landing.pricing_free_period')}</span>
              </div>
            </div>

            <ul className="pricing-features">
              <li><b style={{ color: '#059669' }}>✓</b> <b>{t('landing.pricing_free_f1')}</b></li>
              <li><b style={{ color: '#059669' }}>✓</b> {t('landing.pricing_free_f2')}</li>
              <li><b style={{ color: '#059669' }}>✓</b> {t('landing.pricing_free_f3')}</li>
              <li><b style={{ color: '#059669' }}>✓</b> {t('landing.pricing_free_f4')}</li>
              <li className="feature-disabled">✕ Unlimited Invoices</li>
              <li className="feature-disabled">✕ Midtrans Snap BYOK</li>
            </ul>

            <Link href={isLoggedIn ? "/dashboard" : "/register"} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 'auto', padding: '12px' }}>
              {isLoggedIn ? t('nav.dashboard') : t('landing.pricing_free_cta')}
            </Link>
          </div>

          {/* PRO PLAN */}
          <div className="glass-card pricing-card pricing-card-pro">
            <div className="popular-badge">{t('landing.pricing_pro_badge')}</div>

            <div className="pricing-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h3 className="pricing-tier-name">{t('landing.pricing_pro_title')}</h3>
                <span className="badge-pro-glow">UNLIMITED</span>
              </div>
              <p className="pricing-tier-desc">{t('landing.pricing_pro_desc')}</p>
              <div className="pricing-price-box">
                <span className="pricing-currency">Rp</span>
                <span className="pricing-amount" style={{ color: 'var(--indigo-dark)' }}>99.000</span>
                <span className="pricing-period">{t('landing.pricing_pro_period')}</span>
              </div>
            </div>

            <ul className="pricing-features">
              <li><b style={{ color: '#059669' }}>✓</b> <b>{t('landing.pricing_pro_f1')}</b></li>
              <li><b style={{ color: '#059669' }}>✓</b> {t('landing.pricing_pro_f2')}</li>
              <li><b style={{ color: '#059669' }}>✓</b> {t('landing.pricing_pro_f3')}</li>
              <li><b style={{ color: '#059669' }}>✓</b> {t('landing.pricing_pro_f4')}</li>
              <li><b style={{ color: '#059669' }}>✓</b> {t('landing.pricing_pro_f5')}</li>
              <li><b style={{ color: '#059669' }}>✓</b> {t('landing.pricing_pro_f6')}</li>
            </ul>

            <Link href={isLoggedIn ? "/dashboard/subscription" : "/register"} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 'auto', padding: '13px', fontSize: 15 }}>
              {t('landing.pricing_pro_cta')} ➜
            </Link>
          </div>
        </div>
      </section>

      {/* ── 5. FAQ Section ─────────────────────────────────────────── */}
      <section id="faq" className="landing-section" style={{ maxWidth: 840, margin: '0 auto' }}>
        <div className="section-title-wrap">
          <span className="section-kicker">FAQ</span>
          <h2 className="section-heading">{t('landing.faq_title')}</h2>
        </div>

        <div className="faq-list">
          {faqs.map((faq, idx) => (
            <div key={idx} className={`glass-card faq-item ${openFaq === idx ? 'open' : ''}`}>
              <button className="faq-question" onClick={() => toggleFaq(idx)}>
                <span>{faq.q}</span>
                <span className="faq-icon">{openFaq === idx ? '−' : '+'}</span>
              </button>
              {openFaq === idx && (
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. Footer ──────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div>
            <div className="landing-brand">
              <div className="sidebar-logo" style={{ width: 32, height: 32, fontSize: 16 }}>⚡</div>
              <span className="sidebar-name" style={{ fontSize: 18 }}>Snap<b>Bill</b></span>
            </div>
            <p className="footer-desc">
              {t('landing.hero_desc')}
            </p>
          </div>

          <div className="footer-links-col">
            <h4>{t('common.actions')}</h4>
            <a href="#fitur">{t('landing.features_badge')}</a>
            <a href="#harga">{t('landing.pricing_badge')}</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="footer-links-col">
            <h4>SnapBill</h4>
            <Link href="/login">{t('auth.btn_login')}</Link>
            <Link href="/register">{t('auth.btn_register')}</Link>
            <Link href="/dashboard">{t('nav.dashboard')}</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} SnapBill SaaS. {t('landing.footer_rights')}</p>
        </div>
      </footer>
    </div>
  );
}
