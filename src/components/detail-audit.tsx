'use client';

import { useState } from 'react';

/**
 * Tombol "Data" pada baris audit log: membuka nilai lama dan nilai baru apa
 * adanya (JSON) di dalam panel, tanpa pindah halaman.
 *
 * Ditampilkan mentah karena bentuk `dataLama`/`dataBaru` berbeda-beda antar
 * aksi, dan yang dibutuhkan saat pemeriksaan adalah nilai aslinya — bukan
 * ringkasan yang sudah ditafsirkan.
 */
export function DetailAudit({
  aksi,
  label,
  waktu,
  dataLama,
  dataBaru,
}: {
  aksi: string;
  label: string;
  waktu: string;
  dataLama: unknown;
  dataBaru: unknown;
}) {
  const [buka, setBuka] = useState(false);

  const adaIsi = dataLama != null || dataBaru != null;
  if (!adaIsi) {
    return <span className="text-abu-300 text-xs">—</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="rounded-md border border-abu-300 bg-white px-3 py-1.5 text-xs font-medium text-abu-700 hover:bg-abu-50 transition-colors"
      >
        Data
      </button>

      {buka && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-abu-900/40 p-4 overflow-y-auto"
          onClick={() => setBuka(false)}
        >
          <div
            className="mt-10 w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-abu-900">{label}</h3>
                <p className="mt-0.5 text-xs text-abu-400">
                  {waktu} · <span className="tabular-nums">{aksi}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBuka(false)}
                className="rounded-md border border-abu-300 px-3 py-1.5 text-xs font-medium text-abu-700 hover:bg-abu-50"
              >
                Tutup
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="label-kolom">Nilai lama</div>
                {dataLama != null ? (
                  <pre className="mt-1.5 max-h-72 overflow-auto rounded-md bg-abu-50 p-3 text-[11px] leading-relaxed text-abu-700">
                    {JSON.stringify(dataLama, null, 2)}
                  </pre>
                ) : (
                  <p className="mt-1.5 text-xs text-abu-400">
                    Tidak ada — ini pencatatan pertama untuk entitas ini.
                  </p>
                )}
              </div>
              <div>
                <div className="label-kolom">Nilai baru</div>
                {dataBaru != null ? (
                  <pre className="mt-1.5 max-h-72 overflow-auto rounded-md bg-abu-50 p-3 text-[11px] leading-relaxed text-abu-700">
                    {JSON.stringify(dataBaru, null, 2)}
                  </pre>
                ) : (
                  <p className="mt-1.5 text-xs text-abu-400">Tidak ada.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
