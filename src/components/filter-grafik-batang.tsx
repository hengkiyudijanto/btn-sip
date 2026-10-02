'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import type { OpsiJabatan, OpsiUnit } from '@/lib/sip/grafik-batang-data';

/**
 * Filter grafik batang: periode, kantor (berjenjang dengan indentasi), dan
 * jabatan. Pilihan disimpan di URL (`?periode=…&unit=…&jabatan=…`) supaya
 * bisa dibagikan dan tidak hilang saat halaman dimuat ulang.
 *
 * Perubahan langsung mengirim permintaan baru (`router.push`) tanpa tombol
 * "Terapkan" — filter grafik harus terasa seperti menyaring, bukan mengisi
 * formulir.
 */

type PeriodePilihan = { id: string; nama: string };

const LABEL_JENIS: Record<string, string> = {
  KANWIL: 'Kanwil',
  KC: 'KC',
  KCP: 'KCP',
};

export function FilterGrafikBatang({
  opsiPeriode,
  periodeTerpilih,
  opsiUnit,
  unitTerpilih,
  opsiJabatan,
  jabatanTerpilih,
  bolehPilihUnit,
}: {
  opsiPeriode: PeriodePilihan[];
  periodeTerpilih: string;
  opsiUnit: OpsiUnit[];
  unitTerpilih: string;
  opsiJabatan: OpsiJabatan[];
  jabatanTerpilih: string;
  bolehPilihUnit: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [tertunda, mulai] = useTransition();

  function terapkan(ubah: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(ubah)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    mulai(() => router.push(`/dasbor?${p.toString()}`));
  }

  return (
    <div className="kartu p-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="block min-w-[200px] flex-1">
          <span className="label-kolom">Periode</span>
          <select
            value={periodeTerpilih}
            onChange={(e) => terapkan({ periode: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-abu-300 bg-white px-3 py-2 text-sm text-abu-800"
          >
            {opsiPeriode.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-[220px] flex-1">
          <span className="label-kolom">Kantor</span>
          <select
            value={unitTerpilih}
            disabled={!bolehPilihUnit}
            onChange={(e) => terapkan({ unit: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-abu-300 bg-white px-3 py-2 text-sm text-abu-800 disabled:bg-abu-50 disabled:text-abu-500"
          >
            {bolehPilihUnit && <option value="">Semua unit</option>}
            {opsiUnit.map((u) => (
              <option key={u.kode} value={u.kode}>
                {'\u00a0'.repeat(u.tingkat * 4)}
                {u.kode} — {u.nama} ({LABEL_JENIS[u.jenis] ?? u.jenis}, {u.jumlahPegawai} org)
              </option>
            ))}
          </select>
          {bolehPilihUnit && (
            <span className="mt-1 block text-[10px] text-abu-400">
              Memilih satu unit otomatis mencakup seluruh kantor di bawahnya.
            </span>
          )}
        </label>

        <label className="block min-w-[180px] flex-1">
          <span className="label-kolom">Jabatan</span>
          <select
            value={jabatanTerpilih}
            onChange={(e) => terapkan({ jabatan: e.target.value })}
            className="mt-1.5 w-full rounded-md border border-abu-300 bg-white px-3 py-2 text-sm text-abu-800"
          >
            <option value="">Semua jabatan</option>
            {opsiJabatan.map((j) => (
              <option key={j.kode} value={j.kode}>
                {j.nama} ({j.jumlahPegawai} org)
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] text-abu-400">
            Menyaring daftar petugas, tidak menyembunyikan unit & jabatan lain.
          </span>
        </label>

        <div className="pb-1">
          {tertunda ? (
            <span className="inline-flex items-center gap-2 text-xs text-abu-500">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Memuat…
            </span>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/dasbor')}
              className="rounded-md border border-abu-300 px-3 py-2 text-xs font-medium text-abu-700 hover:bg-abu-50 transition-colors"
            >
              Atur ulang
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
