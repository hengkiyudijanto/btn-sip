'use client';

import { useMemo, useState } from 'react';
import type { BatangNilai, DataGrafikBatang } from '@/lib/sip/grafik-batang-data';

/**
 * Grafik batang nilai per unit / per jabatan / per petugas.
 *
 * Digambar sebagai HTML/CSS (bukan SVG) karena batangnya horizontal, bisa
 * puluhan baris (petugas), dan perlu bisa ditekan — lebih sederhana dengan
 * elemen nyata daripada menghitung koordinat SVG.
 *
 * Lebarnya memakai persentase dari skala penuh 0–5, sehingga selalu mulai
 * dari NOL, bukan dari nilai terkecil: kalau diskalakan ke yang tertinggi,
 * nilai 3,15 dan 4,92 akan tampak hampir sama panjang.
 *
 * Tingkat unit & jabatan selalu tampil; tingkat petugas bisa dinyalakan dan
 * dimatikan oleh pengguna.
 */

const SKALA_MAKS = 5;

/**
 * Warna batang mengikuti pita rating supaya konsisten dengan badge di seluruh
 * aplikasi. Dipakai gradasi (bukan warna rata) supaya batangnya terlihat
 * punya dimensi dan tidak kaku.
 */
function warnaBatang(nilai: number): string {
  if (nilai >= 4.8) return 'batang-istimewa';
  if (nilai >= 4.6) return 'batang-sangat-baik';
  if (nilai >= 4.0) return 'batang-baik';
  if (nilai >= 3.6) return 'batang-cukup';
  return 'batang-kurang';
}

function labelRating(nilai: number): string {
  if (nilai >= 4.8) return 'Istimewa';
  if (nilai >= 4.6) return 'Sangat Baik';
  if (nilai >= 4.0) return 'Baik';
  if (nilai >= 3.6) return 'Cukup';
  return 'Kurang';
}

/** Warna teks kategori, untuk menegaskan kata di ujung angka. */
const WARNA_TEKS_RATING: Record<string, string> = {
  Istimewa: 'text-rating-istimewa',
  'Sangat Baik': 'text-rating-sangat-baik',
  Baik: 'text-rating-baik',
  Cukup: 'text-peringatan',
  Kurang: 'text-bahaya',
};

