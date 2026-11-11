import type { BarisRekap } from './ekspor';

export type PegawaiLaporan = { nama: string; nip: string; jabatan: string | null; cabang: string };

export function gabungkanPegawaiBelumDinilai(
  baris: BarisRekap[],
  pegawai: PegawaiLaporan[],
): BarisRekap[] {
  const ada = new Set(baris.map((b) => b.nip));
  const lengkap = [
    ...baris,
    ...pegawai.filter((p) => !ada.has(p.nip)).map((p): BarisRekap => ({
      rank: 0,
      nama: p.nama,
      nip: p.nip,
      jabatan: p.jabatan ?? '-',
      cabang: p.cabang,
      penampilan: null,
      kemampuan: null,
      sikap: null,
      nilaiAkhir: null,
      rating: '-',
      status: 'BELUM DINILAI',
    })),
  ];
  return lengkap
    .sort((a, b) => (b.nilaiAkhir ?? -1) - (a.nilaiAkhir ?? -1) || a.nama.localeCompare(b.nama))
    .map((b, i) => ({ ...b, rank: i + 1 }));
}

export function hitungRingkasanPenilaian(baris: BarisRekap[]) {
  const dinilai = baris.filter((b) => b.nilaiAkhir !== null);
  const nilai = dinilai.map((b) => b.nilaiAkhir!);
  const sebaran: Record<string, number> = {};
  for (const b of dinilai) sebaran[b.rating] = (sebaran[b.rating] ?? 0) + 1;
  return {
    jumlahDinilai: dinilai.length,
    rataRata: nilai.length ? nilai.reduce((a, b) => a + b, 0) / nilai.length : 0,
    tertinggi: dinilai[0] ? { nama: dinilai[0].nama, nilai: dinilai[0].nilaiAkhir! } : null,
    terendah: dinilai.length ? { nama: dinilai[dinilai.length - 1].nama, nilai: dinilai[dinilai.length - 1].nilaiAkhir! } : null,
    sebaran,
  };
}
