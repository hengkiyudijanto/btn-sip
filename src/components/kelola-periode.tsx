'use client';

import { useActionState, useState } from 'react';
import { useKirimForm } from '@/components/use-kirim-form';
import {
  buatPeriode,
  buatBeberapaPeriode,
  ubahStatusPeriode,
  kunciPeriode,
  type HasilPeriode,
} from '@/app/actions/periode';

function Tombol({
  children,
  variasi = 'utama',
  kecil,
}: {
  children: React.ReactNode;
  variasi?: 'utama' | 'sekunder' | 'peringatan';
  kecil?: boolean;
}) {
  const { sibuk: pending, tandaiKirim } = useKirimForm();
  const warna =
    variasi === 'utama'
      ? 'bg-btn-biru-600 text-white hover:bg-btn-biru-700'
      : variasi === 'peringatan'
        ? 'border border-peringatan/30 bg-peringatan-bg text-peringatan hover:bg-peringatan-bg/70'
        : 'border border-abu-300 bg-white text-abu-700 hover:bg-abu-50';

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={tandaiKirim}
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

function Pesan({ state }: { state: HasilPeriode }) {
  if (state.error)
    return <p className="mt-2 text-xs text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5">{state.error}</p>;
  if (state.sukses)
    return <p className="mt-2 text-xs text-sukses bg-sukses-bg rounded px-2.5 py-1.5">{state.pesan}</p>;
  return null;
}

export function PanelBuatPeriode() {
  const [state, aksi] = useActionState(buatPeriode, {});
  const [mode, setMode] = useState<'satu' | 'massal'>('massal');
  const [stateMassal, aksiMassal] = useActionState(buatBeberapaPeriode, {});

  const kelas =
    'w-full rounded-lg border border-abu-300 px-3 py-2 text-sm focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none';

  return (
    <div className="kartu p-6">
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('massal')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'massal' ? 'bg-btn-biru-600 text-white' : 'bg-abu-100 text-abu-600'
          }`}
        >
          Beberapa minggu
        </button>
        <button
          type="button"
          onClick={() => setMode('satu')}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
            mode === 'satu' ? 'bg-btn-biru-600 text-white' : 'bg-abu-100 text-abu-600'
          }`}
        >
          Satu periode
        </button>
      </div>

      {mode === 'massal' ? (
        <form action={aksiMassal}>
          <p className="text-xs text-abu-500 mb-3 leading-relaxed">
            Buat beberapa periode mingguan sekaligus. Setiap periode otomatis
            dihitung Senin&ndash;Minggu dan diberi nama sesuai nomor minggu.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-abu-600 mb-1.5">
                Mulai minggu yang memuat tanggal
              </label>
              <input type="date" name="mulai" required className={kelas} />
            </div>
            <div>
              <label className="block text-xs font-medium text-abu-600 mb-1.5">
                Jumlah minggu
              </label>
              <input
                type="number"
                name="jumlah"
                min={1}
                max={52}
                defaultValue={4}
                className={kelas}
              />
            </div>
          </div>
          <div className="mt-4">
            <Tombol>Buat Periode</Tombol>
          </div>
          <Pesan state={stateMassal} />
        </form>
      ) : (
        <form action={aksi}>
          <p className="text-xs text-abu-500 mb-3 leading-relaxed">
            Buat satu periode. Sistem tetap membulatkan ke Senin&ndash;Minggu
            terdekat.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-abu-600 mb-1.5">
                Tanggal dalam minggu tersebut
              </label>
              <input type="date" name="tanggal" required className={kelas} />
            </div>
            <div>
              <label className="block text-xs font-medium text-abu-600 mb-1.5">
                Kode (opsional)
              </label>
              <input
                type="text"
                name="kodeManual"
                placeholder="otomatis: 2026-W41"
                className={kelas}
              />
            </div>
          </div>
          <div className="mt-4">
            <Tombol>Buat Periode</Tombol>
          </div>
          <Pesan state={state} />
        </form>
      )}
    </div>
  );
}

export function AksiPeriode({ periodeId, aktif, dikunci }: { periodeId: string; aktif: boolean; dikunci: boolean }) {
  const [stateAktif, aksiAktif] = useActionState(ubahStatusPeriode, {});
  const [stateKunci, aksiKunci] = useActionState(kunciPeriode, {});

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-1.5">
        <form action={aksiKunci}>
          <input type="hidden" name="periodeId" value={periodeId} />
          <Tombol kecil variasi={dikunci ? 'peringatan' : 'sekunder'}>
            {dikunci ? 'Buka Kunci' : 'Kunci'}
          </Tombol>
        </form>
        <form action={aksiAktif}>
          <input type="hidden" name="periodeId" value={periodeId} />
          <Tombol kecil variasi="sekunder">{aktif ? 'Nonaktifkan' : 'Aktifkan'}</Tombol>
        </form>
      </div>
      {stateKunci.pesan && (
        <p className="text-[11px] text-abu-600 bg-abu-100 rounded px-2 py-1">{stateKunci.pesan}</p>
      )}
      {stateKunci.error && (
        <p className="text-[11px] text-bahaya bg-bahaya-bg rounded px-2 py-1">{stateKunci.error}</p>
      )}
      {stateAktif.pesan && (
        <p className="text-[11px] text-abu-600 bg-abu-100 rounded px-2 py-1">{stateAktif.pesan}</p>
      )}
    </div>
  );
}
