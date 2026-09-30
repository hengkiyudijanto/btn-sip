'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  ajukanPegawaiAksi,
  setujuiPengajuanAksi,
  tolakPengajuanAksi,
  batalkanPengajuanAksi,
} from '@/app/actions/pengajuan';
import type { HasilAjukan } from '@/lib/sip/pengajuan';
import { MIN_PANJANG_PASSWORD } from '@/lib/sip/pengajuan-konstanta';

function Tombol({
  label,
  variasi = 'utama',
  kecil,
}: {
  label: string;
  variasi?: 'utama' | 'sekunder' | 'bahaya';
  kecil?: boolean;
}) {
  const { pending } = useFormStatus();
  const warna =
    variasi === 'utama'
      ? 'bg-btn-biru-600 text-white hover:bg-btn-biru-700'
      : variasi === 'bahaya'
        ? 'bg-btn-merah-600 text-white hover:bg-btn-merah-700'
        : 'border border-abu-300 bg-white text-abu-700 hover:bg-abu-50';

  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-lg font-semibold transition-colors disabled:opacity-60 ${warna} ${
        kecil ? 'px-3 py-1.5 text-[11px]' : 'px-4 py-2 text-xs'
      }`}
    >
      {pending ? 'Memproses...' : label}
    </button>
  );
}

function Pesan({ state }: { state: HasilAjukan }) {
  if (state.error) {
    return (
      <p className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5 leading-relaxed">
        {state.error}
      </p>
    );
  }
  if (state.sukses) {
    return (
      <p className="text-[11px] text-sukses bg-sukses-bg rounded px-2.5 py-1.5 leading-relaxed">
        {state.pesan}
      </p>
    );
  }
  return null;
}

export type OpsiCabang = { id: string; kode: string; nama: string; jenis: string };

/** Formulir pengajuan pegawai baru (untuk supervisor) */
export function FormAjukanPegawai({
  daftarCabang,
  daftarJabatan,
}: {
  daftarCabang: OpsiCabang[];
  daftarJabatan: { id: string; nama: string }[];
}) {
  const [state, aksi] = useActionState(ajukanPegawaiAksi, {} as HasilAjukan);
  const [buka, setBuka] = useState(false);

  if (!buka) {
    return (
      <div className="mt-6 kartu p-5">
        <h3 className="text-sm font-semibold text-abu-800 mb-1">Ajukan pegawai baru</h3>
        <p className="text-xs text-abu-500 mb-3 leading-relaxed">
          Menemukan petugas yang belum terdaftar? Ajukan di sini. Admin akan
          memeriksa dan menyetujui sebelum pegawai aktif.
        </p>
        <button
          type="button"
          onClick={() => setBuka(true)}
          className="rounded-lg bg-btn-biru-600 px-4 py-2 text-xs font-semibold text-white hover:bg-btn-biru-700 transition-colors"
        >
          + Ajukan pegawai
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 kartu p-5 animasi-naik">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-abu-800">Ajukan pegawai baru</h3>
          <p className="text-xs text-abu-500 mt-1 leading-relaxed">
            Pengajuan akan diperiksa admin. Setelah disetujui, pegawai bisa
            login dengan NIP dan password yang Anda isi di sini.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBuka(false)}
          className="text-xs text-abu-400 hover:text-abu-600 shrink-0"
        >
          Tutup
        </button>
      </div>

      <form action={aksi} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-abu-500 mb-1">
              NIP <span className="text-btn-merah-500">*</span>
            </label>
            <input
              name="nip"
              required
              placeholder="mis. 20885"
              className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm tabular-nums focus:border-btn-biru-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-abu-500 mb-1">
              Nama lengkap <span className="text-btn-merah-500">*</span>
            </label>
            <input
              name="nama"
              required
              placeholder="mis. Andi Pratama"
              className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-abu-500 mb-1">Unit kerja <span className="text-btn-merah-500">*</span></label>
            <select
              name="cabangId"
              required
              className="w-full rounded-lg border border-abu-300 bg-white px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
            >
              {daftarCabang.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.kode} — {c.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-abu-500 mb-1">Jabatan</label>
            <select
              name="jabatanId"
              className="w-full rounded-lg border border-abu-300 bg-white px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
            >
              <option value="">— pilih jabatan —</option>
              {daftarJabatan.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nama}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-abu-500 mb-1">
              Password awal <span className="text-btn-merah-500">*</span>
            </label>
            <input
              name="password"
              type="text"
              required
              minLength={MIN_PANJANG_PASSWORD}
              placeholder={`minimal ${MIN_PANJANG_PASSWORD} karakter`}
              className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-abu-400">
              Beri tahu pegawai password ini. Ia wajib menggantinya saat login pertama.
            </p>
          </div>
          <div>
            <label className="block text-xs text-abu-500 mb-1">Email (opsional)</label>
            <input
              name="email"
              type="email"
              className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-abu-500 mb-1">Catatan untuk admin (opsional)</label>
          <input
            name="catatan"
            placeholder="mis. pegawai baru pindahan dari KC Makassar"
            className="w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
          />
        </div>

        <Pesan state={state} />

        <div className="flex gap-2">
          <Tombol label="Kirim pengajuan" />
          <button
            type="button"
            onClick={() => setBuka(false)}
            className="rounded-lg border border-abu-300 bg-white px-4 py-2 text-xs font-medium text-abu-700 hover:bg-abu-50 transition-colors"
          >
            Batal
          </button>
        </div>
      </form>
    </div>
  );
}

/** Tombol setujui/tolak untuk admin */
export function AksiPengajuan({ pengajuanId }: { pengajuanId: string }) {
  const [stateSetuju, aksiSetuju] = useActionState(setujuiPengajuanAksi, {} as HasilAjukan);
  const [stateTolak, aksiTolak] = useActionState(tolakPengajuanAksi, {} as HasilAjukan);
  const [modeTolak, setModeTolak] = useState(false);

  return (
    <div className="space-y-2">
      {!modeTolak ? (
        <div className="flex flex-wrap gap-2">
          <form action={aksiSetuju}>
            <input type="hidden" name="pengajuanId" value={pengajuanId} />
            <Tombol label="Setujui" kecil />
          </form>
          <button
            type="button"
            onClick={() => setModeTolak(true)}
            className="rounded-lg border border-btn-merah-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-btn-merah-700 hover:bg-btn-merah-50 transition-colors"
          >
            Tolak
          </button>
        </div>
      ) : (
        <form action={aksiTolak} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="pengajuanId" value={pengajuanId} />
          <input
            name="alasan"
            required
            minLength={5}
            placeholder="alasan penolakan (wajib)"
            className="rounded-lg border border-abu-300 px-2.5 py-1.5 text-[11px] min-w-[180px] focus:border-btn-merah-400 focus:outline-none"
          />
          <Tombol label="Kirim penolakan" variasi="bahaya" kecil />
          <button
            type="button"
            onClick={() => setModeTolak(false)}
            className="text-[11px] text-abu-400 hover:text-abu-600"
          >
            Batal
          </button>
        </form>
      )}
      <Pesan state={stateSetuju} />
      <Pesan state={stateTolak} />
    </div>
  );
}

/** Tombol batalkan untuk supervisor (pengajuan sendiri) */
export function AksiBatalkan({ pengajuanId }: { pengajuanId: string }) {
  const [state, aksi] = useActionState(batalkanPengajuanAksi, {} as HasilAjukan);
  return (
    <div className="space-y-2">
      <form action={aksi}>
        <input type="hidden" name="pengajuanId" value={pengajuanId} />
        <button
          type="submit"
          className="text-[11px] font-medium text-abu-500 hover:text-btn-merah-700 hover:underline"
        >
          Batalkan
        </button>
      </form>
      <Pesan state={state} />
    </div>
  );
}
