'use client';

import { useActionState, useState } from 'react';
import { useKirimForm } from '@/components/use-kirim-form';
import type { HasilLogin } from '@/app/actions/auth';

function Tombol() {
  const { sibuk: pending, tandaiKirim } = useKirimForm();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={tandaiKirim}
      className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-btn-biru-600 hover:bg-btn-biru-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
    >
      {pending && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      Simpan password baru
    </button>
  );
}

/** Indikator kekuatan password sederhana — membantu, bukan penghalang. */
function Kekuatan({ pw }: { pw: string }) {
  const aturan = [
    { label: 'Minimal 8 karakter', ok: pw.length >= 8 },
    { label: 'Huruf kecil', ok: /[a-z]/.test(pw) },
    { label: 'Huruf besar', ok: /[A-Z]/.test(pw) },
    { label: 'Angka', ok: /[0-9]/.test(pw) },
  ];
  if (!pw) return null;

  return (
    <ul className="mt-2 space-y-1">
      {aturan.map((a) => (
        <li
          key={a.label}
          className={`flex items-center gap-1.5 text-xs ${
            a.ok ? 'text-sukses' : 'text-abu-400'
          }`}
        >
          <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            {a.ok ? (
              <path
                fillRule="evenodd"
                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                clipRule="evenodd"
              />
            ) : (
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 012 0v3a1 1 0 11-2 0V9zm1-3a1 1 0 100 2 1 1 0 000-2z"
                clipRule="evenodd"
              />
            )}
          </svg>
          {a.label}
        </li>
      ))}
    </ul>
  );
}

export function FormUbahPassword({
  aksi,
  wajib,
}: {
  aksi: (prev: HasilLogin, fd: FormData) => Promise<HasilLogin>;
  wajib: boolean;
}) {
  const [state, formAction] = useActionState(aksi, {});
  const [baru, setBaru] = useState('');

  const kelasInput =
    'w-full rounded-lg border border-abu-300 bg-white px-3.5 py-2.5 text-sm text-abu-900 placeholder:text-abu-400 focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none transition';

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-bahaya/25 bg-bahaya-bg px-3.5 py-2.5 text-sm text-bahaya animasi-naik"
        >
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <label htmlFor="passwordLama" className="block text-sm font-medium text-abu-700 mb-1.5">
          Password saat ini
        </label>
        <input
          id="passwordLama"
          name="passwordLama"
          type="password"
          autoComplete="current-password"
          required
          className={kelasInput}
        />
      </div>

      <div>
        <label htmlFor="passwordBaru" className="block text-sm font-medium text-abu-700 mb-1.5">
          Password baru
        </label>
        <input
          id="passwordBaru"
          name="passwordBaru"
          type="password"
          autoComplete="new-password"
          required
          value={baru}
          onChange={(e) => setBaru(e.target.value)}
          className={kelasInput}
        />
        <Kekuatan pw={baru} />
      </div>

      <div>
        <label htmlFor="passwordUlang" className="block text-sm font-medium text-abu-700 mb-1.5">
          Ulangi password baru
        </label>
        <input
          id="passwordUlang"
          name="passwordUlang"
          type="password"
          autoComplete="new-password"
          required
          className={kelasInput}
        />
      </div>

      <div className="pt-1">
        <Tombol />
      </div>

      {wajib && (
        <p className="text-xs text-peringatan bg-peringatan-bg rounded-lg px-3 py-2 leading-relaxed">
          Anda wajib mengganti password sebelum dapat menggunakan aplikasi.
        </p>
      )}
    </form>
  );
}
