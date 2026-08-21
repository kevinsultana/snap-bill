export default function DashboardPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-desc">Selamat datang di SnapBill! Ringkasan aktivitas Anda akan tampil di sini.</p>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Total Invoice', value: '—', icon: '🧾', color: 'var(--indigo)' },
          { label: 'Invoice Lunas', value: '—', icon: '✅', color: 'var(--emerald)' },
          { label: 'Menunggu Pembayaran', value: '—', icon: '⏳', color: 'var(--amber)' },
          { label: 'Total Klien', value: '—', icon: '👥', color: 'var(--purple)' },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="stat-icon" style={{ background: stat.color + '20', color: stat.color }}>
              {stat.icon}
            </div>
            <div>
              <p className="stat-label">{stat.label}</p>
              <p className="stat-value">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="placeholder-card">
        <p>📈 Grafik & tabel invoice akan ditambahkan pada fase berikutnya.</p>
      </div>
    </div>
  );
}
