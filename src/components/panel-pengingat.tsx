'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Pengingat, RingkasanPengingat } from '@/lib/sip/pengingat';

/**
 * Panel pengingat periode.
 *
 * Muncul di `/penilaian` (dan halaman lain yang butuh) hanya kalau `daftar`
 * tidak kosong — panel peringatan yang selalu tampil akan diabaikan.
 *
 * Warna mengikuti tingkat urgensinya: merah untuk yang terlambat/mendesak,
 * kuning untuk yang perlu diperhatikan, biru untuk informasi.
 */

const GAYA: Record<string, { kotak: string; ikon: string; judul: string }> = {
  terlambat: {
    kotak: 'border-bahaya/30 bg-bahaya-bg',
    ikon: 'text-bahaya',
    judul: 'text-bahaya',
  },
  segera: {
    kotak: 'border-peringatan/30 bg-peringatan-bg',
    ikon: 'text-peringatan',
    judul: 'text-peringatan',
  },
  menunggu: {
    kotak: 'border-peringatan/30 bg-peringatan-bg',
    ikon: 'text-peringatan',
    judul: 'text-peringatan',
  },
  'belum-dinilai': {
    kotak: 'border-btn-biru-200 bg-btn-biru-50',
    ikon: 'text-btn-biru-600',
    judul: 'text-btn-biru-700',
  },
  draft: {
    kotak: 'border-bahaya/30 bg-bahaya-bg',
    ikon: 'text-bahaya',
    judul: 'text-bahaya',
  },
};

export function PanelPengingat({ ringkasan }: { ringkasan: RingkasanPengingat }) {
  const [tertutup, setTertutup] = useState(false);

  if (ringkasan.daftar.length === 0 || tertutup) return null;

  return (
    <div className="mt-6 space-y-3">
      {ringkasan.daftar.map((d, i) => (
        <KartuPengingat key={`${d.jenis}-${i}`} data={d} onTutup={i === 0 ? () => setTertutup(true) : undefined} />
      ))}
    </div>
  );
}

function Ikon({ jenis, kelas }: { jenis: Pengingat['jenis']; kelas: string }) {
  if (jenis === 'belum-dinilai') {
    return (
      <svg className={`h-5 w-5 shrink-0 ${kelas}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  return (
    <svg className={`h-5 w-5 shrink-0 ${kelas}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function KartuPengingat({ data, onTutup }: { data: Pengingat; onTutup?: () => void }) {
  const gaya = GAYA[data.jenis] ?? GAYA['belum-dinilai'];

  return (
    <div className={`rounded-lg border px-4 py-3.5 flex items-start gap-3 ${gaya.kotak}`}>
      <Ikon jenis={data.jenis} kelas={gaya.ikon} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${gaya.judul}`}>{data.judul}</p>
        <p className="mt-0.5 text-xs text-abu-600">{data.keterangan}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {data.href && (
          <Link
            href={data.href}
            className="rounded-md border border-abu-300 bg-white px-3 py-1.5 text-xs font-medium text-abu-700 hover:bg-abu-50 transition-colors whitespace-nowrap"
          >
            Buka
          </Link>
        )}
        {onTutup && (
          <button
            type="button"
            onClick={onTutup}
            title="Sembunyikan pengingat ini untuk sesi ini"
            className="rounded-md px-2 py-1.5 text-xs text-abu-400 hover:text-abu-600"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
