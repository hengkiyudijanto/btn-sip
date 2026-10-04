'use client';

import { useActionState, useRef, useState } from 'react';
import { useKirimForm } from '@/components/use-kirim-form';
import {
  imporPegawai,
  resetPassword,
  ubahStatusAktif,
  tambahPegawai,
  ubahPegawai,
} from '@/app/actions/pegawai';
import type { HasilImpor } from '@/app/actions/pegawai';

function Tombol({
  children,
  variasi = 'utama',
}: {
  children: React.ReactNode;
  variasi?: 'utama' | 'sekunder';
}) {
  const { sibuk: pending, tandaiKirim } = useKirimForm();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={tandaiKirim}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${
        variasi === 'utama'
          ? 'bg-btn-biru-600 text-white hover:bg-btn-biru-700'
          : 'border border-abu-300 bg-white text-abu-700 hover:bg-abu-50'
      }`}
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

// ===========================================================================
// Impor massal
// ===========================================================================

export function PanelImpor() {
  const [state, aksi] = useActionState<HasilImpor, FormData>(imporPegawai, {});
  const [teks, setTeks] = useState('');
  const berkas = useRef<HTMLInputElement>(null);

  const bacaFile = async (f: File) => {
    const isi = await f.text();
    setTeks(isi);
  };

  return (
    <div className="kartu p-6">
      <h3 className="text-sm font-semibold text-abu-800">Impor massal pegawai</h3>
      <p className="mt-1.5 text-xs text-abu-500 leading-relaxed">
        Tempel data atau pilih file CSV. Baris pertama wajib judul kolom:{' '}
        <code className="rounded bg-abu-100 px-1.5 py-0.5 text-[11px]">
          NIP,Nama,Cabang,Jabatan,Role
        </code>
        . Kolom Cabang diisi kode (mis. <code className="rounded bg-abu-100 px-1 py-0.5 text-[11px]">0001</code>)
        atau <code className="rounded bg-abu-100 px-1 py-0.5 text-[11px]">0002|Cabang Bandung</code> untuk membuat
        cabang baru. Jabatan diisi kode: TELLER, CS, SECURITY, PB_TELLER, PB_CS.
      </p>

      <form action={aksi} className="mt-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <input
            ref={berkas}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void bacaFile(f);
            }}
            className="text-xs text-abu-600 file:mr-3 file:rounded-md file:border-0 file:bg-btn-biru-50 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-btn-biru-700 hover:file:bg-btn-biru-100 file:cursor-pointer"
          />
          <span className="text-xs text-abu-400">atau tempel di bawah</span>
        </div>

        <textarea
          name="data"
          rows={7}
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder={`NIP,Nama,Cabang,Jabatan,Role\n80000010,Andi Wijaya,0001,TELLER,PEGAWAI\n80000011,Rina Sari,0001,CS,PEGAWAI`}
          className="w-full rounded-lg border border-abu-300 px-3 py-2.5 text-xs font-mono focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none resize-y"
        />

        <div className="mt-3">
          <Tombol>Impor Sekarang</Tombol>
        </div>

        {state.error && (
          <p className="mt-3 text-xs text-bahaya bg-bahaya-bg rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        {state.ringkasan && (
          <div className="mt-4 rounded-lg border border-abu-200 overflow-hidden">
            <div className="bg-abu-50 px-3.5 py-2.5 flex flex-wrap gap-4 text-xs">
              <span>
                Total <strong className="tabular-nums">{state.ringkasan.total}</strong>
              </span>
              <span className="text-sukses">
                Berhasil <strong className="tabular-nums">{state.ringkasan.berhasil}</strong>
              </span>
              <span className="text-peringatan">
                Perlu ditinjau <strong className="tabular-nums">{state.ringkasan.gagal}</strong>
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-[11px]">
                <tbody>
                  {state.ringkasan.detail.map((d) => (
                    <tr key={d.baris} className="border-t border-abu-100">
                      <td className="px-3 py-1.5 text-abu-400 tabular-nums w-10">{d.baris}</td>
                      <td className="px-2 py-1.5 tabular-nums text-abu-700">{d.nip}</td>
                      <td className="px-2 py-1.5 text-abu-700">{d.nama}</td>
                      <td
                        className={`px-3 py-1.5 ${
                          d.status.startsWith('Berhasil') ? 'text-sukses' : 'text-peringatan'
                        }`}
                      >
                        {d.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {state.ringkasan.berhasil > 0 && (
              <div className="bg-peringatan-bg px-3.5 py-2.5">
                <p className="text-[11px] text-peringatan leading-relaxed">
                  <strong>Catat password awal sekarang.</strong> Password hanya
                  ditampilkan sekali di tabel di atas. Pegawai wajib menggantinya
                  saat login pertama.
                </p>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}

// ===========================================================================
// Tambah satu pegawai
// ===========================================================================

export function PanelTambah({
  daftarCabang,
  daftarJabatan,
}: {
  daftarCabang: { id: string; kode: string; nama: string }[];
  daftarJabatan: { id: string; kode: string; nama: string }[];
}) {
  const [state, aksi] = useActionState(tambahPegawai, {});
  const [buka, setBuka] = useState(false);

  if (!buka) {
    return (
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="rounded-lg bg-btn-biru-600 px-4 py-2 text-sm font-semibold text-white hover:bg-btn-biru-700 transition-colors"
      >
        + Tambah Pegawai
      </button>
    );
  }

  const kelasInput =
    'w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none';

  return (
    <div className="kartu p-6 mb-4">
      <h3 className="text-sm font-semibold text-abu-800 mb-4">Tambah pegawai baru</h3>
      <form action={aksi} className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-abu-600 mb-1.5">NIP</label>
          <input name="nip" required className={kelasInput} placeholder="mis. 80000012" />
        </div>
        <div>
          <label className="block text-xs font-medium text-abu-600 mb-1.5">Nama lengkap</label>
          <input name="nama" required className={kelasInput} placeholder="Nama pegawai" />
        </div>
        <div>
          <label className="block text-xs font-medium text-abu-600 mb-1.5">Cabang</label>
          <select name="cabangId" required className={kelasInput}>
            <option value="">— pilih cabang —</option>
            {daftarCabang.map((c) => (
              <option key={c.id} value={c.id}>
                {c.kode} — {c.nama}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-abu-600 mb-1.5">Jabatan</label>
          <select name="jabatanId" className={kelasInput}>
            <option value="">— tidak ada —</option>
            {daftarJabatan.map((j) => (
              <option key={j.id} value={j.id}>
                {j.nama}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-abu-600 mb-1.5">Peran</label>
          <select name="role" defaultValue="PEGAWAI" className={kelasInput}>
            <option value="PEGAWAI">Pegawai</option>
            <option value="PENGAMAT">Pengamat (hanya melihat)</option>
            <option value="SUPERVISOR">Supervisor (penilai)</option>
            <option value="MANAGER">Manager (mengetahui)</option>
            <option value="ADMIN">Administrator</option>
          </select>
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

        {state.error && (
          <p className="sm:col-span-2 text-xs text-bahaya bg-bahaya-bg rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}
        {state.sukses && state.password && (
          <div className="sm:col-span-2 rounded-lg border border-peringatan/30 bg-peringatan-bg px-3.5 py-3">
            <p className="text-xs text-peringatan">
              {state.pesan} <strong>Password awal: {state.password}</strong> — catat
              sekarang, hanya tampil sekali.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}

// ===========================================================================
// Aksi baris: ubah data, reset password & aktif/nonaktif
// ===========================================================================

export function AksiBaris({
  pegawaiId,
  aktif,
  data,
  daftarCabang,
  daftarJabatan,
}: {
  pegawaiId: string;
  aktif: boolean;
  data: {
    nip: string;
    nama: string;
    email: string | null;
    cabangId: string;
    jabatanId: string | null;
    role: string;
  };
  daftarCabang: { id: string; kode: string; nama: string }[];
  daftarJabatan: { id: string; kode: string; nama: string }[];
}) {
  const [stateReset, aksiReset] = useActionState(resetPassword, {});
  const [stateStatus, aksiStatus] = useActionState(ubahStatusAktif, {});
  const [stateUbah, aksiUbah] = useActionState(ubahPegawai, {});
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [mode, setMode] = useState<'diam' | 'ubah'>('diam');
  const [nip, setNip] = useState(data.nip);

  const nipBerubah = nip.trim() !== data.nip;
  const kelasKecil =
    'w-full rounded-lg border border-abu-300 px-2.5 py-1.5 text-xs focus:border-btn-biru-500 focus:outline-none';

  // ---------- mode ubah: tampilkan form lengkap ----------
  if (mode === 'ubah') {
    return (
      <div className="min-w-[330px] text-left">
        <form action={aksiUbah} className="space-y-2">
          <input type="hidden" name="id" value={pegawaiId} />

          <div>
            <label className="block text-[10px] font-medium text-abu-500 mb-0.5">Nama</label>
            <input name="nama" defaultValue={data.nama} required className={kelasKecil} />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-abu-500 mb-0.5">
              NIP {nipBerubah && <span className="text-peringatan">(diubah)</span>}
            </label>
            <input
              name="nip"
              value={nip}
              onChange={(e) => setNip(e.target.value)}
              required
              className={`${kelasKecil} ${
                nipBerubah ? 'border-peringatan bg-peringatan-bg/40' : ''
              }`}
            />
            {nipBerubah && (
              <p className="mt-1 text-[10px] text-peringatan leading-relaxed">
                NIP dipakai untuk login. Pegawai harus diberi tahu NIP barunya.
              </p>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-medium text-abu-500 mb-0.5">
              Email (opsional)
            </label>
            <input
              name="email"
              type="email"
              defaultValue={data.email ?? ''}
              className={kelasKecil}
              placeholder="nama@btn.co.id"
            />
          </div>

          <div>
            <label className="block text-[10px] font-medium text-abu-500 mb-0.5">Cabang</label>
            <select name="cabangId" defaultValue={data.cabangId} required className={kelasKecil}>
              {daftarCabang.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.kode} — {c.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-abu-500 mb-0.5">Jabatan</label>
            <select name="jabatanId" defaultValue={data.jabatanId ?? ''} className={kelasKecil}>
              <option value="">— tidak ada —</option>
              {daftarJabatan.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-abu-500 mb-0.5">Peran</label>
            <select name="role" defaultValue={data.role} className={kelasKecil}>
              <option value="PEGAWAI">Pegawai</option>
              <option value="PENGAMAT">Pengamat (hanya melihat)</option>
              <option value="SUPERVISOR">Supervisor (penilai)</option>
              <option value="MANAGER">Manager (mengetahui)</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>

          <div className="flex gap-1.5 pt-1">
            <button
              type="submit"
              className="rounded-md bg-btn-biru-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-btn-biru-700 transition-colors"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={() => setMode('diam')}
              className="rounded-md border border-abu-300 px-3 py-1.5 text-[11px] text-abu-600 hover:bg-abu-50"
            >
              Batal
            </button>
          </div>
        </form>

        {stateUbah.error && (
          <p className="mt-2 text-[11px] text-bahaya bg-bahaya-bg rounded px-2 py-1">
            {stateUbah.error}
          </p>
        )}
        {stateUbah.sukses && (
          <p className="mt-2 text-[11px] text-sukses bg-sukses-bg rounded px-2 py-1">
            {stateUbah.pesan}
          </p>
        )}
      </div>
    );
  }

  // ---------- mode diam: tombol aksi ----------
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setMode('ubah')}
          className="rounded-md border border-btn-biru-200 bg-btn-biru-50 px-2.5 py-1 text-[11px] font-medium text-btn-biru-700 hover:bg-btn-biru-100 transition-colors whitespace-nowrap"
        >
          Ubah
        </button>

        {!konfirmasi ? (
          <button
            type="button"
            onClick={() => setKonfirmasi(true)}
            className="rounded-md border border-abu-200 px-2.5 py-1 text-[11px] font-medium text-abu-600 hover:bg-abu-50 transition-colors whitespace-nowrap"
          >
            Reset password
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <form action={aksiReset}>
              <input type="hidden" name="pegawaiId" value={pegawaiId} />
              <button
                type="submit"
                className="rounded-md bg-btn-merah-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-btn-merah-700 transition-colors whitespace-nowrap"
              >
                Ya, reset
              </button>
            </form>
            <button
              type="button"
              onClick={() => setKonfirmasi(false)}
              className="rounded-md border border-abu-200 px-2 py-1 text-[11px] text-abu-500 hover:bg-abu-50 transition-colors"
            >
              Batal
            </button>
          </div>
        )}

        <form action={aksiStatus}>
          <input type="hidden" name="pegawaiId" value={pegawaiId} />
          <button
            type="submit"
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
              aktif
                ? 'border-abu-200 text-abu-600 hover:bg-abu-50'
                : 'border-sukses/30 bg-sukses-bg text-sukses hover:bg-sukses-bg/70'
            }`}
          >
            {aktif ? 'Nonaktifkan' : 'Aktifkan'}
          </button>
        </form>
      </div>

      {stateReset.sukses && stateReset.password && (
        <p className="text-[11px] text-peringatan bg-peringatan-bg rounded px-2 py-1">
          Password baru <strong>{stateReset.nama}</strong>: {stateReset.password}
        </p>
      )}
      {stateReset.error && (
        <p className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2 py-1">
          {stateReset.error}
        </p>
      )}
      {stateStatus.pesan && (
        <p className="text-[11px] text-abu-600 bg-abu-100 rounded px-2 py-1">
          {stateStatus.pesan}
        </p>
      )}
      {stateUbah.sukses && stateUbah.pesan && (
        <p className="text-[11px] text-sukses bg-sukses-bg rounded px-2 py-1">
          {stateUbah.pesan}
        </p>
      )}
    </div>
  );
}
