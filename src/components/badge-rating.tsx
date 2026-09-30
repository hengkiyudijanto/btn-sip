import type { PerformanceBand } from '@/lib/sip/penilaian';

/**
 * Label rating kinerja dengan warna semantik.
 * Dipakai di seluruh aplikasi supaya konsisten.
 */
const GAYA: Record<string, { teks: string; bg: string; titik: string }> = {
  Istimewa: {
    teks: 'text-[#047857]',
    bg: 'bg-[#d1fae5]',
    titik: '#047857',
  },
  'Sangat Baik': {
    teks: 'text-[#0369a1]',
    bg: 'bg-[#e0f2fe]',
    titik: '#0369a1',
  },
  Baik: {
    teks: 'text-[#4f46e5]',
    bg: 'bg-[#e0e7ff]',
    titik: '#4f46e5',
  },
  Cukup: {
    teks: 'text-[#b45309]',
    bg: 'bg-[#fef3c7]',
    titik: '#b45309',
  },
  Kurang: {
    teks: 'text-[#b91c1c]',
    bg: 'bg-[#fee2e2]',
    titik: '#b91c1c',
  },
};

export function BadgeRating({
  rating,
  nilai,
  ukuran = 'sedang',
}: {
  rating: PerformanceBand | string;
  nilai?: number;
  ukuran?: 'kecil' | 'sedang' | 'besar';
}) {
  const label = typeof rating === 'string' ? rating : rating.label;
  const gaya = GAYA[label] ?? GAYA['Baik'];

  const kelas =
    ukuran === 'kecil'
      ? 'text-[11px] px-2 py-0.5 gap-1'
      : ukuran === 'besar'
        ? 'text-sm px-3.5 py-1.5 gap-2 font-semibold'
        : 'text-xs px-2.5 py-1 gap-1.5 font-medium';

  return (
    <span
      className={`inline-flex items-center rounded-full ${gaya.bg} ${gaya.teks} ${kelas} whitespace-nowrap`}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: gaya.titik }}
      />
      {label}
      {nilai !== undefined && (
        <span className="opacity-75 font-normal tabular-nums">
          {nilai.toFixed(2)}
        </span>
      )}
    </span>
  );
}
