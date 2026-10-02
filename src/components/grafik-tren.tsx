/**
 * Grafik tren nilai — SVG yang digambar dari data nyata, tanpa pustaka grafik.
 *
 * Alasannya: satu grafik garis sederhana tidak sebanding dengan menambahkan
 * dependensi baru (dan bobot bundelnya) ke aplikasi internal ini, sementara
 * SVG bisa dibuat persis sesuai warna korporat BTN.
 *
 * Aturan gambar:
 * - Sumbu Y SELALU 0–5 (skala penilaian penuh), bukan 3,5–5. Kalau dipotong,
 *   selisih kecil terlihat dramatis dan itu menyesatkan pembaca laporan.
 * - Titik tanpa data (periode kosong) DILEWATI, garisnya diputus — bukan
 *   dijatuhkan ke nol.
 * - Label sumbu X hanya ditampilkan sebagian supaya tidak bertumpuk.
 */

import type { TitikTren } from '@/lib/sip/tren';

const LEBAR = 720;
const TINGGI = 220;
const PAD_KIRI = 34;
const PAD_KANAN = 12;
const PAD_ATAS = 14;
const PAD_BAWAH = 30;

const AREA_LEBAR = LEBAR - PAD_KIRI - PAD_KANAN;

const WARNA_GARIS = '#0322B8';
const WARNA_GRID = '#e2e8f0';
const WARNA_TEKS = '#94a3b8';

export function GrafikTren({
  titik,
  judul,
  tinggi = TINGGI,
}: {
  titik: TitikTren[];
  judul: string;
  tinggi?: number;
}) {
  if (titik.length === 0) {
    return (
      <p className="text-sm text-abu-400">
        Belum ada periode penilaian yang bisa digambarkan.
      </p>
    );
  }

  const skalaTinggi = tinggi - PAD_ATAS - PAD_BAWAH;
  const y = (nilai: number) => PAD_ATAS + skalaTinggi * (1 - nilai / 5);
  const x = (i: number) =>
    titik.length === 1
      ? PAD_KIRI + AREA_LEBAR / 2
      : PAD_KIRI + (AREA_LEBAR * i) / (titik.length - 1);

  // Pecah titik jadi segmen bersambung: periode kosong memutus garis.
  const segmen: { i: number; nilai: number }[][] = [];
  let jalan: { i: number; nilai: number }[] = [];
  titik.forEach((t, i) => {
    if (t.nilai === null) {
      if (jalan.length) segmen.push(jalan);
      jalan = [];
    } else {
      jalan.push({ i, nilai: t.nilai });
    }
  });
  if (jalan.length) segmen.push(jalan);

  // label sumbu X: tampilkan paling banyak 8 label supaya tidak bertumpuk
  const lompat = Math.max(1, Math.ceil(titik.length / 8));

  const adaData = titik.some((t) => t.nilai !== null);

  return (
    <div>
      <svg
        viewBox={`0 0 ${LEBAR} ${tinggi}`}
        className="w-full h-auto"
        role="img"
        aria-label={judul}
      >
        {/* garis bantu 0..5 */}
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <g key={n}>
            <line
              x1={PAD_KIRI}
              x2={LEBAR - PAD_KANAN}
              y1={y(n)}
              y2={y(n)}
              stroke={WARNA_GRID}
              strokeWidth={n === 0 ? 1.2 : 0.8}
            />
            <text x={PAD_KIRI - 6} y={y(n) + 3.5} textAnchor="end" fontSize={9} fill={WARNA_TEKS}>
              {n}
            </text>
          </g>
        ))}

        {/* garis tren per segmen */}
        {segmen.map((seg, s) => (
          <polyline
            key={s}
            points={seg.map((p) => `${x(p.i)},${y(p.nilai)}`).join(' ')}
            fill="none"
            stroke={WARNA_GARIS}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* titik + nilai */}
        {titik.map((t, i) =>
          t.nilai === null ? null : (
            <g key={i}>
              <circle cx={x(i)} cy={y(t.nilai)} r={3.2} fill="#fff" stroke={WARNA_GARIS} strokeWidth={2} />
              <text
                x={x(i)}
                y={y(t.nilai) - 8}
                textAnchor="middle"
                fontSize={9.5}
                fontWeight={600}
                fill="#334155"
              >
                {t.nilai.toFixed(2).replace('.', ',')}
              </text>
            </g>
          )
        )}

        {/* penanda periode kosong */}
        {titik.map((t, i) =>
          t.nilai === null ? (
            <text key={`k${i}`} x={x(i)} y={PAD_ATAS + skalaTinggi} textAnchor="middle" fontSize={9} fill="#cbd5e1">
              tidak ada data
            </text>
          ) : null
        )}

        {/* label sumbu X */}
        {titik.map((t, i) =>
          i % lompat === 0 || i === titik.length - 1 ? (
            <text
              key={`x${i}`}
              x={x(i)}
              y={tinggi - 8}
              textAnchor="middle"
              fontSize={9}
              fill={WARNA_TEKS}
            >
              {t.label}
            </text>
          ) : null
        )}
      </svg>

      {!adaData && (
        <p className="mt-1 text-xs text-abu-400">
          Semua periode pada rentang ini belum punya penilaian.
        </p>
      )}
    </div>
  );
}
