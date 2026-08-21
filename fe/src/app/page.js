'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (idx) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const faqs = [
    {
      q: 'Apa itu model BYOK (Bring Your Own Key) Midtrans di SnapBill?',
      a: 'Dengan model BYOK, uang pembayaran dari klien Anda langsung masuk 100% ke rekening Midtrans milik Anda sendiri tanpa potongan komisi perantara dari SnapBill. Anda cukup memasukkan Server Key Midtrans di menu Pengaturan.',
    },
    {
      q: 'Bagaimana jika klien saya ingin membayar lewat transfer manual?',
      a: 'Sangat mudah! Anda bisa menambahkan hingga 5 nomor rekening bank (BCA, Mandiri, BNI, dll). Klien akan melihat nomor rekening di portal pembayaran dan dapat langsung mengunggah foto/PDF bukti transfer untuk Anda verifikasi di Dashboard.',
    },
    {
      q: 'Apa perbedaan Paket Free dan Paket Pro?',
      a: 'Paket Free memungkinkan Anda membuat hingga 10 invoice per bulan secara gratis selamanya. Paket Pro (Rp 99.000/bulan) memberikan kuota invoice tanpa batas (unlimited), pengiriman email otomatis ke klien, integrasi Midtrans Snap, serta pembuatan PDF berkecepatan tinggi.',
    },
    {
      q: 'Apakah data invoice dan klien saya aman?',
      a: 'Ya, SnapBill menerapkan arsitektur Multi-Tenancy yang ketat di mana setiap data dienkripsi dan diisolasi khusus untuk akun Anda. Pengguna lain tidak memiliki akses ke klien maupun catatan keuangan Anda.',
    },
  ];

  return (
    <div className="landing-wrapper">

      {/* ── 1. Sticky Navigation Bar ───────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-container">
          <Link href="/" className="landing-brand">
            <span className="brand-icon">⚡</span>
            <span className="brand-text">Snap<span>Bill</span></span>
          </Link>

          <div className="landing-nav-links">
            <a href="#fitur" className="nav-link">Fitur</a>
            <a href="#cara-kerja" className="nav-link">Cara Kerja</a>
            <a href="#harga" className="nav-link">Harga</a>
            <a href="#faq" className="nav-link">FAQ</a>
          </div>

          <div className="landing-nav-actions">
            <Link href="/login" className="btn-nav-login">Masuk</Link>
            <Link href="/register" className="btn-nav-cta">Daftar Gratis</Link>
          </div>
        </div>
      </nav>

      {/* ── 2. Hero Section ────────────────────────────────────────── */}
      <section className="hero-section">
        <div className="hero-badge">
          <span>⚡</span> Platform Invoice SaaS #1 untuk Freelancer & Bisnis
        </div>

        <h1 className="hero-title">
          Kelola & Terbitkan Invoice Bisnis <br />
          <span className="gradient-text">Lebih Cepat, Otomatis & Profesional</span>
        </h1>

        <p className="hero-subtitle">
          Solusi terpadu generator invoice dengan pembayaran online Midtrans instan, verifikasi struk transfer bank via MinIO Storage, pembuatan PDF otomatis, dan notifikasi email pintar.
        </p>

        <div className="hero-cta-group">
          <Link href="/register" className="btn-hero-primary">
            🚀 Mulai Gratis (10 Inv/Bulan)
          </Link>
          <a href="#harga" className="btn-hero-secondary">
            💎 Lihat Paket Pro
          </a>
        </div>

        <div className="hero-metrics">
          <div className="metric-item">
            <span className="metric-val">100%</span>
            <span className="metric-lbl">Direct to Your Midtrans</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-val">&lt; 3 Detik</span>
            <span className="metric-lbl">Generate PDF Otomatis</span>
          </div>
          <div className="metric-divider" />
          <div className="metric-item">
            <span className="metric-val">3-Level</span>
            <span className="metric-lbl">Email Fallback System</span>
          </div>
        </div>

        {/* Hero Interactive Mockup Preview */}
        <div className="hero-mockup-wrapper">
          <div className="hero-mockup-card">
            <div className="mockup-header">
              <div className="mockup-dots">
                <span className="dot dot-red" />
                <span className="dot dot-yellow" />
                <span className="dot dot-green" />
              </div>
              <div className="mockup-url">https://snapbill.id/pay/demo-inv-2026</div>
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
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Rp 3.500.000</span>
                </div>
                <div className="mockup-item-row">
                  <span>Development Next.js & Integrasi Payment</span>
                  <span style={{ fontWeight: 600, color: '#f1f5f9' }}>Rp 1.000.000</span>
                </div>
              </div>

              <div className="mockup-actions-mini">
                <div className="mockup-badge-info">
                  <span>💳 Terbayar via QRIS Midtrans</span>
                </div>
                <div className="mockup-badge-info">
                  <span>📄 PDF Terkirim ke Klien</span>
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
          <h2 className="section-heading">Dirancang Khusus untuk Mempercepat Cash Flow Anda</h2>
          <p className="section-sub">Semua fitur yang Anda butuhkan untuk mengelola tagihan tanpa kerumitan administrasi.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
              📄
            </div>
            <h3 className="feature-title">PDF Invoice Otomatis</h3>
            <p className="feature-desc">
              Hasilkan file PDF berformat faktur standar bisnis dalam hitungan detik menggunakan engine Puppeteer headless.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              💳
            </div>
            <h3 className="feature-title">Midtrans Snap (BYOK)</h3>
            <p className="feature-desc">
              Terima pembayaran QRIS, Virtual Account BCA/Mandiri/BNI, dan E-Wallet langsung ke akun Midtrans Anda sendiri.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
              🏦
            </div>
            <h3 className="feature-title">Transfer Bank & Upload Struk</h3>
            <p className="feature-desc">
              Sediakan hingga 5 rekening bank manual. Klien dapat mengunggah bukti struk ke MinIO Object Storage dengan aman.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              📧
            </div>
            <h3 className="feature-title">Multi-Provider Email Fallback</h3>
            <p className="feature-desc">
              Sistem pengiriman email pintar dengan hierarki failover otomatis: Resend ➜ Brevo ➜ Gmail App Password.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
              👥
            </div>
            <h3 className="feature-title">Multi-Tenant Master Data</h3>
            <p className="feature-desc">
              Kelola database klien dan katalog produk/layanan tanpa batas dengan isolasi data terenkripsi antar pengguna.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6' }}>
              🔍
            </div>
            <h3 className="feature-title">Dashboard Verifikasi Cepat</h3>
            <p className="feature-desc">
              Tinjau bukti transfer klien secara visual di dashboard dan setujui (Lunas) atau tolak dengan satu sentuhan.
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. How It Works ────────────────────────────────────────── */}
      <section id="cara-kerja" className="landing-section" style={{ background: 'rgba(22, 22, 40, 0.4)' }}>
        <div className="section-title-wrap">
          <span className="section-kicker">CARA KERJA</span>
          <h2 className="section-heading">Tiga Langkah Sederhana Menagih Klien</h2>
          <p className="section-sub">Mulai dari pembuatan draf hingga dana masuk ke rekening Anda.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3 className="step-title">Buat & Hitung Otomatis</h3>
            <p className="step-desc">
              Pilih klien, masukkan rincian item atau jasa, atur diskon dan pajak. Sistem menghitung subtotal dan total secara instan.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">2</div>
            <h3 className="step-title">Terbitkan & Kirim Link</h3>
            <p className="step-desc">
              Klik Terbitkan. Sistem akan men-generate PDF dan mengirimkan email tagihan berisi link portal pembayaran publik klien.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">3</div>
            <h3 className="step-title">Terima Pembayaran</h3>
            <p className="step-desc">
              Klien membayar otomatis via Midtrans atau transfer manual dengan mengunggah struk. Anda verifikasi dan tagihan lunas!
            </p>
          </div>
        </div>
      </section>

      {/* ── 5. Pricing Section (Free vs Pro) ───────────────────────── */}
      <section id="harga" className="landing-section">
        <div className="section-title-wrap">
          <span className="section-kicker">PILIHAN HARGA</span>
          <h2 className="section-heading">Mulai Gratis, Upgrade Saat Bisnis Berkembang</h2>
          <p className="section-sub">Transparan tanpa biaya tersembunyi. Batalkan kapan saja.</p>
        </div>

        <div className="pricing-grid">

          {/* FREE PLAN */}
          <div className="pricing-card">
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
              <li><b>✓ 10 Invoice</b> per bulan kalender</li>
              <li><b>✓</b> Kelola Klien & Katalog Item</li>
              <li><b>✓</b> Portal Pembayaran Publik Klien</li>
              <li><b>✓</b> Transfer Bank & Upload Bukti MinIO</li>
              <li><b>✓</b> Format PDF Standar</li>
              <li className="feature-disabled">✕ Unlimited Invoices</li>
              <li className="feature-disabled">✕ Integrasi Midtrans Snap BYOK</li>
            </ul>

            <Link href="/register" className="btn-pricing-free">
              Daftar Gratis Sekarang
            </Link>
          </div>

          {/* PRO PLAN */}
          <div className="pricing-card pricing-card-pro">
            <div className="popular-badge">⚡ PALING POPULER</div>

            <div className="pricing-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h3 className="pricing-tier-name" style={{ color: '#f1f5f9' }}>Paket Pro</h3>
                <span className="badge-pro-glow">UNLIMITED</span>
              </div>
              <p className="pricing-tier-desc">Untuk freelancer aktif, konsultan, agensi & UMKM</p>
              <div className="pricing-price-box">
                <span className="pricing-currency">Rp</span>
                <span className="pricing-amount">99.000</span>
                <span className="pricing-period">/ bulan</span>
              </div>
            </div>

            <ul className="pricing-features">
              <li><b style={{ color: '#10b981' }}>✓ UNLIMITED Invoices</b> (Tanpa batas kuota)</li>
              <li><b style={{ color: '#10b981' }}>✓</b> Semua Fitur Paket Free</li>
              <li><b style={{ color: '#10b981' }}>✓</b> <b>Integrasi Midtrans Snap (BYOK)</b></li>
              <li><b style={{ color: '#10b981' }}>✓</b> <b>Multi-Provider Email Fallback</b></li>
              <li><b style={{ color: '#10b981' }}>✓</b> <b>Puppeteer Headless PDF Generator</b></li>
              <li><b style={{ color: '#10b981' }}>✓</b> Dukungan Prioritas & Lencana Pro</li>
            </ul>

            <Link href="/register" className="btn-pricing-pro">
              ⚡ Langganan Pro Sekarang
            </Link>
            <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>
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
            <div key={idx} className={`faq-item ${openFaq === idx ? 'open' : ''}`}>
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
      <section className="landing-cta-banner">
        <div className="cta-banner-content">
          <h2 className="cta-heading">Siap Meningkatkan Profesionalitas Penagihan Anda?</h2>
          <p className="cta-sub">
            Bergabunglah dengan ribuan pemilik bisnis yang menghemat waktu penagihan dengan SnapBill.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 24 }}>
            <Link href="/register" className="btn-hero-primary">
              🚀 Mulai Akun Gratis Sekarang
            </Link>
            <Link href="/login" className="btn-hero-secondary">
              Masuk ke Akun
            </Link>
          </div>
        </div>
      </section>

      {/* ── 8. Footer ──────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-brand-col">
            <div className="landing-brand">
              <span className="brand-icon">⚡</span>
              <span className="brand-text">Snap<span>Bill</span></span>
            </div>
            <p className="footer-desc">
              Invoice Generator SaaS dengan integrasi pembayaran Midtrans, penyimpanan bukti MinIO S3, dan email otomatis.
            </p>
          </div>

          <div className="footer-links-col">
            <h4>Navigasi</h4>
            <a href="#fitur">Fitur</a>
            <a href="#cara-kerja">Cara Kerja</a>
            <a href="#harga">Harga</a>
            <a href="#faq">FAQ</a>
          </div>

          <div className="footer-links-col">
            <h4>Aplikasi</h4>
            <Link href="/login">Masuk</Link>
            <Link href="/register">Daftar Akun</Link>
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
