'use client';

import { useActionState, useState } from 'react';
import { useKirimForm } from '@/components/use-kirim-form';
import type { HasilAksi } from '@/app/actions/persetujuan';
import {
  tandaiDiketahui,
  kunciPenilaian,
  kembalikanUntukRevisi,
} from '@/app/actions/persetujuan';

function Tombol({
  children,
  variasi = 'utama',
}: {
  children: React.ReactNode;
  variasi?: 'utama' | 'sekunder' | 'bahaya';
}) {
  const { sibuk: pending, tandaiKirim } = useKirimForm();
  const kelas =
    variasi === 'utama'
      ? 'bg-btn-biru-600 text-white hover:bg-btn-biru-700'
      : variasi === 'bahaya'
        ? 'border border-btn-merah-300 bg-white text-btn-merah-700 hover:bg-btn-merah-100'
        : 'border border-abu-300 bg-white text-abu-700 hover:bg-abu-50';

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={tandaiKirim}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${kelas}`}
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

function Pesan({ state }: { state: HasilAksi }) {
  if (state.error) {
    return (
      <p className="mt-2 text-xs text-bahaya bg-bahaya-bg rounded px-2.5 py-1.5">{state.error}</p>
    );
  }
  if (state.sukses) {
    return (
      <p className="mt-2 text-xs text-sukses bg-sukses-bg rounded px-2.5 py-1.5">{state.pesan}</p>
    );
  }
  return null;
}

/** Tombol "Saya mengetahui" */
export function TombolDiketahui({ penilaianId }: { penilaianId: string }) {
  const [state, aksi] = useActionState(tandaiDiketahui, {});
  return (
    <form action={aksi}>
      <input type="hidden" name="penilaianId" value={penilaianId} />
      <Tombol>✓ Saya Mengetahui</Tombol>
      <Pesan state={state} />
    </form>
  );
}

/** Tombol kunci final (admin) */
export function TombolKunci({ penilaianId }: { penilaianId: string }) {
  const [state, aksi] = useActionState(kunciPenilaian, {});
  return (
    <form action={aksi}>
      <input type="hidden" name="penilaianId" value={penilaianId} />
      <Tombol variasi="sekunder">🔒 Kunci Final</Tombol>
      <Pesan state={state} />
    </form>
  );
}

/** Form kembalikan untuk revisi */
export function FormKembalikan({ penilaianId }: { penilaianId: string }) {
  const [state, aksi] = useActionState(kembalikanUntukRevisi, {});
  const [terbuka, setTerbuka] = useState(false);

  if (!terbuka) {
    return (
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-btn-merah-300 bg-white px-4 py-2 text-sm font-semibold text-btn-merah-700 hover:bg-btn-merah-100 transition-colors"
      >
        ↩ Kembalikan untuk Revisi
      </button>
    );
  }

  return (
    <form action={aksi} className="mt-2">
      <input type="hidden" name="penilaianId" value={penilaianId} />
      <label htmlFor={`alasan-${penilaianId}`} className="block text-xs font-medium text-abu-600 mb-1.5">
        Alasan pengembalian (wajib)
      </label>
      <textarea
        id={`alasan-${penilaianId}`}
        name="alasan"
        rows={2}
        required
        placeholder="Mis. nilai aspek Ketelitian perlu ditinjau ulang"
        className="w-full rounded-lg border border-abu-300 px-3 py-2 text-xs focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none resize-y"
      />
      <div className="mt-2 flex gap-2">
        <Tombol variasi="bahaya">Kembalikan</Tombol>
        <button
          type="button"
          onClick={() => setTerbuka(false)}
          className="rounded-lg border border-abu-300 px-4 py-2 text-sm text-abu-600 hover:bg-abu-50 transition-colors"
        >
          Batal
        </button>
      </div>
      <Pesan state={state} />
    </form>
  );
}
