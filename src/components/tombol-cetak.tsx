'use client';

export function TombolCetak({ label = 'Cetak / Simpan PDF' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="tanpa-cetak inline-flex items-center gap-2 rounded-lg bg-btn-biru-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-btn-biru-700 transition-colors shadow-sm"
    >
      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M5 2.75C5 1.784 5.784 1 6.75 1h6.5c.966 0 1.75.784 1.75 1.75v3.552c.377.046.752.097 1.126.153A2.212 2.212 0 0118 8.653v4.097A2.25 2.25 0 0115.75 15h-.241l.305 1.984A1.75 1.75 0 0114.084 19H5.915a1.75 1.75 0 01-1.73-2.016L4.492 15H4.25A2.25 2.25 0 012 12.75V8.653c0-1.082.775-2.034 1.874-2.198.374-.056.749-.107 1.126-.153V2.75zm7.75 0v3.302c-.7-.03-1.402-.047-2.104-.052H9.354c-.702.005-1.404.022-2.104.052V2.75a.25.25 0 01.25-.25h5a.25.25 0 01.25.25zM5.492 16.5l-.289 1.878a.25.25 0 00.247.288h8.1a.25.25 0 00.247-.288L13.508 16.5H5.492z"
          clipRule="evenodd"
        />
      </svg>
      {label}
    </button>
  );
}
