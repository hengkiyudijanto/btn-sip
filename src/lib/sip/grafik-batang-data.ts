/**
 * Data grafik batang dasbor: nilai per kantor, per jabatan, dan per petugas.
 *
 * Semua angka dihitung di server dari baris penilaian nyata. Tiga tingkat
 * tampilan yang bisa dinyalakan/dimatikan sendiri:
 *
 *   tingkat 1  unit/cabang   — batang per unit dalam cakupan kantor terpilih
 *   tingkat 2  jabatan       — batang per jabatan (Teller, CS, …)
 *   tingkat 3  petugas       — batang per orang (bisa puluhan di level Kanwil)
 *
 * Filter mengikuti aturan aplikasi yang sudah ada:
 *   - `kumpulkanTurunan()` dari `src/lib/sip/hierarki.ts` → memilih satu unit
 *     otomatis mencakup seluruh turunannya (Kanwil > KC > KCP).
 *   - Cakupan peran: admin & manager melihat pilihannya, supervisor/pegawai
 *     terkunci di cabangnya sendiri.
 */

import { prisma } from '@/lib/db';
import type { PegawaiSesi } from '@/lib/auth';
import { kumpulkanTurunan } from '@/lib/sip/hierarki';
import { boleh } from '@/lib/sip/akses';

export type BatangNilai = {
  /** kunci stabil untuk React */
  kunci: string;
  /** label utama yang dicetak di sebelah batang */
  label: string;
  /** keterangan kecil di bawah label (jumlah orang / jumlah penilaian) */
  keterangan: string;
  nilai: number;
  jumlah: number;
  /** nama petugas asli, untuk filter pencarian di sisi klien */
  petugas?: string;
  /** kode jabatan, untuk penyaringan cepat */
  jabatanKode?: string;
  /** kode unit, untuk penyaringan cepat */
  unitKode?: string;
};

export type OpsiUnit = {
  kode: string;
  nama: string;
  jenis: string;
  /** kedalaman indentasi di dropdown (0 = Kanwil) */
  tingkat: number;
  jumlahPegawai: number;
};

export type OpsiJabatan = { kode: string; nama: string; jumlahPegawai: number };

export type DataGrafikBatang = {
  periode: { id: string; nama: string } | null;
  /** unit yang sedang dipilih ('' = semua dalam cakupan) */
  unitTerpilih: string;
  jabatanTerpilih: string;
  opsiUnit: OpsiUnit[];
  opsiJabatan: OpsiJabatan[];
  /** batang per unit dalam cakupan kantor terpilih */
  perUnit: BatangNilai[];
  perJabatan: BatangNilai[];
  perPetugas: BatangNilai[];
  /** jumlah petugas yang sudah punya nilai di cakupan ini */
  jumlahDinilai: number;
  /** jumlah seluruh petugas aktif di cakupan ini */
  jumlahPetugas: number;
};

/** Jabatan yang tidak punya pegawai tidak perlu jadi batang kosong. */
const MIN_PEGAWAI_JABATAN = 1;

