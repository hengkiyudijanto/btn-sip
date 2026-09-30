'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export type OpsiPeriode = {
  id: string;
  nama: string;
  aktif: boolean;
  tanggalMulai: Date | string;
  tanggalSelesai: Date | string;
};

/** Apakah periode ini memuat tanggal hari ini */
function sedangBerjalan(p: OpsiPeriode, hariIni: Date) {
  const m = new Date(p.tanggalMulai);
  const s = new Date(p.tanggalSelesai);
  return hariIni >= m && hariIni <= s;
}

/** Sudah lewat? */
function sudahLewat(p: OpsiPeriode, hariIni: Date) {
  return hariIni > new Date(p.tanggalSelesai);
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Pemilih periode untuk halaman penilaian.
 *
 * Menampilkan peringatan bila periode yang dipilih TIDAK sesuai dengan
 * bulan berjalan — misalnya atasan memilih periode bulan lalu, atau
 * periode yang belum dimulai. Ini mencegah penilaian masuk ke periode
 * yang salah, yang sulit dibatalkan setelah atasan menandatangani cetakan.
 */
export function PemilihPeriode({
  daftar,
  terpilihId,
  dikunci,
}: {
  daftar: OpsiPeriode[];
  terpilihId: string;
  dikunci: boolean;
}) {
  const router = useRouter();
  const [pilihan, setPilihan] = useState(terpilihId);

  const hariIni = new Date();
  const terpilih = daftar.find((p) => p.id === pilihan);
  const berjalan = terpilih ? sedangBerjalan(terpilih, hariIni) : false;
  const lewat = terpilih ? sudahLewat(terpilih, hariIni) : false;
  const belumMulai = terpilih && !berjalan && !lewat;

  const bulanSekarang = BULAN[hariIni.getMonth()];
  const tahunSekarang = hariIni.getFullYear();
  const bulanPeriode = terpilih ? BULAN[new Date(terpilih.tanggalMulai).getMonth()] : '';

  const bulanBerbeda = terpilih && bulanPeriode !== bulanSekarang;

  const ubah = (id: string) => {
    setPilihan(id);
    router.push(`/penilaian?periode=${id}`);
  };

  const fmt = (t: Date | string) =>
    new Date(t).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="kartu p-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[260px]">
          <label htmlFor="pilihPeriode" className="block label-kolom mb-1.5">
            Periode yang dinilai
          </label>
          <select
            id="pilihPeriode"
            value={pilihan}
            onChange={(e) => ubah(e.target.value)}
            className="w-full rounded-lg border border-abu-300 bg-white px-3 py-2 text-sm focus:border-btn-biru-500 focus:outline-none"
          >
            {daftar.map((p) => (
              <option key={p.id} value={p.id} disabled={!p.aktif}>
                {p.nama}
                {!p.aktif ? ' (nonaktif)' : sedangBerjalan(p, hariIni) ? ' — berjalan' : ''}
              </option>
            ))}
          </select>
        </div>

        {terpilih && (
          <div className="text-xs text-abu-500 tabular-nums pb-2">
            {fmt(terpilih.tanggalMulai)} – {fmt(terpilih.tanggalSelesai)}
          </div>
        )}
      </div>

      {/* ===== peringatan: periode bukan bulan berjalan ===== */}
      {bulanBerbeda && !berjalan && (
        <div className="mt-3 rounded-lg border border-peringatan/30 bg-peringatan-bg px-3.5 py-2.5 text-xs leading-relaxed text-peringatan">
          <strong>⚠ Periode ini bukan periode bulan berjalan.</strong>
          <span className="block mt-1">
            Sekarang <strong>{bulanSekarang} {tahunSekarang}</strong>, sedangkan periode
            yang dipilih adalah <strong>{bulanPeriode}</strong>
            {lewat ? ' yang sudah lewat' : ' yang belum dimulai'}. Pastikan ini memang
            periode yang ingin dinilai — penilaian yang tersimpan akan tercatat pada
            periode tersebut.
          </span>
        </div>
      )}

      {/* ===== peringatan: periode belum dimulai ===== */}
      {belumMulai && !bulanBerbeda && (
        <div className="mt-3 rounded-lg border border-peringatan/30 bg-peringatan-bg px-3.5 py-2.5 text-xs leading-relaxed text-peringatan">
          <strong>⚠ Periode ini belum dimulai.</strong> Penilaian biasanya dilakukan
          setelah periode berjalan.
        </div>
      )}

      {/* ===== peringatan: periode sudah lewat ===== */}
      {lewat && !bulanBerbeda && (
        <div className="mt-3 rounded-lg border border-peringatan/30 bg-peringatan-bg px-3.5 py-2.5 text-xs leading-relaxed text-peringatan">
          <strong>⚠ Periode ini sudah lewat.</strong> Pastikan penilaian memang untuk
          periode ini, bukan periode yang sedang berjalan.
        </div>
      )}

      {/* ===== informasi: periode terkunci ===== */}
      {dikunci && (
        <div className="mt-3 rounded-lg border border-abu-300 bg-abu-100 px-3.5 py-2.5 text-xs leading-relaxed text-abu-600">
          <strong>🔒 Periode ini terkunci.</strong> Penilaian tidak dapat diubah lagi,
          termasuk oleh admin. Buka kunci di menu Periode bila memang perlu revisi.
        </div>
      )}

      {/* ===== keterangan tambahan ===== */}
      <p className="mt-3 text-[11px] text-abu-400 leading-relaxed">
        Kalau petugas sudah dinilai pada periode ini, tombol penilaian akan berubah
        menjadi <strong>Ubah</strong>. Data lama tidak hilang — yang tersimpan adalah
        nilai terakhir, dan setiap perubahan tercatat di audit log.
      </p>
    </div>
  );
}
