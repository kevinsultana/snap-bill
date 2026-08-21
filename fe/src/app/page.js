'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function LandingPage() {
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
      q: 'Apa itu model BYOK (Bring Your Own Key) Midtrans di SnapBill?',
      a: 'Dengan model BYOK, dana pembayaran dari klien Anda langsung masuk 100% ke akun Midtrans Anda sendiri tanpa perantara dan tanpa potongan komisi dari SnapBill. Cukup masukkan Server Key Midtrans Anda di menu Pengaturan.',
    },
    {
      q: 'Bagaimana jika klien ingin membayar melalui transfer bank manual?',
      a: 'Sangat praktis! Anda dapat mendaftarkan hingga 5 nomor rekening bank (BCA, Mandiri, BNI, BRI, dll). Klien akan melihat nomor rekening di portal publik dan dapat mengunggah struk bukti transfer untuk Anda verifikasi langsung di Dashboard.',
    },
    {
      q: 'Apa keunggulan Paket Pro dibanding Paket Free?',
      a: 'Paket Free menyediakan kuota 10 invoice gratis setiap bulan selamanya. Paket Pro (Rp 99.000/bulan) memberikan kuota invoice tanpa batas (unlimited), integrasi Midtrans Snap otomatis, pengiriman email notifikasi klien, dan generate PDF berkecepatan tinggi.',
    },
    {
      q: 'Apakah data klien dan faktur saya aman?',
      a: 'Tentu. SnapBill dibangun dengan arsitektur Multi-Tenancy terisolasi. Data kontak klien, transaksi, dan bukti transfer Anda dienkripsi dan hanya dapat diakses oleh akun Anda sendiri.',
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
            <a href="#fitur" className="nav-link">Fitur</a>
            <a href="#cara-kerja" className="nav-link">Cara Kerja</a>
            <a href="#harga" className="nav-link">Pilihan Harga</a>
            <a href="#faq" className="nav-link">Tanya Jawab</a>
          </div>

          <div className="landing-nav-actions">
            {isLoggedIn ? (
              <Link href="/dashboard" className="btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}>
                📊 Buka Dashboard ➜
              </Link>
            ) : (
              <>
                <Link href="/login" className="btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>
                  Masuk
                </Link>
                <Link href="/register" className="btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}>
                  Daftar Gratis ➜
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── 2. Hero Section ────────────────────────────────────────── */}
      <section className="hero-section">
        <div className="hero-badge">
          <span>⚡</span> Platform Invoice SaaS #1 untuk Freelancer & Pemilik Usaha
        </div>

        <h1 className="hero-title">
          Kelola & Terbitkan Invoice Bisnis <br />
          <span className="gradient-text">Lebih Cepat, Otomatis & Profesional</span>
        </h1>

        <p className="hero-subtitle">
          Solusi terpadu generator invoice dengan pembayaran online Midtrans instan, verifikasi struk transfer bank via MinIO Storage, pembuatan PDF otomatis, dan notifikasi email pintar.
        </p>

        <div className="hero-cta-group">
          {isLoggedIn ? (
            <>
              <Link href="/dashboard" className="btn-primary" style={{ padding: '14px 30px', fontSize: 15, borderRadius: 14 }}>
                📊 Masuk ke Dashboard ➜
              </Link>
              <Link href="/dashboard/invoices/create" className="btn-secondary" style={{ padding: '14px 26px', fontSize: 15, borderRadius: 14 }}>
                + Buat Invoice Baru
              </Link>
            </>
          ) : (
            <>
              <Link href="/register" className="btn-primary" style={{ padding: '14px 30px', fontSize: 15, borderRadius: 14 }}>
                🚀 Mulai Gratis (10 Inv/Bulan)
              </Link>
              <a href="#harga" className="btn-secondary" style={{ padding: '14px 26px', fontSize: 15, borderRadius: 14 }}>
                💎 Lihat Paket Pro
              </a>
            </>
          )}
        </div>

        <div className="hero-metrics">
          <div className="metric-item">
            <span className="metric-val">100%</span>
            <span className="metric-lbl">Direct Midtrans BYOK</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-val">&lt; 3 Detik</span>
            <span className="metric-lbl">Generate PDF Otomatis</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-val">3-Level</span>
            <span className="metric-lbl">Email Fallback Delivery</span>
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
              <span className="status-badge badge-emerald" style={{ fontSize: 11 }}>Lunas</span>
            </div>

            <div className="mockup-body">
              <div className="mockup-inv-row">
                <div>
                  <p className="mockup-inv-title">Invoice #INV-202608-0042</p>
                  <p className="mockup-inv-client">Ditujukan ke: PT. Samudera Digital Nusantara</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p className="mockup-inv-label">Total Tagihan</p>
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
          <span className="section-kicker">FITUR UNGGULAN</span>
          <h2 className="section-heading">Dirancang Khusus untuk Mempercepat Cash Flow Bisnis</h2>
          <p className="section-sub">Semua fitur yang Anda butuhkan untuk penagihan klien tanpa kerumitan administrasi manual.</p>
        </div>

        <div className="features-grid">
          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(99, 102, 241, 0.12)', color: '#4f46e5' }}>
              📄
            </div>
            <h3 className="feature-title">PDF Invoice Otomatis</h3>
            <p className="feature-desc">
              Hasilkan file PDF berformat faktur standar bisnis dalam hitungan detik menggunakan Puppeteer headless engine.
            </p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#059669' }}>
              💳
            </div>
            <h3 className="feature-title">Midtrans Snap (BYOK)</h3>
            <p className="feature-desc">
              Terima pembayaran otomatis via QRIS, Virtual Account BCA/Mandiri/BNI/BRI, dan E-Wallet langsung ke akun Midtrans Anda.
            </p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#2563eb' }}>
              🏦
            </div>
            <h3 className="feature-title">Transfer Bank & Upload Struk</h3>
            <p className="feature-desc">
              Sediakan hingga 5 rekening bank transfer manual. Klien dapat mengunggah bukti struk ke MinIO Object Storage dengan aman.
            </p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#d97706' }}>
              📧
            </div>
            <h3 className="feature-title">Multi-Provider Email Fallback</h3>
            <p className="feature-desc">
              Sistem pengiriman email pintar dengan failover otomatis bertingkat: Resend ➜ Brevo ➜ Gmail App Password.
            </p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(168, 85, 247, 0.12)', color: '#7e22ce' }}>
              👥
            </div>
            <h3 className="feature-title">Multi-Tenant Master Data</h3>
            <p className="feature-desc">
              Kelola database klien dan katalog produk/layanan tanpa batas dengan proteksi isolasi data terenkripsi.
            </p>
          </div>

          <div className="glass-card feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(244, 63, 94, 0.12)', color: '#e11d48' }}>
              🔍
            </div>
            <h3 className="feature-title">Dashboard Verifikasi Cepat</h3>
            <p className="feature-desc">
              Tinjau bukti transfer klien secara visual di dashboard dan setujui (Lunas) atau tolak dengan satu sentuhan mudah.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. How It Works ────────────────────────────────────────── */}
      <section id="cara-kerja" className="landing-section">
        <div className="section-title-wrap">
          <span className="section-kicker">CARA KERJA</span>
          <h2 className="section-heading">Tiga Langkah Sederhana Menagih Klien</h2>
          <p className="section-sub">Mulai dari pembuatan draf hingga dana masuk ke rekening Anda.</p>
        </div>

        <div className="steps-grid">
          <div className="glass-card step-card">
            <div className="step-number">1</div>
            <h3 className="step-title">Buat & Hitung Otomatis</h3>
            <p className="step-desc">
              Pilih klien, masukkan rincian item atau jasa, atur diskon nominal/persen dan pajak. Sistem menghitung total secara instan.
            </p>
          </div>

          <div className="glass-card step-card">
            <div className="step-number">2</div>
            <h3 className="step-title">Terbitkan & Kirim Link</h3>
            <p className="step-desc">
              Klik Terbitkan. Sistem otomatis membuat PDF dan mengirimkan email tagihan berisi link portal pembayaran publik klien.
            </p>
          </div>

          <div className="glass-card step-card">
            <div className="step-number">3</div>
            <h3 className="step-title">Terima Pembayaran</h3>
            <p className="step-desc">
              Klien membayar via Midtrans otomatis atau transfer bank dengan mengunggah struk. Anda verifikasi dan tagihan lunas!
            </p>
          </div>
        </div>
      </section>

      {/* ── 5. Pricing Section (Free vs Pro) ───────────────────────── */}
      <section id="harga" className="landing-section">
        <div className="section-title-wrap">
          <span className="section-kicker">PILIHAN PAKET</span>
          <h2 className="section-heading">Mulai Gratis, Upgrade Saat Bisnis Berkembang</h2>
          <p className="section-sub">Harga transparan tanpa biaya tersembunyi. Batalkan langganan kapan saja.</p>
        </div>

        <div className="pricing-grid">

          {/* FREE PLAN */}
          <div className="glass-card pricing-card">
            <div className="pricing-header">
              <h3 className="pricing-tier-name">Paket Free</h3>
              <p className="pricing-tier-desc">Cocok untuk pemula & freelancer perorangan</p>
              <div className="pricing-price-box">
                <span className="pricing-currency">Rp</span>
                <span className="pricing-amount">0</span>
                <span className="pricing-period">/ bulan</span>
              </div>
            </div>

            <ul className="pricing-features">
              <li><b style={{ color: '#059669' }}>✓</b> <b>10 Invoice</b> per bulan kalender</li>
              <li><b style={{ color: '#059669' }}>✓</b> Kelola Master Klien & Katalog Item</li>
              <li><b style={{ color: '#059669' }}>✓</b> Portal Pembayaran Publik Klien</li>
              <li><b style={{ color: '#059669' }}>✓</b> Transfer Bank & Upload Bukti MinIO</li>
              <li><b style={{ color: '#059669' }}>✓</b> Format PDF Standar</li>
              <li className="feature-disabled">✕ Unlimited Invoices</li>
              <li className="feature-disabled">✕ Integrasi Midtrans Snap BYOK</li>
            </ul>

            <Link href={isLoggedIn ? "/dashboard" : "/register"} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', marginTop: 'auto', padding: '12px' }}>
              {isLoggedIn ? "Buka Dashboard" : "Daftar Gratis Sekarang"}
            </Link>
          </div>

          {/* PRO PLAN */}
          <div className="glass-card pricing-card pricing-card-pro">
            <div className="popular-badge">⚡ PALING POPULER</div>

            <div className="pricing-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h3 className="pricing-tier-name">Paket Pro</h3>
                <span className="badge-pro-glow">UNLIMITED</span>
              </div>
              <p className="pricing-tier-desc">Untuk freelancer aktif, agensi, konsultan & UMKM</p>
              <div className="pricing-price-box">
                <span className="pricing-currency">Rp</span>
                <span className="pricing-amount" style={{ color: 'var(--indigo-dark)' }}>99.000</span>
                <span className="pricing-period">/ bulan</span>
              </div>
            </div>

            <ul className="pricing-features">
              <li><b style={{ color: '#059669' }}>✓</b> <b>UNLIMITED Invoices</b> (Tanpa batas kuota)</li>
              <li><b style={{ color: '#059669' }}>✓</b> Semua Fitur Paket Free</li>
              <li><b style={{ color: '#059669' }}>✓</b> <b>Integrasi Midtrans Snap (BYOK)</b></li>
              <li><b style={{ color: '#059669' }}>✓</b> <b>Multi-Provider Email Fallback</b></li>
              <li><b style={{ color: '#059669' }}>✓</b> <b>Puppeteer Headless PDF Engine</b></li>
              <li><b style={{ color: '#059669' }}>✓</b> Dukungan Prioritas & Lencana Pro Member</li>
            </ul>

            <Link href={isLoggedIn ? "/dashboard/settings" : "/register"} className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 'auto', padding: '13px', fontSize: 15 }}>
              ⚡ Langganan Pro Sekarang ➜
            </Link>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
              Pembayaran otomatis instan via Midtrans (QRIS, VA, E-Wallet)
            </p>
          </div>

        </div>
      </section>

      {/* ── 6. FAQ Section ─────────────────────────────────────────── */}
      <section id="faq" className="landing-section" style={{ maxWidth: 840, margin: '0 auto' }}>
        <div className="section-title-wrap">
          <span className="section-kicker">TANYA JAWAB</span>
          <h2 className="section-heading">Pertanyaan yang Sering Diajukan</h2>
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

      {/* ── 7. Call To Action Banner ───────────────────────────────── */}
      <section className="landing-section" style={{ paddingBottom: 80 }}>
        <div className="glass-card cta-banner-card">
          <h2 className="cta-heading">Siap Meningkatkan Profesionalitas Penagihan Anda?</h2>
          <p className="cta-sub">
            Bergabunglah dengan ratusan profesional dan pemilik bisnis yang menghemat waktu penagihan bersama SnapBill.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
            {isLoggedIn ? (
              <Link href="/dashboard" className="btn-primary" style={{ padding: '14px 28px', fontSize: 15 }}>
                📊 Buka Dashboard Saya ➜
              </Link>
            ) : (
              <>
                <Link href="/register" className="btn-primary" style={{ padding: '14px 28px', fontSize: 15 }}>
                  🚀 Mulai Akun Gratis Sekarang
                </Link>
                <Link href="/login" className="btn-secondary" style={{ padding: '14px 24px', fontSize: 15 }}>
                  Masuk ke Akun
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── 8. Footer ──────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div>
            <div className="landing-brand">
              <div className="sidebar-logo" style={{ width: 32, height: 32, fontSize: 16 }}>⚡</div>
              <span className="sidebar-name" style={{ fontSize: 18 }}>Snap<b>Bill</b></span>
            </div>
            <p className="footer-desc">
              Platform Invoice Generator SaaS modern dengan integrasi pembayaran Midtrans Snap, penyimpanan bukti MinIO S3, dan otomatisasi email multi-provider.
            </p>
          </div>

          <div className="footer-links-col">
            <h4>Navigasi</h4>
            <a href="#fitur">Fitur Unggulan</a>
            <a href="#cara-kerja">Cara Kerja</a>
            <a href="#harga">Pilihan Paket</a>
            <a href="#faq">Tanya Jawab</a>
          </div>

          <div className="footer-links-col">
            <h4>Aplikasi</h4>
            <Link href="/login">Masuk Akun</Link>
            <Link href="/register">Daftar Akun Gratis</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} SnapBill SaaS. Seluruh hak cipta dilindungi.</p>
        </div>
      </footer>

    </div>
  );
}
