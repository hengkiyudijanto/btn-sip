'use client';

import { useState } from 'react';
import { simpanPengukuranIMT } from '@/app/actions/pegawai';

export function TombolPengukuranIMT({
  pegawaiId,
  periodeId,
  tanggal,
  beratBadan,
}: {
  pegawaiId: string;
  periodeId: string;
  tanggal: string;
  beratBadan: number | null;
}) {
  const [buka, setBuka] = useState(false);

  if (!buka) {
    return (
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="rounded-md border border-btn-biru-200 bg-btn-biru-50 px-2.5 py-1 text-xs font-medium text-btn-biru-700 hover:bg-btn-biru-100"
      >
        {beratBadan ? 'Ubah' : 'Isi IMT'}
      </button>
    );
  }

  return (
    <form action={simpanPengukuranIMT} className="flex items-center gap-1">
      <input type="hidden" name="pegawaiId" value={pegawaiId} />
      <input type="hidden" name="periodeId" value={periodeId} />
      <input type="hidden" name="tanggal" value={tanggal} />
      <input
        name="beratBadan"
        type="number"
        min="1"
        step="0.1"
        required
        autoFocus
        defaultValue={beratBadan ?? ''}
        placeholder="kg"
        className="w-20 rounded border border-abu-300 px-2 py-1 text-xs"
      />
      <button type="submit" className="rounded bg-btn-biru-600 px-2 py-1 text-xs text-white">
        Simpan
      </button>
      <button
        type="button"
        onClick={() => setBuka(false)}
        className="rounded border border-abu-300 px-2 py-1 text-xs text-abu-600"
      >
        Batal
      </button>
    </form>
  );
}
