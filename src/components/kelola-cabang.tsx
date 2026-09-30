'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  tambahCabang,
  ubahCabang,
  hapusCabang,
  ubahStatusCabang,
  type HasilCabang,
} from '@/app/actions/cabang';

function Tombol({
  children,
  variasi = 'utama',
  kecil,
}: {
  children: React.ReactNode;
  variasi?: 'utama' | 'sekunder' | 'bahaya';
  kecil?: boolean;
}) {
  const { pending } = useFormStatus();
  const warna =
    variasi === 'utama'
      ? 'bg-btn-biru-600 text-white hover:bg-btn-biru-700'
      : variasi === 'bahaya'
        ? 'border border-btn-merah-300 bg-white text-btn-merah-700 hover:bg-btn-merah-100'
        : 'border border-abu-300 bg-white text-abu-700 hover:bg-abu-50';

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${
        kecil ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-sm'
      } ${warna}`}
    >
      {pending && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

function Pesan({ state }: { state: HasilCabang }) {
  if (state.error)
    return <p className="mt-2 text-xs text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5">{state.error}</p>;
  if (state.sukses)
    return <p className="mt-2 text-xs text-sukses bg-sukses-bg rounded px-2.5 py-1.5">{state.pesan}</p>;
  return null;
}

const kelasInput =
  'w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none';

/** Form tambah cabang. */
export function FormTambahCabang() {
  const [state, aksi] = useActionState(tambahCabang, {});
  const [buka, setBuka] = useState(false);

  if (!buka) {
    return (
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="rounded-lg bg-btn-biru-600 px-4 py-2 text-sm font-semibold text-white hover:bg-btn-biru-700 transition-colors"
      >
        + Tambah Cabang
      </button>
    );
  }

  return (
    <div className="kartu p-6">
      <h3 className="text-sm font-semibold text-abu-800 mb-4">Tambah cabang baru</h3>
      <form action={aksi} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-abu-600 mb-1.5">
            Kode cabang
          </label>
          <input
            name="kode"
            required
            placeholder="mis. 0002"
            className={`${kelasInput} uppercase`}
          />
          <p className="mt-1 text-[11px] text-abu-400">
            Kode unik, dipakai di laporan. Huruf/angka, mis. 0002 atau JKT-01
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-abu-600 mb-1.5">
            Nama cabang
          </label>
          <input name="nama" required placeholder="mis. KC Jakarta Pusat" className={kelasInput} />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-abu-600 mb-1.5">
            Alamat (opsional)
          </label>
          <input name="alamat" placeholder="Alamat kantor cabang" className={kelasInput} />
        </div>

        <div className="sm:col-span-2 flex items-center gap-3">
          <Tombol>Simpan</Tombol>
          <button
            type="button"
            onClick={() => setBuka(false)}
            className="rounded-lg border border-abu-300 px-4 py-2 text-sm text-abu-600 hover:bg-abu-50 transition-colors"
          >
            Batal
          </button>
        </div>

        <div className="sm:col-span-2">
          <Pesan state={state} />
        </div>
      </form>
    </div>
  );
}

/** Aksi per baris cabang: ubah nama, aktif/nonaktif, hapus. */
export function AksiCabang({
  id,
  kode,
  nama,
  alamat,
  aktif,
  jumlahPegawai,
}: {
  id: string;
  kode: string;
  nama: string;
  alamat: string | null;
  aktif: boolean;
  jumlahPegawai: number;
}) {
  const [mode, setMode] = useState<'diam' | 'ubah' | 'hapus'>('diam');
  const [stateUbah, aksiUbah] = useActionState(ubahCabang, {});
  const [stateHapus, aksiHapus] = useActionState(hapusCabang, {});
  const [stateStatus, aksiStatus] = useActionState(ubahStatusCabang, {});

  if (mode === 'ubah') {
    return (
      <form action={aksiUbah} className="min-w-[280px]">
        <input type="hidden" name="id" value={id} />
        <div className="space-y-2">
          <input
            name="nama"
            defaultValue={nama}
            required
            className="w-full rounded-lg border border-abu-300 px-2.5 py-1.5 text-xs focus:border-btn-biru-500 focus:outline-none"
            placeholder="Nama cabang"
          />
          <input
            name="alamat"
            defaultValue={alamat ?? ''}
            className="w-full rounded-lg border border-abu-300 px-2.5 py-1.5 text-xs focus:border-btn-biru-500 focus:outline-none"
            placeholder="Alamat (opsional)"
          />
          <div className="flex gap-1.5">
            <Tombol kecil>Simpan</Tombol>
            <button
              type="button"
              onClick={() => setMode('diam')}
              className="rounded-lg border border-abu-300 px-3 py-1.5 text-[11px] text-abu-600 hover:bg-abu-50"
            >
              Batal
            </button>
          </div>
        </div>
        <Pesan state={stateUbah} />
      </form>
    );
  }

  if (mode === 'hapus') {
    return (
      <form action={aksiHapus} className="min-w-[240px]">
        <input type="hidden" name="id" value={id} />
        <p className="text-[11px] text-abu-600 leading-relaxed">
          Hapus cabang <strong>{kode}</strong> secara permanen?
          {jumlahPegawai > 0 && (
            <span className="block mt-1 text-peringatan">
              Masih ada {jumlahPegawai} pegawai terhubung — hapus akan ditolak.
            </span>
          )}
        </p>
        <div className="flex gap-1.5 mt-2">
          <Tombol kecil variasi="bahaya">
            Ya, hapus
          </Tombol>
          <button
            type="button"
            onClick={() => setMode('diam')}
            className="rounded-lg border border-abu-300 px-3 py-1.5 text-[11px] text-abu-600 hover:bg-abu-50"
          >
            Batal
          </button>
        </div>
        <Pesan state={stateHapus} />
      </form>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMode('ubah')}
          className="rounded-md border border-abu-200 px-2.5 py-1 text-[11px] font-medium text-abu-600 hover:bg-abu-50 transition-colors whitespace-nowrap"
        >
          Ubah
        </button>
        <form action={aksiStatus}>
          <input type="hidden" name="id" value={id} />
          <Tombol kecil variasi="sekunder">{aktif ? 'Nonaktifkan' : 'Aktifkan'}</Tombol>
        </form>
        <button
          type="button"
          onClick={() => setMode('hapus')}
          className="rounded-md border border-btn-merah-300 bg-white px-2.5 py-1 text-[11px] font-medium text-btn-merah-700 hover:bg-btn-merah-100 transition-colors whitespace-nowrap"
        >
          Hapus
        </button>
      </div>
      {stateStatus.pesan && (
        <p className="text-[11px] text-abu-600 bg-abu-100 rounded px-2 py-1">{stateStatus.pesan}</p>
      )}
      {stateStatus.error && (
        <p className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2 py-1">{stateStatus.error}</p>
      )}
    </div>
  );
}
