/**
 * Logo aplikasi: tulisan "SIP" dengan aksen miring merah.
 *
 * SVG (bukan raster) supaya tajam di semua ukuran. Warnanya mewarisi
 * `currentColor`, jadi di sidebar gelap tampil putih dan di halaman terang biru.
 *
 * Bentuk huruf: batang lurus berujung datar + busur lingkaran setebal batang.
 * Sumber bentuknya satu, dipakai bersama oleh renderer SVG server
 * (`src/lib/sip/logo-sip.ts`) untuk laporan cetak/PPTX.
 */
export const LOGO_SIP_WARNA = {
  huruf: '#005bfd',
  aksen: '#ff0000',
} as const;

/** Garis atas (x-height), garis dasar, dan tebal batang. */
const ATAS = 9;
const BAWAH = 32.5;
const TEBAL = 7;

/** Garis lurus: [x1, y1, x2, y2]. */
export const BENTUK_LURUS: [number, number, number, number][] = [
  // huruf s: ujung silang atas & bawah
  [21.9, ATAS, 24.8, ATAS],
  [4.5, 21.8, 2.4, 21.8],
  // huruf i: batang + titik
  [35, ATAS + 7, 35, BAWAH],
  [35, ATAS, 35, ATAS + 5],
  // huruf p: batang turun di bawah garis dasar
  [43.2, ATAS, 43.2, 40],
];

/** Busur setengah lingkaran: [pusatX, pusatY, radius]. */
export const BENTUK_BUSUR: [number, number, number][] = [
  // lengkung atas & bawah huruf s
  [16.05, 15.6, 5.6],
  [16.05, 25.9, 5.6],
  // cincin huruf p
  [52, 24.5, 5.2],
];

/** Garis tepi tiap busur untuk `path` SVG (bukan stroke). */
export function busurPath(cx: number, cy: number, r: number, tebal = TEBAL) {
  const luar = r + tebal / 2;
  const dalam = r - tebal / 2;
  return [
    `M ${cx - luar} ${cy}`,
    `A ${luar} ${luar} 0 0 1 ${cx + luar} ${cy}`,
    `L ${cx + dalam} ${cy}`,
    `A ${dalam} ${dalam} 0 0 0 ${cx - dalam} ${cy}`,
    'Z',
  ].join(' ');
}

export const LOGO_SIP_TEBAL = TEBAL;

export function LogoSIP({
  tinggi = 32,
  className = '',
  aksen = LOGO_SIP_WARNA.aksen,
}: {
  tinggi?: number;
  className?: string;
  /** Warna aksen miring. */
  aksen?: string;
}) {
  // viewBox 96 x 40 → lebar mengikuti tinggi agar rasio tetap.
  return (
    <svg
      viewBox="0 0 96 40"
      height={tinggi}
      width={Math.round((tinggi * 96) / 40)}
      role="img"
      aria-label="SIP"
      className={`shrink-0 ${className}`}
    >
      <g fill="currentColor" stroke="currentColor" strokeWidth={TEBAL}>
        {BENTUK_BUSUR.map(([cx, cy, r]) => (
          <path key={`b${cx}-${cy}`} d={busurPath(cx, cy, r)} />
        ))}
        {BENTUK_LURUS.map(([x1, y1, x2, y2]) => (
          <line key={`l${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {/* aksen miring di atas huruf p */}
      <path d="M55.5 15.5 81.5 1.2 85.8 9.5 59.8 23.8z" fill={aksen} />
    </svg>
  );
}
