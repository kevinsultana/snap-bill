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
      <div className="mt-5 flex justify-between items-center flex-wrap gap-3 border-t border-slate-200/70 pt-4">
        <span className="text-xs text-slate-500 font-medium">
          {lang === 'en'
            ? `Showing ${start}–${end} of ${total} items`
            : `Menampilkan ${start}–${end} dari ${total} data`}
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
      if (page > 3) pages.push('...');
      const startPage = Math.max(2, page - 1);
      const endPage = Math.min(totalPages - 1, page + 1);
      for (let i = startPage; i <= endPage; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className="mt-5 flex justify-between items-center flex-wrap gap-3 border-t border-slate-200/70 pt-4">
      <span className="text-xs text-slate-500 font-medium">
        {lang === 'en'
          ? `Showing ${start}–${end} of ${total} items`
          : `Menampilkan ${start}–${end} dari ${total} data`}
      </span>

      <div className="inline-flex items-center gap-1.5 flex-wrap">
        {/* Previous Button */}
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 ${
            page <= 1
              ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 cursor-pointer shadow-xs'
          }`}
          title={lang === 'en' ? 'Previous Page' : 'Halaman Sebelumnya'}
        >
          ‹ {lang === 'en' ? 'Prev' : 'Sebelumnya'}
        </button>

        {/* Page Number Buttons */}
        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span
                key={`dots-${idx}`}
                className="px-1.5 text-slate-400 text-xs font-bold select-none"
              >
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
              className={`min-w-[34px] h-[34px] px-2 text-xs rounded-lg border transition-all duration-150 font-semibold ${
                isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 font-extrabold shadow-md shadow-indigo-500/30 cursor-default'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 cursor-pointer'
              }`}
            >
              {p}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 ${
            page >= totalPages
              ? 'opacity-40 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 cursor-pointer shadow-xs'
          }`}
          title={lang === 'en' ? 'Next Page' : 'Halaman Selanjutnya'}
        >
          {lang === 'en' ? 'Next' : 'Selanjutnya'} ›
        </button>
      </div>
    </div>
  );
}
