'use client';

import { useActionState, useState } from 'react';
import { simpanPengukuranIMT } from '@/app/actions/pegawai';
import { kompresFoto } from '@/lib/foto';

export function TombolPengukuranIMT({ pegawaiId, periodeId, tanggal, beratBadan, tinggiBadan, lingkarPinggang }: { pegawaiId: string; periodeId: string; tanggal: string; beratBadan: number | null; tinggiBadan: number | null; lingkarPinggang: number | null }) {
  const [buka, setBuka] = useState(false);
  const [fotoBadan, setFotoBadan] = useState('');
  const [fotoTimbangan, setFotoTimbangan] = useState('');
  const [namaFotoBadan, setNamaFotoBadan] = useState('');
  const [namaFotoTimbangan, setNamaFotoTimbangan] = useState('');
  const [berat, setBerat] = useState(beratBadan?.toString() ?? '');
  const [state, aksi] = useActionState(async (_sebelumnya: { error?: string; sukses?: boolean } | undefined, formData: FormData) => {
    try {
      await simpanPengukuranIMT(formData);
      return { sukses: true };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Data IMT gagal disimpan.' };
    }
  }, undefined);
  const imt = berat && tinggiBadan ? Math.round((Number(berat) / ((tinggiBadan / 100) ** 2)) * 10) / 10 : null;
  const prosesFoto = async (file: File, setFoto: (v: string) => void) => {
    const hasil = await kompresFoto(file, { lebar: 800, tinggi: 800, kualitas: 0.8 });
    setFoto(hasil.dataUrl);
  };

  if (!buka) return <button type="button" onClick={() => setBuka(true)} className="rounded-md border border-btn-biru-200 bg-btn-biru-50 px-2.5 py-1 text-xs font-medium text-btn-biru-700 hover:bg-btn-biru-100">Input Data</button>;

  return <div className="min-w-[280px] rounded-lg border border-abu-200 bg-abu-50 p-3 text-left">
    <form action={aksi} className="space-y-2">
      <input type="hidden" name="pegawaiId" value={pegawaiId} /><input type="hidden" name="periodeId" value={periodeId} /><input type="hidden" name="tanggal" value={tanggal} />
      <input type="hidden" name="fotoSeluruhBadanData" value={fotoBadan} /><input type="hidden" name="fotoTimbanganData" value={fotoTimbangan} />
      <label className="block text-[11px] text-abu-600">Foto seluruh badan<input type="file" accept="image/*" required onChange={(e) => { const f = e.target.files?.[0]; if (f) { setNamaFotoBadan(f.name); void prosesFoto(f, setFotoBadan); } }} className="sr-only" id={`foto-badan-${pegawaiId}`} /><span className="mt-1 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-btn-biru-300 bg-btn-biru-50 px-3 py-2 text-xs font-medium text-btn-biru-700 hover:bg-btn-biru-100">📷 {namaFotoBadan ? 'Ganti foto seluruh badan' : 'Upload foto seluruh badan'}</span>{namaFotoBadan && <span className="mt-1 block truncate text-[10px] text-sukses">✓ {namaFotoBadan}</span>}</label>
      <label className="block text-[11px] text-abu-600">Berat badan (kg)<input name="beratBadan" type="number" min="1" step="0.1" required value={berat} onChange={(e) => setBerat(e.target.value)} className="mt-1 w-full rounded border border-abu-300 px-2 py-1.5 text-xs" /></label>
      <label className="block text-[11px] text-abu-600">Foto alat timbang<input type="file" accept="image/*" required onChange={(e) => { const f = e.target.files?.[0]; if (f) { setNamaFotoTimbangan(f.name); void prosesFoto(f, setFotoTimbangan); } }} className="sr-only" id={`foto-timbangan-${pegawaiId}`} /><span className="mt-1 flex cursor-pointer items-center justify-center rounded-md border border-dashed border-btn-biru-300 bg-btn-biru-50 px-3 py-2 text-xs font-medium text-btn-biru-700 hover:bg-btn-biru-100">⚖️ {namaFotoTimbangan ? 'Ganti foto alat timbang' : 'Upload foto alat timbang'}</span>{namaFotoTimbangan && <span className="mt-1 block truncate text-[10px] text-sukses">✓ {namaFotoTimbangan}</span>}</label>
      <label className="block text-[11px] text-abu-600">Lingkar pinggang (cm)<input name="lingkarPinggang" type="number" min="1" step="0.1" required defaultValue={lingkarPinggang ?? ''} className="mt-1 w-full rounded border border-abu-300 px-2 py-1.5 text-xs" /></label>
      <div className="rounded bg-white px-2 py-1.5 text-xs text-abu-700">Tinggi: <strong>{tinggiBadan ?? '—'} cm</strong> · IMT otomatis: <strong>{imt ?? '—'}</strong></div>
      <div className="flex gap-1.5"><button type="submit" disabled={!fotoBadan || !fotoTimbangan || !imt} className="rounded bg-btn-biru-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Simpan</button><button type="button" onClick={() => setBuka(false)} className="rounded border border-abu-300 px-3 py-1.5 text-xs text-abu-600">Batal</button></div>
      {state?.error && <p className="rounded bg-bahaya-bg px-2 py-1.5 text-[11px] text-bahaya">{state.error}</p>}
      {state?.sukses && <p className="rounded bg-sukses-bg px-2 py-1.5 text-[11px] text-sukses">Data IMT berhasil disimpan.</p>}
    </form>
  </div>;
}
