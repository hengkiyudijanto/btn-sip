'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Pengingat } from '@/lib/sip/pengingat';

/**
 * Lonceng notifikasi di bilah atas.
 *
 * Isinya sama dengan panel pengingat di halaman (dihitung sekali di
 * `ambilPengingat`), jadi tidak mungkin berbeda hitungan. Tampil sebagai
 * dropdown supaya pengingat tetap terlihat dari halaman mana pun — halaman
 * yang tidak punya panel sendiri (dasbor, laporan) tetap bisa melihat tugas
 * yang belum selesai tanpa harus membuka /penilaian lebih dulu.
 *
 * Kalau tidak ada yang perlu ditindak, lonceng **tidak dirender sama sekali**
 * (bukan lonceng kosong) — supaya tidak jadi hiasan yang diabaikan.
 */

const WARNA: Record<string, string> = {
  terlambat: 'text-bahaya',
  draft: 'text-bahaya',
  segera: 'text-peringatan',
  menunggu: 'text-peringatan',
  'belum-dinilai': 'text-btn-biru-700',
};

export function LoncengNotifikasi({
  daftar,
  jumlah,
}: {
  daftar: Pengingat[];
  jumlah: number;
}) {
  const [buka, setBuka] = useState(false);

  if (daftar.length === 0 || jumlah === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        aria-label={`${jumlah} pengingat`}
        aria-expanded={buka}
        className="relative rounded-md border border-white/25 p-2 text-white/90 hover:bg-white/10 transition-colors"
        title={`${jumlah} hal perlu ditindak`}
      >
        <svg className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 2a6 6 0 00-6 6v2.586l-.707.707A1 1 0 004 13h12a1 1 0 00.707-1.707L16 10.586V8a6 6 0 00-6-6zM8 14a2 2 0 104 0H8z" />
        </svg>
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-btn-merah-500 px-1 text-[10px] font-bold text-white">
          {jumlah}
        </span>
      </button>

      {buka && (
        <>
          {/* klik di luar untuk menutup */}
          <div className="fixed inset-0 z-40" onClick={() => setBuka(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-lg border border-abu-200 bg-white py-2 shadow-xl">
            <div className="px-4 py-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-abu-700">
                Perlu ditindak ({jumlah})
              </span>
              <button
                type="button"
                onClick={() => setBuka(false)}
                className="text-xs text-abu-400 hover:text-abu-600"
              >
                tutup
              </button>
            </div>
            <div className="mt-1 divide-y divide-abu-100">
              {daftar.map((d, i) => {
                const isi = (
                  <>
                    <p className={`text-sm font-medium ${WARNA[d.jenis] ?? 'text-abu-800'}`}>
                      {d.judul}
                    </p>
                    <p className="mt-0.5 text-xs text-abu-500 leading-snug">{d.keterangan}</p>
                  </>
                );
                return d.href ? (
                  <Link
                    key={`${d.jenis}-${i}`}
                    href={d.href}
                    onClick={() => setBuka(false)}
                    className="block px-4 py-2.5 hover:bg-abu-50 transition-colors"
                  >
                    {isi}
                  </Link>
                ) : (
                  <div key={`${d.jenis}-${i}`} className="px-4 py-2.5">
                    {isi}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