export async function ambilDataGrafikBatang(
  saya: PegawaiSesi,
  opts: { periodeId?: string; unit?: string; jabatan?: string }
): Promise<DataGrafikBatang> {
  const kosong: DataGrafikBatang = {
    periode: null,
    unitTerpilih: '',
    jabatanTerpilih: '',
    opsiUnit: [],
    opsiJabatan: [],
    perUnit: [],
    perJabatan: [],
    perPetugas: [],
    jumlahDinilai: 0,
    jumlahPetugas: 0,
  };

  // ===== 1. periode =====
  // Pakai periode yang diminta; kalau tidak ada, periode yang punya penilaian
  // bernilai paling akhir — supaya grafik tidak terbuka dalam keadaan kosong
  // hanya karena periode berjalan belum diisi.
  const periode =
    (opts.periodeId
      ? await prisma.periode.findUnique({ where: { id: opts.periodeId } })
      : null) ??
    (await prisma.periode.findFirst({
      where: { penilaian: { some: { nilaiAkhir: { not: null } } } },
      orderBy: { tanggalMulai: 'desc' },
    })) ??
    (await prisma.periode.findFirst({ orderBy: { tanggalMulai: 'desc' } }));
  if (!periode) return kosong;

  // ===== 2. cakupan kantor =====
  // Peran selain admin terkunci di cabangnya sendiri — sama seperti halaman lain.
  const cakupanSemua = boleh(saya.role, 'lihat_semua_cabang');
  const bolehPilihUnit = cakupanSemua;
  // Cabang akar: null = tidak dibatasi (semua unit), selain itu dikunci ke
  // kode cabangnya. Sebelumnya `bolehPilihUnit` dipakai untuk dua hal
  // sekaligus sehingga peran tanpa hak pilih unit ikut terlihat bisa memilih.
  const cabangAkar = cakupanSemua ? null : saya.cabang.kode;

  // Admin boleh memilih unit mana pun; manager/supervisor hanya di bawah cabangnya.
  let kodeTerpilih = (opts.unit ?? '').trim();
  if (!kodeTerpilih) kodeTerpilih = cabangAkar ?? '';

  const semuaCabang = await prisma.cabang.findMany({
    where: { aktif: true },
    include: { _count: { select: { pegawai: { where: { aktif: true, role: 'PEGAWAI' } } } } },
  });
  const petaCabang = new Map(semuaCabang.map((c) => [c.kode, c]));

  // Validasi pilihan: kalau di luar wewenang, kembali ke cakupan semula.
  if (kodeTerpilih && cabangAkar && !bolehPilihUnit) kodeTerpilih = cabangAkar;
  if (kodeTerpilih && !petaCabang.has(kodeTerpilih)) kodeTerpilih = cabangAkar ?? '';

  // kumpulkanTurunan mengembalikan **id** cabang (termasuk yang dipilih),
  // bukan kode — jadi pemetaannya harus lewat id, bukan kode.
  const kodeCakupan = kodeTerpilih
    ? (() => {
        const akar = semuaCabang.find((c) => c.kode === kodeTerpilih);
        if (!akar) return null;
        const ids = new Set(
          kumpulkanTurunan(akar.id, semuaCabang.map((c) => ({ id: c.id, indukId: c.indukId })))
        );
        return semuaCabang.filter((c) => ids.has(c.id)).map((c) => c.kode);
      })()
    : null;
  const cakupanKode = kodeCakupan ?? semuaCabang.map((c) => c.kode);
  const idCakupan = semuaCabang.filter((c) => cakupanKode.includes(c.kode)).map((c) => c.id);

  // ===== 3. opsi filter =====
  const opsiUnit: OpsiUnit[] = [];
  const akarUntukOpsi = bolehPilihUnit
    ? semuaCabang.filter((c) => (cabangAkar ? c.kode === cabangAkar : c.indukId === null))
    : semuaCabang.filter((c) => c.kode === cabangAkar);

  const urutkanHierarki = (id: string, tingkat: number) => {
    const c = semuaCabang.find((x) => x.id === id);
    if (!c) return;
    opsiUnit.push({
      kode: c.kode,
      nama: c.nama,
      jenis: c.jenis,
      tingkat,
      jumlahPegawai: c._count.pegawai,
    });
    for (const t of semuaCabang.filter((x) => x.indukId === id)) urutkanHierarki(t.id, tingkat + 1);
  };
  for (const c of akarUntukOpsi) urutkanHierarki(c.id, 0);

  // ===== 4. penilaian pada cakupan & periode =====
  const penilaian = await prisma.penilaian.findMany({
    where: {
      periodeId: periode.id,
      pegawai: { cabangId: { in: idCakupan } },
    },
    include: {
      pegawai: {
        include: { cabang: { select: { kode: true, nama: true } }, jabatan: { select: { kode: true, nama: true } } },
      },
    },
  });

  const semuaPegawai = await prisma.pegawai.findMany({
    where: { aktif: true, role: 'PEGAWAI', cabangId: { in: idCakupan } },
    include: { cabang: { select: { kode: true } }, jabatan: { select: { kode: true, nama: true } } },
  });

  // Jabatan yang benar-benar dipakai di cakupan ini (bukan semua jabatan master)
  const petaJabatan = new Map<string, { nama: string; jumlah: number }>();
  for (const p of semuaPegawai) {
    const kode = p.jabatan?.kode ?? 'TANPA_JABATAN';
    const nama = p.jabatan?.nama ?? 'Tanpa jabatan';
    const ada = petaJabatan.get(kode) ?? { nama, jumlah: 0 };
    ada.jumlah += 1;
    petaJabatan.set(kode, ada);
  }
  const opsiJabatan: OpsiJabatan[] = [...petaJabatan.entries()]
    .filter(([, v]) => v.jumlah >= MIN_PEGAWAI_JABATAN)
    .map(([kode, v]) => ({ kode, nama: v.nama, jumlahPegawai: v.jumlah }))
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));

  // Filter jabatan hanya memengaruhi tingkat petugas; tingkat unit & jabatan
  // tetap menampilkan gambaran utuh supaya pembanding tidak hilang.
  const kodeJabatan = (opts.jabatan ?? '').trim();

  const bernilai = penilaian.filter((p) => p.nilaiAkhir != null);

  // ===== 5. batang per unit =====
  // Saat "Semua unit" dipilih, batangnya adalah unit AKAR (Kanwil) — dan
  // seluruh pegawai di bawahnya digabungkan ke situ. Menggabungkan lewat
  // `unitTerdekat()` penting: pegawai di KCP yang tidak punya batang sendiri
  // tetap ikut terhitung di induknya, bukan hilang dari grafik.
  const satuanUnit = kodeTerpilih
    ? kumpulkanAnakLangsung(kodeTerpilih, semuaCabang)
    : semuaCabang.filter((c) => c.indukId === null).map((c) => c.kode);

  const petaUnit = new Map<string, { nilai: number[]; nama: string }>();
  for (const kode of satuanUnit) {
    const c = petaCabang.get(kode);
    if (c) petaUnit.set(kode, { nilai: [], nama: c.nama });
  }
  for (const p of bernilai) {
    // masukkan ke unit terdekat yang termasuk himpunan batang
    const kode = unitTerdekat(p.pegawai.cabang.kode, satuanUnit, semuaCabang);
    if (!kode) continue;
    petaUnit.get(kode)!.nilai.push(p.nilaiAkhir!);
  }

  const perUnit: BatangNilai[] = [...petaUnit.entries()]
    .map(([kode, v]) => ({
      kunci: `unit-${kode}`,
      label: kode,
      keterangan: `${v.nama} · ${v.nilai.length} dinilai`,
      nilai: rata(v.nilai),
      jumlah: v.nilai.length,
      unitKode: kode,
    }))
    .filter((b) => b.jumlah > 0)
    .sort((a, b) => b.nilai - a.nilai);

  // ===== 6. batang per jabatan =====
  // Jabatan TANPA penilaian di periode ini tetap ditampilkan (nilai 0 batang
  // kosong, ditandai "belum ada nilai") — kalau hanya jabatan yang ada
  // nilainya yang muncul, judul "per jabatan" jadi menyesatkan karena
  // pembandingnya hilang dan tidak ada yang tahu mana yang belum dinilai.
  const petaJab = new Map<string, { nama: string; nilai: number[]; pegawai: number }>();
  for (const [kode, info] of petaJabatan) {
    petaJab.set(kode, { nama: info.nama, nilai: [], pegawai: info.jumlah });
  }
  for (const p of bernilai) {
    const kode = p.pegawai.jabatan?.kode ?? 'TANPA_JABATAN';
    const nama = p.pegawai.jabatan?.nama ?? 'Tanpa jabatan';
    const ada = petaJab.get(kode) ?? { nama, nilai: [], pegawai: 0 };
    ada.nilai.push(p.nilaiAkhir!);
    petaJab.set(kode, ada);
  }
  const perJabatan: BatangNilai[] = [...petaJab.entries()]
    .map(([kode, v]) => ({
      kunci: `jab-${kode}`,
      label: v.nama,
      keterangan:
        v.nilai.length > 0
          ? `${v.nilai.length} dinilai dari ${v.pegawai} petugas`
          : `${v.pegawai} petugas · belum ada nilai`,
      nilai: rata(v.nilai),
      jumlah: v.nilai.length,
      jabatanKode: kode,
    }))
    .sort((a, b) => {
      // yang sudah dinilai lebih dulu, lalu yang paling tinggi
      if ((b.jumlah > 0 ? 1 : 0) !== (a.jumlah > 0 ? 1 : 0)) return (b.jumlah > 0 ? 1 : 0) - (a.jumlah > 0 ? 1 : 0);
      return b.nilai - a.nilai;
    });

  // ===== 7. batang per petugas =====
  const perPetugas: BatangNilai[] = bernilai
    .filter((p) => !kodeJabatan || (p.pegawai.jabatan?.kode ?? 'TANPA_JABATAN') === kodeJabatan)
    .map((p) => ({
      kunci: `org-${p.id}`,
      label: p.pegawai.nama,
      keterangan: `${p.pegawai.jabatan?.nama ?? 'Tanpa jabatan'} · ${p.pegawai.cabang.kode}`,
      nilai: p.nilaiAkhir!,
      jumlah: 1,
      petugas: p.pegawai.nama,
      jabatanKode: p.pegawai.jabatan?.kode ?? 'TANPA_JABATAN',
      unitKode: p.pegawai.cabang.kode,
    }))
    .sort((a, b) => b.nilai - a.nilai);

  return {
    periode: { id: periode.id, nama: periode.nama },
    unitTerpilih: kodeTerpilih,
    jabatanTerpilih: kodeJabatan,
    opsiUnit,
    opsiJabatan,
    perUnit,
    perJabatan,
    perPetugas,
    jumlahDinilai: bernilai.length,
    jumlahPetugas: semuaPegawai.length,
  };
}

