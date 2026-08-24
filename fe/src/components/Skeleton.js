'use client';

/**
 * Modern Skeleton Loading Components
 * Designed with liquid glassmorphism shimmer & pulse effects
 */

export function Skeleton({ className = '', style = {} }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 rounded-md ${className}`}
      style={{
        background: 'linear-gradient(90deg, rgba(226, 232, 240, 0.7) 0%, rgba(241, 245, 249, 0.9) 50%, rgba(226, 232, 240, 0.7) 100%)',
        backgroundSize: '200% 100%',
        animation: 'skeletonPulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}

/**
 * Metric Card Skeleton for Analytics Dashboard
 */
export function MetricCardSkeleton() {
  return (
    <div
      className="glass-card"
      style={{
        padding: '22px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton style={{ height: 16, width: '45%', borderRadius: 6 }} />
        <Skeleton style={{ height: 38, width: 38, borderRadius: 12 }} />
      </div>
      <Skeleton style={{ height: 32, width: '70%', borderRadius: 8, margin: '4px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
        <Skeleton style={{ height: 14, width: '50%', borderRadius: 6 }} />
        <Skeleton style={{ height: 14, width: '25%', borderRadius: 6 }} />
      </div>
    </div>
  );
}

/**
 * Top 5 Clients Leaderboard Card Skeleton
 */
export function TopClientsSkeleton() {
  return (
    <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Skeleton style={{ height: 20, width: '40%', borderRadius: 6 }} />
        <Skeleton style={{ height: 14, width: '20%', borderRadius: 6 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: 'rgba(248, 250, 252, 0.6)',
              borderRadius: 12,
              border: '1px solid rgba(226, 232, 240, 0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Skeleton style={{ width: 34, height: 34, borderRadius: '50%' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skeleton style={{ height: 14, width: 120, borderRadius: 4 }} />
                <Skeleton style={{ height: 11, width: 80, borderRadius: 4 }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <Skeleton style={{ height: 16, width: 90, borderRadius: 4 }} />
              <Skeleton style={{ height: 11, width: 50, borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Table Rows Skeleton
 */
export function TableSkeleton({ rows = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: '12px 16px',
            borderRadius: 10,
            background: 'rgba(248, 250, 252, 0.5)',
            borderBottom: '1px solid #f1f5f9',
          }}
        >
          <Skeleton style={{ height: 16, width: '15%', borderRadius: 4 }} />
          <Skeleton style={{ height: 16, width: '25%', borderRadius: 4 }} />
          <Skeleton style={{ height: 16, width: '15%', borderRadius: 4 }} />
          <Skeleton style={{ height: 16, width: '15%', borderRadius: 4 }} />
          <Skeleton style={{ height: 22, width: '12%', borderRadius: 20 }} />
          <Skeleton style={{ height: 28, width: '8%', borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}

/**
 * Public Invoice View Skeleton
 */
export function InvoiceViewSkeleton() {
  return (
    <div style={{ width: '100%', maxWidth: 1000, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header skeleton */}
      <div className="glass-card" style={{ padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Skeleton style={{ width: 50, height: 50, borderRadius: 12 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton style={{ width: 160, height: 20, borderRadius: 6 }} />
            <Skeleton style={{ width: 100, height: 13, borderRadius: 4 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Skeleton style={{ width: 110, height: 36, borderRadius: 10 }} />
          <Skeleton style={{ width: 90, height: 36, borderRadius: 10 }} />
        </div>
      </div>

      {/* Invoice Body skeleton */}
      <div className="glass-card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton style={{ width: 180, height: 28, borderRadius: 6 }} />
            <Skeleton style={{ width: 120, height: 14, borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <Skeleton style={{ width: 140, height: 24, borderRadius: 6 }} />
            <Skeleton style={{ width: 90, height: 14, borderRadius: 4 }} />
          </div>
        </div>

        <Skeleton style={{ width: '100%', height: 1, margin: '10px 0' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton style={{ width: 80, height: 13, borderRadius: 4 }} />
            <Skeleton style={{ width: 150, height: 18, borderRadius: 4 }} />
            <Skeleton style={{ width: 120, height: 13, borderRadius: 4 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton style={{ width: 80, height: 13, borderRadius: 4 }} />
            <Skeleton style={{ width: 130, height: 18, borderRadius: 4 }} />
            <Skeleton style={{ width: 110, height: 13, borderRadius: 4 }} />
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <TableSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
