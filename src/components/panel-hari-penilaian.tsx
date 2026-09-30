'use client';

import { useActionState } from 'react';
import { useKirimForm } from '@/components/use-kirim-form';
import { ubahHariPenilaianAksi, type HasilPengaturan } from '@/app/actions/pengaturan';

const HARI = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
];

function TombolSimpan() {
  const { sibuk: pending, tandaiKirim } = useKirimForm();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={tandaiKirim}
      className="rounded-lg bg-btn-biru-600 px-4 py-2 text-xs font-semibold text-white hover:bg-btn-biru-700 disabled:opacity-60 transition-colors"
    >
      {pending ? 'Menyimpan...' : 'Simpan'}
    </button>
  );
}

/**
 * Panel pengaturan hari penilaian.
 * Hari ini dipakai mesin periode untuk menentukan panjang periode pertama.
 */
export function PanelHariPenilaian({
  hariPenilaian,
  jumlahPeriode,
}: {
  hariPenilaian: number;
  jumlahPeriode: number;
}) {
  const [state, aksi] = useActionState(ubahHariPenilaianAksi, {} as HasilPengaturan);

  return (
    <div className="kartu p-5">
      <h3 className="text-sm font-semibold text-abu-800 mb-1">Hari penilaian</h3>
      <p className="text-xs text-abu-500 mb-4 leading-relaxed">
        Hari kapan atasan mengisi penilaian. Ini <strong>bukan</strong> batas
        periode — periode tetap mulai tanggal 1 dan berakhir hari Minggu. Hari
        ini hanya menentukan panjang periode pertama tiap bulan.
      </p>

      <form action={aksi} className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="hariPenilaian" className="block text-xs text-abu-500 mb-1">
            Setiap hari
          </label>
          <select
            id="hariPenilaian"
            name="hariPenilaian"
            defaultValue={hariPenilaian}
            className="rounded-lg border border-abu-300 bg-white px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
          >
            {HARI.map((h, i) => (
              <option key={h} value={i}>
                {h}
              </option>
            ))}
          </select>
        </div>
        <TombolSimpan />
        <span className="text-[11px] text-abu-400">
          {jumlahPeriode} periode sepanjang tahun ini
        </span>
      </form>

      {state.error && (
        <p className="mt-3 text-[11px] text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5">
          {state.error}
        </p>
      )}
      {state.sukses && (
        <div className="mt-3 text-[11px] text-sukses bg-sukses-bg rounded px-2.5 py-1.5 leading-relaxed">
          {state.pesan}
          {state.periodeDibuat !== undefined && state.periodeDibuat > 0 && (
            <span className="block mt-1">
              {state.periodeDibuat} periode baru dibuat untuk bulan-bulan yang
              belum ada.
            </span>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] text-abu-400 leading-relaxed">
        <strong>Perhatian:</strong> mengubah hari penilaian mempengaruhi
        perhitungan periode <em>berikutnya</em>. Periode yang sudah terlanjur
        dibuat tidak ikut diubah, supaya penilaian dan laporan yang sudah jadi
        tidak rusak.
      </p>
    </div>
  );
}