export function GrafikBatang({ data }: { data: DataGrafikBatang }) {
  const [tampilPetugas, setTampilPetugas] = useState(true);
  const [cari, setCari] = useState('');

  const petugasTersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return data.perPetugas;
    return data.perPetugas.filter(
      (b) =>
        b.label.toLowerCase().includes(q) ||
        (b.keterangan ?? '').toLowerCase().includes(q)
    );
  }, [data.perPetugas, cari]);

  if (!data.periode) {
    return (
      <div className="kartu p-8 text-center">
        <p className="text-sm text-abu-500">Belum ada periode penilaian.</p>
      </div>
    );
  }

  const adaNilai = data.jumlahDinilai > 0;
  const persenCakupan =
    data.jumlahPetugas > 0 ? Math.round((data.jumlahDinilai / data.jumlahPetugas) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* ====== ringkasan singkat ====== */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kotak label="Periode" nilai={data.periode.nama} />
        <Kotak
          label="Sudah dinilai"
          nilai={`${data.jumlahDinilai} dari ${data.jumlahPetugas} petugas`}
          keterangan={`${persenCakupan}% cakupan pada periode ini`}
        />
        <Kotak
          label="Cakupan kantor"
          nilai={data.unitTerpilih || 'Semua unit'}
          keterangan={
            data.jabatanTerpilih
              ? `Jabatan: ${data.opsiJabatan.find((j) => j.kode === data.jabatanTerpilih)?.nama ?? data.jabatanTerpilih}`
              : 'Semua jabatan'
          }
        />
      </div>

      {!adaNilai ? (
        <div className="kartu p-10 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-peringatan-bg mb-4">
            <svg className="h-6 w-6 text-peringatan" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-abu-800">Belum ada nilai pada periode ini</h3>
          <p className="mt-2 text-sm text-abu-500 max-w-md mx-auto">
            Grafik akan terisi setelah penilaian pada periode ini dikirim. Penilaian yang
            masih berstatus draft tanpa nilai belum ikut dihitung.
          </p>
        </div>
      ) : (
        <>
          {/* ====== tingkat 1: per unit ====== */}
          <PanelGrafik
            judul="Nilai per Unit"
            deskripsi="Rata-rata nilai akhir tiap kantor dalam cakupan yang dipilih. Batang berskala penuh 0–5."
            batang={data.perUnit}
            kosong="Tidak ada unit yang punya penilaian pada periode ini."
          />

          {/* ====== tingkat 2: per jabatan ====== */}
          <PanelGrafik
            judul="Nilai per Jabatan"
            deskripsi="Perbandingan antar jabatan dalam cakupan ini. Jabatan yang belum dinilai tetap ditampilkan supaya terlihat mana yang tertinggal."
            batang={data.perJabatan}
            kosong="Tidak ada jabatan yang punya petugas pada periode ini."
          />

          {/* ====== tingkat 3: per petugas (bisa disembunyikan) ====== */}
          <div className="kartu overflow-hidden">
            <div className="border-b border-abu-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-abu-800">Nilai per Petugas</h3>
                <p className="mt-0.5 text-xs text-abu-400">
                  {tampilPetugas
                    ? `${petugasTersaring.length} petugas ditampilkan`
                    : 'Disembunyikan — daftar ini bisa memuat puluhan baris di level Kanwil.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {tampilPetugas && (
                  <input
                    type="search"
                    value={cari}
                    onChange={(e) => setCari(e.target.value)}
                    placeholder="Cari nama petugas…"
                    className="w-44 rounded-md border border-abu-300 bg-white px-3 py-1.5 text-xs text-abu-800 focus:border-btn-biru-500 focus:ring-2 focus:ring-btn-biru-500/20 focus:outline-none"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setTampilPetugas((v) => !v)}
                  aria-expanded={tampilPetugas}
                  className="inline-flex items-center gap-2 rounded-md border border-abu-300 bg-white px-3 py-1.5 text-xs font-medium text-abu-700 hover:bg-abu-50 transition-colors"
                >
                  <svg
                    className={`h-3.5 w-3.5 transition-transform ${tampilPetugas ? '' : '-rotate-90'}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {tampilPetugas ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
            </div>

            {tampilPetugas && (
              <div className="px-6 py-5">
                {petugasTersaring.length === 0 ? (
                  <p className="py-6 text-center text-sm text-abu-400">
                    {cari
                      ? `Tidak ada petugas yang cocok dengan "${cari}".`
                      : 'Tidak ada penilaian petugas pada periode & filter ini.'}
                  </p>
                ) : (
                  <DaftarBatang batang={petugasTersaring} />
                )}
              </div>
            )}
          </div>

          <Legenda />
        </>
      )}
    </div>
  );
}

function Kotak({ label, nilai, keterangan }: { label: string; nilai: string; keterangan?: string }) {
  return (
    <div className="kartu p-4">
      <div className="label-kolom">{label}</div>
      <div className="mt-1 text-sm font-semibold text-abu-900 truncate">{nilai}</div>
      {keterangan && <div className="mt-0.5 text-xs text-abu-400 truncate">{keterangan}</div>}
    </div>
  );
}

function PanelGrafik({
  judul,
  deskripsi,
  batang,
  kosong,
}: {
  judul: string;
  deskripsi: string;
  batang: BatangNilai[];
  kosong: string;
}) {
  return (
    <div className="kartu overflow-hidden">
      <div className="border-b border-abu-200 px-6 py-4">
        <h3 className="text-sm font-semibold text-abu-800">{judul}</h3>
        <p className="mt-0.5 text-xs text-abu-400">{deskripsi}</p>
      </div>
      <div className="px-6 py-5">
        {batang.length === 0 ? (
          <p className="py-6 text-center text-sm text-abu-400">{kosong}</p>
        ) : (
          <DaftarBatang batang={batang} tampilKeterangan />
        )}
      </div>
    </div>
  );
}

/** Satu baris grafik: label | batang | angka + kategori. */
function DaftarBatang({
  batang,
  tampilKeterangan = false,
}: {
  batang: BatangNilai[];
  tampilKeterangan?: boolean;
}) {
  return (
    <div>
      {/* garis skala di atas, supaya panjang batang bisa dibaca sebagai angka */}
      <div className="mb-2 flex items-center gap-3">
        <div className="w-40 sm:w-52 shrink-0" />
        <div className="relative flex-1 h-4">
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="absolute top-0 h-full border-l border-abu-200"
              style={{ left: `${(n / SKALA_MAKS) * 100}%` }}
            >
              <span className="absolute -top-0.5 left-1 text-[10px] text-abu-300 tabular-nums">
                {n}
              </span>
            </div>
          ))}
        </div>
        <div className="w-24 shrink-0" />
      </div>

      <div className="space-y-2">
        {batang.map((b) => {
          const persen = Math.min(100, (b.nilai / SKALA_MAKS) * 100);
          const rating = b.jumlah === 0 ? null : labelRating(b.nilai);
          return (
            <div key={b.kunci} className="group flex items-center gap-3">
              <div className="w-40 sm:w-52 shrink-0 min-w-0">
                <div className="truncate text-xs font-medium text-abu-800" title={b.label}>
                  {b.label}
                </div>
                {tampilKeterangan && b.keterangan && (
                  <div className="truncate text-[10px] text-abu-400" title={b.keterangan}>
                    {b.keterangan}
                  </div>
                )}
              </div>

              <div className="relative flex-1 h-6 rounded bg-abu-50 overflow-hidden">
                {rating === null ? (
                  <div className="h-full w-full rounded border border-dashed border-abu-300" />
                ) : (
                  <div
                    className={`h-full rounded-r transition-all ${warnaBatang(b.nilai)}`}
                    style={{ width: `${persen}%` }}
                    title={`${b.label} — ${b.nilai.toFixed(2).replace('.', ',')} (${rating})`}
                  />
                )}
              </div>

              <div className="w-24 shrink-0 flex items-center justify-end gap-1.5">
                {rating === null ? (
                  <span className="text-[10px] text-abu-400">belum dinilai</span>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-abu-900 tabular-nums">
                      {b.nilai.toFixed(2).replace('.', ',')}
                    </span>
                    <span
                      className={`hidden sm:inline text-[10px] ${WARNA_TEKS_RATING[rating] ?? 'text-abu-400'}`}
                    >
                      {rating}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Legenda kategori — sekali saja untuk seluruh halaman, bukan per grafik. */
function Legenda() {
  return (
    <div className="kartu px-6 py-4 flex flex-wrap items-center gap-x-5 gap-y-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-abu-400">
        Kategori nilai
      </span>
      {[
        ['Istimewa', 'bg-rating-istimewa', '4,80 – 5,00'],
        ['Sangat Baik', 'bg-rating-sangat-baik', '4,60 – 4,79'],
        ['Baik', 'bg-rating-baik', '4,00 – 4,59'],
        ['Cukup', 'bg-peringatan', '3,60 – 3,99'],
        ['Kurang', 'bg-bahaya', '0,00 – 3,59'],
      ].map(([teks, warna, rentang]) => (
        <span key={teks} className="inline-flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm ${warna}`} />
          <span className="text-[11px] text-abu-600">
            {teks} <span className="text-abu-400 tabular-nums">{rentang}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
