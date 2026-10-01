'use client';

import { useActionState, useState } from 'react';
import {
  tambahJabatan,
  ubahJabatan,
  ubahStatusJabatan,
  hapusJabatan,
  type HasilJabatan,
} from '@/app/actions/jabatan';

const AWAL: HasilJabatan = {};

type Jabatan = {
  id: string;
  kode: string;
  nama: string;
  namaEn: string | null;
  aktif: boolean;
  jumlahPegawai: number;
};

/** Form tambah jabatan. */
export function FormTambahJabatan() {
  const [hasil, kirim, sedang] = useActionState(tambahJabatan, AWAL);

  return (
    <form action={kirim} className="kartu p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-abu-900">Tambah jabatan</h2>
      <p className="mt-1 text-xs text-abu-500">
        Kode dipakai di sistem (huruf besar, tidak bisa diubah setelah dibuat).
        Nama yang tampil bisa diubah kapan saja.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-abu-700">Kode</span>
          <input
            name="kode"
            required
            placeholder="MISAL_PB_TELLER"
            className="mt-1 w-full rounded-md border border-abu-300 px-3 py-2 text-sm uppercase"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-abu-700">Nama (Indonesia)</span>
          <input
            name="nama"
            required
            placeholder="Priority Banking Teller"
            className="mt-1 w-full rounded-md border border-abu-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-abu-700">
            Nama (Inggris) <span className="text-abu-400">opsional</span>
          </span>
          <input
            name="namaEn"
            placeholder="Priority Banking Teller"
            className="mt-1 w-full rounded-md border border-abu-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {hasil.error && (
        <p className="mt-3 rounded-md bg-merah-50 px-3 py-2 text-xs text-merah-700">
          {hasil.error}
        </p>
      )}
      {hasil.sukses && (
        <p className="mt-3 rounded-md bg-hijau-50 px-3 py-2 text-xs text-hijau-700">
          {hasil.pesan}
        </p>
      )}

      <button
        type="submit"
        disabled={sedang}
        className="mt-4 rounded-md bg-btn-biru-700 px-4 py-2 text-sm font-medium text-white hover:bg-btn-biru-800 disabled:opacity-50"
      >
        {sedang ? 'Menyimpan...' : 'Tambah jabatan'}
      </button>
    </form>
  );
}

/** Satu baris jabatan: bisa diubah namanya, diaktifkan, atau dihapus. */
function BarisJabatan({ jabatan }: { jabatan: Jabatan }) {
  const [modeUbah, setModeUbah] = useState(false);
  const [hasilUbah, kirimUbah, sedangUbah] = useActionState(ubahJabatan, AWAL);
  const [hasilStatus, kirimStatus, sedangStatus] = useActionState(
    ubahStatusJabatan,
    AWAL
  );
  const [hasilHapus, kirimHapus, sedangHapus] = useActionState(hapusJabatan, AWAL);

  const pesan = hasilUbah.error ?? hasilUbah.pesan ?? hasilStatus.error ??
    hasilStatus.pesan ?? hasilHapus.error ?? hasilHapus.pesan;
  const galat = Boolean(hasilUbah.error ?? hasilStatus.error ?? hasilHapus.error);

  return (
    <tr>
      <td className="text-xs font-medium tabular-nums text-abu-700">
        {jabatan.kode}
      </td>
      <td>
        {modeUbah ? (
          <form
            action={kirimUbah}
            className="flex flex-wrap items-center gap-2"
            onSubmit={() => setModeUbah(false)}
          >
            <input type="hidden" name="id" value={jabatan.id} />
            <input
              name="nama"
              defaultValue={jabatan.nama}
              required
              className="w-44 rounded-md border border-abu-300 px-2 py-1 text-sm"
            />
            <input
              name="namaEn"
              defaultValue={jabatan.namaEn ?? ''}
              placeholder="Nama Inggris"
              className="w-40 rounded-md border border-abu-300 px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={sedangUbah}
              className="rounded-md bg-btn-biru-700 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              {sedangUbah ? '...' : 'Simpan'}
            </button>
            <button
              type="button"
              onClick={() => setModeUbah(false)}
              className="rounded-md border border-abu-300 px-3 py-1 text-xs text-abu-700"
            >
              Batal
            </button>
          </form>
        ) : (
          <div>
            <div className="text-sm font-medium text-abu-900">{jabatan.nama}</div>
            {jabatan.namaEn && (
              <div className="text-xs text-abu-400">{jabatan.namaEn}</div>
            )}
          </div>
        )}
      </td>
      <td className="text-right text-xs tabular-nums text-abu-600">
        {jabatan.jumlahPegawai}
      </td>
      <td>
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
            jabatan.aktif
              ? 'bg-hijau-50 text-hijau-700'
              : 'bg-abu-100 text-abu-600'
          }`}
        >
          {jabatan.aktif ? 'Aktif' : 'Nonaktif'}
        </span>
      </td>
      <td>
        <div className="flex flex-wrap justify-end gap-1.5">
          {!modeUbah && (
            <button
              type="button"
              onClick={() => setModeUbah(true)}
              className="rounded-md border border-abu-300 px-2.5 py-1 text-xs text-abu-700 hover:bg-abu-50"
            >
              Ubah
            </button>
          )}

          <form action={kirimStatus}>
            <input type="hidden" name="id" value={jabatan.id} />
            <input
              type="hidden"
              name="aktif"
              value={jabatan.aktif ? 'false' : 'true'}
            />
            <button
              type="submit"
              disabled={sedangStatus}
              className="rounded-md border border-abu-300 px-2.5 py-1 text-xs text-abu-700 hover:bg-abu-50 disabled:opacity-50"
            >
              {jabatan.aktif ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </form>

          <form action={kirimHapus}>
            <input type="hidden" name="id" value={jabatan.id} />
            <button
              type="submit"
              disabled={sedangHapus || jabatan.jumlahPegawai > 0}
              title={
                jabatan.jumlahPegawai > 0
                  ? 'Masih dipakai pegawai — nonaktifkan saja'
                  : 'Hapus jabatan ini'
              }
              className="rounded-md border border-merah-300 px-2.5 py-1 text-xs text-merah-700 hover:bg-merah-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Hapus
            </button>
          </form>
        </div>

        {pesan && (
          <p
            className={`mt-2 text-right text-[11px] ${
              galat ? 'text-merah-700' : 'text-hijau-700'
            }`}
          >
            {pesan}
          </p>
        )}
      </td>
    </tr>
  );
}

/** Tabel jabatan. */
export function TabelJabatan({ daftar }: { daftar: Jabatan[] }) {
  return (
    <div className="kartu mt-6 overflow-hidden">
      <div className="border-b border-abu-200 bg-abu-50 px-4 py-3">
        <div className="text-sm font-semibold text-abu-900">Daftar jabatan</div>
        <div className="text-xs text-abu-500">
          Kolom &ldquo;dipakai&rdquo; menunjukkan berapa pegawai memakai jabatan ini.
          Jabatan yang masih dipakai tidak bisa dihapus — nonaktifkan saja supaya
          tidak muncul di pilihan pegawai baru.
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="tabel-sip tabel-lebar-tetap">
          <colgroup>
            <col style={{ width: '18%' }} />
            <col style={{ width: '32%' }} />
            <col style={{ width: '12%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '25%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama</th>
              <th className="text-right">Dipakai</th>
              <th>Status</th>
              <th className="text-right">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((j) => (
              <BarisJabatan key={j.id} jabatan={j} />
            ))}
            {daftar.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-abu-400">
                  Belum ada jabatan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
