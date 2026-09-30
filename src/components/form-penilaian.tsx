'use client';

import { useMemo, useState } from 'react';
import { useActionState } from 'react';
import { useKirimForm } from '@/components/use-kirim-form';
import { KATEGORI, nilaiKeSkala, ratingDariNilai } from '@/lib/sip/penilaian';
import { rubrikAspek, RENTANG_SKOR } from '@/lib/sip/rubrik';
import { BadgeRating } from '@/components/badge-rating';
import type { HasilSimpan } from '@/app/actions/penilaian';

export type NilaiAspek = Record<string, { nilai: number; catatan?: string }>;

const WARNA_SKOR: Record<number, string> = {
  5: 'bg-[#d1fae5] text-[#047857] border-[#6ee7b7]',
  4: 'bg-[#e0f2fe] text-[#0369a1] border-[#7dd3fc]',
  3: 'bg-[#e0e7ff] text-[#4f46e5] border-[#a5b4fc]',
  2: 'bg-[#fef3c7] text-[#b45309] border-[#fcd34d]',
  1: 'bg-[#fee2e2] text-[#b91c1c] border-[#fca5a5]',
};

// ===========================================================================
// Kartu satu aspek — SEMUA aspek memakai input angka 0-100
// ===========================================================================

function KartuAspek({
  kode,
  nama,
  bobot,
  nilai,
  catatan,
  onNilai,
  onCatatan,
}: {
  kode: string;
  nama: string;
  bobot: number;
  nilai?: number;
  catatan: string;
  onNilai: (v: number) => void;
  onCatatan: (v: string) => void;
}) {
  const [bukaRubrik, setBukaRubrik] = useState(false);
  const level = rubrikAspek(kode);

  const angkaValid = nilai !== undefined && Number.isFinite(nilai);
  const dalamRentang = angkaValid && nilai >= 0 && nilai <= 100;
  const skor = dalamRentang ? nilaiKeSkala(nilai) : null;
  const labelSkor = skor !== null ? level.find((l) => l.skor === skor)?.label : null;

  return (
    <div className="border-b border-abu-100 last:border-b-0 py-5 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded bg-btn-biru-50 px-1.5 text-[11px] font-bold text-btn-biru-700">
              {kode}
            </span>
            <h4 className="text-sm font-semibold text-abu-800">{nama}</h4>
          </div>
          <p className="mt-1 text-xs text-abu-400">Bobot {Math.round(bobot * 100)}%</p>
        </div>

        <button
          type="button"
          onClick={() => setBukaRubrik((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-abu-200 px-2.5 py-1 text-[11px] font-medium text-abu-600 hover:bg-abu-50 transition-colors"
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform ${bukaRubrik ? 'rotate-90' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
              clipRule="evenodd"
            />
          </svg>
          Panduan kriteria
        </button>
      </div>

      {/* Input angka + skor otomatis */}
      <div className="mt-4 flex flex-wrap items-end gap-5">
        <div>
          <label
            htmlFor={`angka-${kode}`}
            className="block text-xs font-medium text-abu-600 mb-1"
          >
            Angka (0&ndash;100)
          </label>
          <input
            id={`angka-${kode}`}
            type="number"
            min={0}
            max={100}
            step={1}
            value={angkaValid ? nilai : ''}
            onChange={(e) => onNilai(e.target.value === '' ? NaN : Number(e.target.value))}
            placeholder="0 - 100"
            className={`w-28 rounded-lg border px-3 py-2 text-sm tabular-nums focus:ring-2 focus:outline-none transition ${
              angkaValid && !dalamRentang
                ? 'border-bahaya text-bahaya focus:border-bahaya focus:ring-bahaya/20'
                : 'border-abu-300 focus:border-btn-biru-500 focus:ring-btn-biru-500/20'
            }`}
          />
        </div>

        <div>
          <div className="text-xs font-medium text-abu-600 mb-1">Skor (otomatis)</div>
          <div className="flex items-center gap-2 h-[38px]">
            {skor !== null ? (
              <>
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-bold ${WARNA_SKOR[skor]}`}
                >
                  {skor}
                </span>
                <span className="text-xs font-medium text-abu-600 whitespace-nowrap">
                  {labelSkor}
                </span>
                <span className="text-[11px] text-abu-400 tabular-nums whitespace-nowrap">
                  ({RENTANG_SKOR[skor]})
                </span>
              </>
            ) : (
              <span className="text-xs text-abu-400">
                {angkaValid && !dalamRentang
                  ? 'Angka harus 0–100'
                  : 'Terisi otomatis setelah angka dimasukkan'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Catatan per aspek */}
      <div className="mt-3">
        <input
          type="text"
          value={catatan}
          onChange={(e) => onCatatan(e.target.value)}
          placeholder="Catatan (opsional)"
          className="w-full rounded-lg border border-abu-200 bg-abu-50/50 px-3 py-2 text-xs text-abu-700 placeholder:text-abu-400 focus:border-btn-biru-500 focus:bg-white focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none"
        />
      </div>

      {/* Rubrik lengkap + rentang angka */}
      {bukaRubrik && (
        <div className="mt-4 rounded-lg border border-abu-200 bg-abu-50 p-4 animasi-naik">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-xs font-semibold text-abu-700">
              Panduan kriteria &amp; rentang angka
            </h5>
            <span className="text-[11px] text-abu-400">Acuan penilaian</span>
          </div>
          <div className="space-y-2">
            {level.map((l) => (
              <div
                key={l.skor}
                className={`w-full text-left rounded-lg border p-3 ${
                  skor === l.skor
                    ? 'bg-white border-btn-biru-400 shadow-sm'
                    : 'bg-white/60 border-abu-200'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${WARNA_SKOR[l.skor]}`}
                  >
                    {l.skor}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-abu-800">{l.label}</span>
                      <span className="text-[10px] text-abu-400 tabular-nums">
                        angka {RENTANG_SKOR[l.skor]}
                      </span>
                      {skor === l.skor && (
                        <span className="text-[10px] font-medium text-btn-biru-600">
                          &larr; skor aspek ini
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-abu-600">{l.kriteria}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Tombol submit
// ===========================================================================

/**
 * Tombol simpan/kirim di dalam form penilaian.
 *
 * Catatan penting: useFormStatus() mengembalikan pending=true saat HTML
 * dirender di server, sehingga semua tombol tampil nonaktif sebelum
 * halaman hidup di peramban. Karena itu status pending di sini dipantau
 * lewat penanda yang hanya menyala setelah tombol benar-benar diklik.
 */
function TombolSimpan({ kirim, nonaktif }: { kirim: boolean; nonaktif?: boolean }) {
  const { sibuk: pending, tandaiKirim } = useKirimForm();
  const [sedangKirim, setSedangKirim] = useState(false);
  // hanya percayai pending setelah form benar-benar dikirim dari klien
  const sibuk = sedangKirim && pending;

  return (
    <button
      type="submit"
      disabled={sibuk || nonaktif}
      onClick={() => setSedangKirim(true)}
      className={
        kirim
          ? 'inline-flex items-center gap-2 rounded-lg bg-btn-merah-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-btn-merah-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm'
          : 'inline-flex items-center gap-2 rounded-lg border border-abu-300 bg-white px-5 py-2.5 text-sm font-semibold text-abu-700 hover:bg-abu-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors'
      }
    >
      {sibuk && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {kirim ? 'Kirim Penilaian' : 'Simpan Draft'}
    </button>
  );
}

// ===========================================================================
// Form utama
// ===========================================================================

export function FormPenilaian({
  aksi,
  pegawaiId,
  periodeId,
  nilaiAwal,
  catatanUmumAwal,
  sudahDikirim,
  adaFoto,
}: {
  aksi: (prev: HasilSimpan, fd: FormData) => Promise<HasilSimpan>;
  pegawaiId: string;
  periodeId: string;
  nilaiAwal?: NilaiAspek;
  catatanUmumAwal?: string;
  sudahDikirim?: boolean;
  /** apakah foto penilaian sudah diunggah — wajib sebelum bisa dikirim */
  adaFoto?: boolean;
}) {
  const [state, formAction] = useActionState(aksi, {});
  const [nilai, setNilai] = useState<NilaiAspek>(nilaiAwal ?? {});
  const [catatanUmum, setCatatanUmum] = useState(catatanUmumAwal ?? '');
  const [kirim, setKirim] = useState(false);

  const semuaAspek = useMemo(() => KATEGORI.flatMap((k) => k.aspek), []);

  /** Semua aspek menerima angka 0-100. */
  const payload = useMemo(
    () =>
      JSON.stringify({
        pegawaiId,
        periodeId,
        catatanUmum,
        kirim,
        aspek: semuaAspek
          .filter((a) => {
            const v = nilai[a.kode]?.nilai;
            return v !== undefined && Number.isFinite(v);
          })
          .map((a) => ({
            kode: a.kode,
            nilai: nilai[a.kode].nilai,
            catatan: nilai[a.kode].catatan ?? '',
          })),
      }),
    [pegawaiId, periodeId, catatanUmum, kirim, nilai, semuaAspek]
  );

  /** Ringkasan sisi klien — konversi bertingkat, sama dengan server. */
  const ringkasan = useMemo(() => {
    const perKategori = KATEGORI.map((kat) => {
      let jml = 0;
      let bobotTerisi = 0;
      for (const asp of kat.aspek) {
        const n = nilai[asp.kode]?.nilai;
        if (n === undefined || !Number.isFinite(n) || n < 0 || n > 100) continue;
        jml += nilaiKeSkala(n) * asp.bobot;
        bobotTerisi += asp.bobot;
      }
      return {
        kode: kat.kode,
        nama: kat.nama,
        nilai: bobotTerisi > 0 ? jml / bobotTerisi : 0,
        lengkap: bobotTerisi >= 0.999,
      };
    });

    const terisi = semuaAspek.filter((a) => {
      const v = nilai[a.kode]?.nilai;
      return v !== undefined && Number.isFinite(v) && v >= 0 && v <= 100;
    }).length;

    const semuaLengkap = perKategori.every((k) => k.lengkap);
    const nilaiAkhir = semuaLengkap
      ? Math.round(
          perKategori.reduce((a, k) => {
            const bobotKategori = k.kode === 'A' ? 0.2 : k.kode === 'B' ? 0.5 : 0.3;
            return a + k.nilai * bobotKategori;
          }, 0) * 100
        ) / 100
      : null;

    return { perKategori, terisi, total: semuaAspek.length, nilaiAkhir };
  }, [nilai, semuaAspek]);

  const set = (kode: string, patch: Partial<{ nilai: number; catatan: string }>) =>
    setNilai((s) => ({ ...s, [kode]: { ...s[kode], ...patch } }));

  return (
    <form action={formAction}>
      <input type="hidden" name="data" value={payload} />

      {state.error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2 rounded-lg border border-bahaya/25 bg-bahaya-bg px-4 py-3 text-sm text-bahaya animasi-naik"
        >
          <span>{state.error}</span>
        </div>
      )}

      {state.sukses && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-sukses/25 bg-sukses-bg px-4 py-3 animasi-naik">
          <span className="text-sm font-medium text-sukses">Tersimpan &middot; nilai akhir</span>
          <span className="text-lg font-bold tabular-nums text-sukses">
            {state.nilaiAkhir?.toFixed(2)}
          </span>
          {state.rating && <BadgeRating rating={state.rating} />}
        </div>
      )}

      {/* Info cara penilaian */}
      <div className="mb-5 rounded-lg border border-btn-biru-200 bg-btn-biru-50 px-4 py-3">
        <p className="text-xs leading-relaxed text-btn-biru-700">
          <strong>Cara penilaian:</strong> isi <strong>angka 0&ndash;100</strong> pada
          setiap aspek sesuai kriteria. Kolom skor 1&ndash;5 terisi otomatis
          berdasarkan rentang angka, dan nilai akhir dihitung dari skor tersebut.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {KATEGORI.map((kat) => (
            <section key={kat.kode} className="kartu p-6">
              <header className="mb-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-abu-900">
                    {kat.kode}. {kat.nama}
                  </h3>
                  <span className="rounded-full bg-btn-biru-50 px-2.5 py-1 text-xs font-semibold text-btn-biru-700">
                    Bobot {Math.round(kat.bobot * 100)}%
                  </span>
                </div>
                <div className="mt-2 h-0.5 w-8 bg-btn-merah-500 rounded-full" />
              </header>

              <div>
                {kat.aspek.map((asp) => (
                  <KartuAspek
                    key={asp.kode}
                    kode={asp.kode}
                    nama={asp.nama}
                    bobot={asp.bobot}
                    nilai={nilai[asp.kode]?.nilai}
                    catatan={nilai[asp.kode]?.catatan ?? ''}
                    onNilai={(v) => set(asp.kode, { nilai: v })}
                    onCatatan={(c) => set(asp.kode, { catatan: c })}
                  />
                ))}
              </div>
            </section>
          ))}

          <section className="kartu p-6">
            <label htmlFor="catatanUmum" className="block text-sm font-semibold text-abu-800 mb-2">
              Catatan umum penilai
            </label>
            <textarea
              id="catatanUmum"
              rows={3}
              value={catatanUmum}
              onChange={(e) => setCatatanUmum(e.target.value)}
              placeholder="Ringkasan, saran pembinaan, atau hal yang perlu ditindaklanjuti (opsional)"
              className="w-full rounded-lg border border-abu-300 px-3.5 py-2.5 text-sm text-abu-800 placeholder:text-abu-400 focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none resize-y"
            />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-abu-500 leading-relaxed max-w-md space-y-1.5">
                <p>
                  {sudahDikirim
                    ? 'Penilaian sudah pernah dikirim. Setiap perubahan tercatat di audit log.'
                    : 'Simpan draft untuk melanjutkan nanti, atau kirim untuk meminta persetujuan atasan.'}
                </p>
                {!adaFoto && (
                  <p className="text-peringatan font-medium">
                    ⚠ Foto penilaian belum ada. Draft boleh disimpan tanpa foto,
                    tapi penilaian tidak dapat dikirim sebelum foto diunggah.
                  </p>
                )}
              </div>
              <div className="flex gap-2.5">
                <span onClick={() => setKirim(false)}>
                  <TombolSimpan kirim={false} />
                </span>
                <span
                  onClick={() => {
                    if (!adaFoto) return;
                    setKirim(true);
                  }}
                  title={adaFoto ? undefined : 'Unggah foto penilaian terlebih dahulu'}
                >
                  <TombolSimpan kirim={true} nonaktif={!adaFoto} />
                </span>
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 h-fit">
          <div className="kartu-padat p-5">
            <h3 className="text-sm font-bold text-abu-900">Ringkasan Penilaian</h3>
            <div className="mt-1 h-0.5 w-8 bg-btn-merah-500 rounded-full" />

            <div className="mt-4 space-y-3">
              {ringkasan.perKategori.map((k) => (
                <div key={k.kode} className="flex items-center justify-between text-sm">
                  <span className="text-abu-600">
                    {k.kode}. {k.nama}
                  </span>
                  <span
                    className={`tabular-nums font-medium ${
                      k.lengkap ? 'text-abu-900' : 'text-abu-300'
                    }`}
                  >
                    {k.lengkap ? k.nilai.toFixed(2) : '—'}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-abu-200">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-abu-700">Nilai Akhir</span>
                <span className="text-2xl font-bold tabular-nums text-btn-biru-700">
                  {ringkasan.nilaiAkhir !== null ? ringkasan.nilaiAkhir.toFixed(2) : '—'}
                </span>
              </div>
              {ringkasan.nilaiAkhir !== null && (
                <div className="mt-2">
                  <BadgeRating rating={ratingDariNilai(ringkasan.nilaiAkhir)} ukuran="kecil" />
                </div>
              )}
              <p className="mt-2 text-xs text-abu-400">
                Skala 0&ndash;5 &middot; tampil setelah semua aspek terisi
              </p>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-abu-500 mb-1.5">
                <span>Kemajuan pengisian</span>
                <span className="tabular-nums font-medium">
                  {ringkasan.terisi}/{ringkasan.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-abu-100 overflow-hidden">
                <div
                  className="h-full bg-btn-biru-500 transition-all duration-300"
                  style={{ width: `${(ringkasan.terisi / ringkasan.total) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-abu-400 px-1">
            Angka di panel ini adalah perkiraan cepat. Nilai akhir resmi dihitung
            ulang di server memakai rumus SIP saat disimpan.
          </p>
        </aside>
      </div>
    </form>
  );
}