type CabangRingkas = {
  id: string;
  kode: string;
  nama: string;
  jenis: string;
  indukId: string | null;
};

/** Anak langsung dari sebuah kode unit (untuk memecah batang per unit). */
function kumpulkanAnakLangsung(kode: string, semua: CabangRingkas[]): string[] {
  const induk = semua.find((c) => c.kode === kode);
  if (!induk) return [kode];
  return [kode, ...semua.filter((c) => c.indukId === induk.id).map((c) => c.kode)];
}

/**
 * Unit "terdekat" dari sebuah kode cabang yang termasuk himpunan batang.
 * Pegawai di KCP yang batangnya tidak ditampilkan akan disatukan ke KC induknya,
 * bukan dibuang — kalau dibuang, angka KC akan lebih kecil dari kenyataan.
 */
function unitTerdekat(
  kodePegawai: string,
  himpunan: string[],
  semua: CabangRingkas[]
): string | null {
  if (himpunan.includes(kodePegawai)) return kodePegawai;
  let sekarang = semua.find((c) => c.kode === kodePegawai);
  let penjaga = 0;
  while (sekarang?.indukId && penjaga++ < 10) {
    const induk = semua.find((c) => c.id === sekarang!.indukId);
    if (!induk) break;
    if (himpunan.includes(induk.kode)) return induk.kode;
    sekarang = induk;
  }
  return null;
}

/** Rata-rata, dibulatkan dua desimal. Pemanggil menjamin array tidak kosong. */
function rata(nilai: number[]): number {
  if (nilai.length === 0) return 0;
  return Math.round((nilai.reduce((a, b) => a + b, 0) / nilai.length) * 100) / 100;
}

/** Ambang minimum batang per petugas — 1 berarti selalu tampil (keputusan user). */
export const MIN_BATANG_PETUGAS = 1;
