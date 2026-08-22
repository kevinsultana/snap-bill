'use client';

export default function Pagination({
  page = 1,
  totalPages = 1,
  total = 0,
  limit = 10,
  onPageChange,
  lang = 'id',
}) {
  if (total === 0 || totalPages <= 1) {
    if (total === 0) return null;
    const start = 1;
    const end = total;
    return (
      <div className="pagination-wrap" style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderTop: '1px solid rgba(226, 232, 240, 0.7)', paddingTop: 16 }}>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {lang === 'en' ? `Showing ${start}–${end} of ${total} items` : `Menampilkan ${start}–${end} dari ${total} data`}
        </span>
      </div>
    );
  }

  const start = Math.min((page - 1) * limit + 1, total);
  const end = Math.min(page * limit, total);

  // Generate page numbers array with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) {
        pages.push('...');
      }
      const startPage = Math.max(2, page - 1);
      const endPage = Math.min(totalPages - 1, page + 1);

      for (let i = startPage; i <= endPage; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push('...');
      }
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div
      className="pagination-wrap"
      style={{
        marginTop: 20,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        borderTop: '1px solid rgba(226, 232, 240, 0.7)',
        paddingTop: 16,
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {lang === 'en'
          ? `Showing ${start}–${end} of ${total} items`
          : `Menampilkan ${start}–${end} dari ${total} data`}
      </span>

      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Tombol Sebelumnya */}
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="btn-secondary"
          style={{
            padding: '6px 12px',
            fontSize: 12,
            opacity: page <= 1 ? 0.45 : 1,
            cursor: page <= 1 ? 'not-allowed' : 'pointer',
            borderRadius: 8,
          }}
          title={lang === 'en' ? 'Previous Page' : 'Halaman Sebelumnya'}
        >
          ‹ {lang === 'en' ? 'Prev' : 'Sebelumnya'}
        </button>

        {/* Page Buttons */}
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} style={{ padding: '0 6px', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>
                •••
              </span>
            );
          }
          const isActive = p === page;
          return (
            <button
              key={`page-${p}`}
              type="button"
              onClick={() => onPageChange(p)}
              className={isActive ? 'btn-primary' : 'btn-secondary'}
              style={{
                minWidth: 34,
                height: 34,
                padding: '0 8px',
                fontSize: 12.5,
                fontWeight: isActive ? 800 : 600,
                borderRadius: 8,
                boxShadow: isActive ? '0 2px 8px rgba(99, 102, 241, 0.3)' : 'none',
              }}
            >
              {p}
            </button>
          );
        })}

        {/* Tombol Selanjutnya */}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="btn-secondary"
          style={{
            padding: '6px 12px',
            fontSize: 12,
            opacity: page >= totalPages ? 0.45 : 1,
            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            borderRadius: 8,
          }}
          title={lang === 'en' ? 'Next Page' : 'Halaman Selanjutnya'}
        >
          {lang === 'en' ? 'Next' : 'Selanjutnya'} ›
        </button>
      </div>
    </div>
  );
}
