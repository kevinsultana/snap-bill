'use client';

/**
 * Modern Skeleton Loading Components
 * Inline Tailwind CSS utility classes — no custom global CSS
 */

// Base shimmer animation via inline style (keyframe defined in globals.css)
const SHIMMER_STYLE = {
  background:
    'linear-gradient(90deg, rgba(226,232,240,0.7) 0%, rgba(241,245,249,0.95) 50%, rgba(226,232,240,0.7) 100%)',
  backgroundSize: '200% 100%',
  animation: 'skeletonPulse 1.5s ease-in-out infinite',
};

export function Skeleton({ className = '', style = {} }) {
  return (
    <div
      className={`rounded-md ${className}`}
      style={{ ...SHIMMER_STYLE, ...style }}
    />
  );
}

/**
 * Metric Card Skeleton for Analytics Dashboard
 */
export function MetricCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white/80 backdrop-blur-xl border border-white/90 shadow-[0_10px_30px_-5px_rgba(99,102,241,0.06)] p-6 flex flex-col gap-3.5">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-[45%] rounded-md" />
        <Skeleton className="h-9 w-9 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-[70%] rounded-lg my-1" />
      <div className="flex justify-between items-center pt-1.5">
        <Skeleton className="h-3.5 w-[50%] rounded-md" />
        <Skeleton className="h-3.5 w-[25%] rounded-md" />
      </div>
    </div>
  );
}

/**
 * Top 5 Clients Leaderboard Card Skeleton
 */
export function TopClientsSkeleton() {
  return (
    <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/90 shadow-[0_10px_30px_-5px_rgba(99,102,241,0.06)] p-6 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-[40%] rounded-md" />
        <Skeleton className="h-3.5 w-[20%] rounded-md" />
      </div>
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50/60 rounded-xl border border-slate-200/60"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-3.5 rounded" style={{ width: 120 }} />
                <Skeleton className="h-3 rounded" style={{ width: 80 }} />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Skeleton className="h-4 rounded" style={{ width: 90 }} />
              <Skeleton className="h-3 rounded" style={{ width: 50 }} />
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
    <div className="flex flex-col gap-2.5 p-4">
      {Array.from({ length: rows }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-slate-50/50 border-b border-slate-100"
        >
          <Skeleton className="h-4 w-[15%] rounded" />
          <Skeleton className="h-4 w-[25%] rounded" />
          <Skeleton className="h-4 w-[15%] rounded" />
          <Skeleton className="h-4 w-[15%] rounded" />
          <Skeleton className="h-5 w-[12%] rounded-full" />
          <Skeleton className="h-7 w-[8%] rounded-lg" />
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
    <div className="w-full max-w-4xl mx-auto flex flex-col gap-5">
      {/* Header Skeleton */}
      <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/90 shadow-[0_10px_30px_-5px_rgba(99,102,241,0.06)] p-6 flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-3.5">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="rounded-md" style={{ width: 160, height: 20 }} />
            <Skeleton className="rounded" style={{ width: 100, height: 13 }} />
          </div>
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="rounded-xl" style={{ width: 110, height: 36 }} />
          <Skeleton className="rounded-xl" style={{ width: 90, height: 36 }} />
        </div>
      </div>

      {/* Invoice Body Skeleton */}
      <div className="rounded-3xl bg-white/80 backdrop-blur-xl border border-white/90 shadow-[0_10px_30px_-5px_rgba(99,102,241,0.06)] p-8 flex flex-col gap-6">
        <div className="flex justify-between flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="rounded-md" style={{ width: 180, height: 28 }} />
            <Skeleton className="rounded" style={{ width: 120, height: 14 }} />
          </div>
          <div className="flex flex-col items-end gap-2">
            <Skeleton className="rounded-md" style={{ width: 140, height: 24 }} />
            <Skeleton className="rounded" style={{ width: 90, height: 14 }} />
          </div>
        </div>

        <Skeleton className="w-full h-px my-2.5 rounded" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex flex-col gap-2">
            <Skeleton className="rounded" style={{ width: 80, height: 13 }} />
            <Skeleton className="rounded" style={{ width: 150, height: 18 }} />
            <Skeleton className="rounded" style={{ width: 120, height: 13 }} />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="rounded" style={{ width: 80, height: 13 }} />
            <Skeleton className="rounded" style={{ width: 130, height: 18 }} />
            <Skeleton className="rounded" style={{ width: 110, height: 13 }} />
          </div>
        </div>

        <div className="mt-4">
          <TableSkeleton rows={3} />
        </div>
      </div>
    </div>
  );
}

export default Skeleton;
