'use client';

import { useActionState, useState } from 'react';
import { useKirimForm } from '@/components/use-kirim-form';
import {
  pindahPenilaian,
  hapusPenilaian,
  type HasilPindah,
  type HasilHapus,
} from '@/app/actions/penilaian';

type Periode = {
  id: string;
  nama: string;
  tanggalMulai: Date | string;
  tanggalSelesai: Date | string;
};

function tanggal(d: Date | string) {
  const t = typeof d === 'string' ? new Date(d) : d;
  const b = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${t.getDate()} ${b[t.getMonth()]} ${t.getFullYear()}`;
}

function Pesan({ state }: { state: HasilPindah & HasilHapus }) {
  if (state.error)
    return (
      <p className="mt-2 rounded bg-bahaya-bg px-2.5 py-1.5 text-xs text-bahaya">{state.error}</p>
    );
  if (state.sukses && state.pesan)
    return (
      <p className="mt-2 rounded bg-sukses-bg px-2.5 py-1.5 text-xs text-sukses">{state.pesan}</p>
    );
  return null;
}

/**
 * Panel admin untuk memindahkan penilaian ke periode lain atau menghapusnya.
 *
 * Dua panel terpisah supaya salah klik tidak berbahaya: menghapus perlu
 * mengetik nama petugas dulu (dicek ulang di server).
 */
export function KelolaPenilaian({
  penilaianId,
  namaPegawai,
  namaPeriode,
  periodeTujuan,
}: {
  penilaianId: string;
  namaPegawai: string;
  namaPeriode: string;
  periodeTujuan: Periode[];
}) {
  const [tab, setTab] = useState<'pindah' | 'hapus' | null>(null);

  return (
    <div className="rounded-xl border border-abu-200 bg-white">
      <div className="flex items-center gap-1 border-b border-abu-200 px-3 py-2">
        <button
          type="button"
          onClick={() => setTab(tab === 'pindah' ? null : 'pindah')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === 'pindah'
              ? 'bg-btn-biru-600 text-white'
              : 'text-btn-biru-700 hover:bg-btn-biru-100'
          }`}
        >
          Pindahkan
        </button>
        <button
          type="button"
          onClick={() => setTab(tab === 'hapus' ? null : 'hapus')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            tab === 'hapus'
              ? 'bg-bahaya text-white'
              : 'text-bahaya hover:bg-bahaya-bg'
          }`}
        >
          Hapus
        </button>
        <span className="ml-auto text-[11px] text-abu-500">
          {namaPegawai} · {namaPeriode}
        </span>
      </div>

      {tab === 'pindah' && <PanelPindah penilaianId={penilaianId} tujuan={periodeTujuan} />}
      {tab === 'hapus' && (
        <PanelHapus penilaianId={penilaianId} namaPegawai={namaPegawai} namaPeriode={namaPeriode} />
      )}
    </div>
  );
}

function PanelPindah({ penilaianId, tujuan }: { penilaianId: string; tujuan: Periode[] }) {
  const [state, aksi] = useActionState(pindahPenilaian, {} as HasilPindah);
  const { sibuk, tandaiKirim } = useKirimForm();

  return (
    <form action={aksi} className="space-y-2 px-3 py-3">
      <input type="hidden" name="penilaianId" value={penilaianId} />
      <label className="block text-xs font-medium text-abu-700">
        Pindahkan ke periode
        <select
          name="periodeTujuanId"
          required
          defaultValue=""
          className="mt-1 w-full rounded-lg border border-abu-300 bg-white px-3 py-2 text-sm"
        >
          <option value="" disabled>
            — pilih periode tujuan —
          </option>
          {tujuan.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama} ({tanggal(p.tanggalMulai)} – {tanggal(p.tanggalSelesai)})
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] leading-relaxed text-abu-500">
        Periode yang sudah punya penilaian untuk petugas ini tidak muncul di daftar — penilaian
        ganda untuk satu petugas pada satu periode tidak diizinkan.
      </p>
      <button
        type="submit"
        disabled={sibuk}
        onClick={tandaiKirim}
        className="rounded-lg bg-btn-biru-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-btn-biru-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sibuk ? 'Memindahkan…' : 'Pindahkan'}
      </button>
      <Pesan state={state} />
    </form>
  );
}

function PanelHapus({
  penilaianId,
  namaPegawai,
  namaPeriode,
}: {
  penilaianId: string;
  namaPegawai: string;
  namaPeriode: string;
}) {
  const [state, aksi] = useActionState(hapusPenilaian, {} as HasilHapus);
  const { sibuk, tandaiKirim } = useKirimForm();

  return (
    <form action={aksi} className="space-y-2 px-3 py-3">
      <input type="hidden" name="penilaianId" value={penilaianId} />
      <p className="rounded bg-bahaya-bg px-2.5 py-1.5 text-[11px] leading-relaxed text-bahaya">
        Penilaian <strong>{namaPegawai}</strong> di <strong>{namaPeriode}</strong> akan dihapus
        beserta seluruh aspek dan fotonya. Tindakan ini dicatat di audit log dan tidak bisa
        dibatalkan.
      </p>
      <label className="block text-xs font-medium text-abu-700">
        Ketik nama petugas untuk konfirmasi: <span className="text-abu-500">{namaPegawai}</span>
        <input
          name="konfirmasi"
          required
          autoComplete="off"
          placeholder={namaPegawai}
          className="mt-1 w-full rounded-lg border border-abu-300 px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={sibuk}
        onClick={tandaiKirim}
        className="rounded-lg bg-bahaya px-4 py-2 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sibuk ? 'Menghapus…' : 'Hapus penilaian'}
      </button>
      <Pesan state={state} />
    </form>
  );
}
