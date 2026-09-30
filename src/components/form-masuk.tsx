'use client';

import { useActionState } from 'react';
import { useKirimForm } from '@/components/use-kirim-form';
import type { HasilLogin } from '@/app/actions/auth';

function Tombol({
  children,
  nonaktif,
}: {
  children: React.ReactNode;
  nonaktif?: boolean;
}) {
  const { sibuk: pending, tandaiKirim } = useKirimForm();
  return (
    <button
      type="submit"
      disabled={pending || nonaktif}
      onClick={tandaiKirim}
      className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white bg-btn-biru-600 hover:bg-btn-biru-700 active:bg-btn-biru-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
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
      {children}
    </button>
  );
}

export function FormMasuk({
  aksi,
}: {
  aksi: (prev: HasilLogin, fd: FormData) => Promise<HasilLogin>;
}) {
  const [state, formAction] = useActionState(aksi, {});

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-bahaya/25 bg-bahaya-bg px-3.5 py-2.5 text-sm text-bahaya animasi-naik"
        >
          <svg
            className="h-4 w-4 mt-0.5 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      <div>
        <label
          htmlFor="nip"
          className="block text-sm font-medium text-abu-700 mb-1.5"
        >
          NIP
        </label>
        <input
          id="nip"
          name="nip"
          type="text"
          inputMode="numeric"
          autoComplete="username"
          required
          autoFocus
          placeholder="Nomor Induk Pegawai"
          className="w-full rounded-lg border border-abu-300 bg-white px-3.5 py-2.5 text-sm text-abu-900 placeholder:text-abu-400 focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none transition"
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-abu-700 mb-1.5"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="w-full rounded-lg border border-abu-300 bg-white px-3.5 py-2.5 text-sm text-abu-900 placeholder:text-abu-400 focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none transition"
        />
      </div>

      <div className="pt-1">
        <Tombol>Masuk</Tombol>
      </div>
    </form>
  );
}
