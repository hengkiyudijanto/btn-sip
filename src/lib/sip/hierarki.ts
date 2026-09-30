/**
 * Utilitas hierarki cabang.
 *
 * Struktur BTN: Kanwil > KC > KCP. Sebuah unit dapat memiliki turunan
 * bertingkat, jadi pencarian cabang di bawahnya harus rekursif (bukan
 * hanya satu lapis).
 */

export type CabangRingkas = {
  id: string;
  kode: string;
  nama: string;
  jenis: 'KANWIL' | 'KC' | 'KCP';
  indukId: string | null;
  aktif: boolean;
};

export const LABEL_JENIS: Record<string, string> = {
  KANWIL: 'Kanwil',
  KC: 'KC',
  KCP: 'KCP',
};

export const WARNA_JENIS: Record<string, string> = {
  KANWIL: 'bg-btn-biru-100 text-btn-biru-700',
  KC: 'bg-[#e0e7ff] text-[#4f46e5]',
  KCP: 'bg-abu-100 text-abu-600',
};

/**
 * Kumpulkan id semua cabang turunan secara rekursif (anak, cucu, dst).
 * Termasuk `idAwal` sendiri.
 *
 * Pencarian dilakukan di memori (bukan query berulang) karena daftar
 * cabang jumlahnya kecil — jauh lebih cepat daripada N+1 query.
 */
export function kumpulkanTurunan(
  idAwal: string,
  semuaCabang: Pick<CabangRingkas, 'id' | 'indukId'>[]
): string[] {
  const petaAnak = new Map<string, string[]>();
  for (const c of semuaCabang) {
    if (!c.indukId) continue;
    const daftar = petaAnak.get(c.indukId) ?? [];
    daftar.push(c.id);
    petaAnak.set(c.indukId, daftar);
  }

  const hasil = new Set<string>([idAwal]);
  const antre = [idAwal];
  while (antre.length > 0) {
    const kini = antre.shift()!;
    for (const anak of petaAnak.get(kini) ?? []) {
      if (hasil.has(anak)) continue; // jaga-jaga kalau ada siklus data
      hasil.add(anak);
      antre.push(anak);
    }
  }
  return [...hasil];
}

/** Cek apakah `kandidatInduk` berada di bawah `idCabang` (mencegah siklus). */
export function akanMembuatSiklus(
  idCabang: string,
  kandidatInduk: string | null,
  semuaCabang: Pick<CabangRingkas, 'id' | 'indukId'>[]
): boolean {
  if (!kandidatInduk) return false;
  if (kandidatInduk === idCabang) return true;
  // kalau kandidat induk adalah turunan dari cabang ini, berarti siklus
  const turunan = kumpulkanTurunan(idCabang, semuaCabang);
  return turunan.includes(kandidatInduk);
}

/** Susun cabang menjadi struktur pohon untuk ditampilkan berjenjang. */
export type CabangPohon = CabangRingkas & { kedalaman: number; jumlahTurunan: number };

export function susunPohon(semua: CabangRingkas[]): CabangPohon[] {
  const petaAnak = new Map<string | null, CabangRingkas[]>();
  for (const c of semua) {
    const kunci = c.indukId ?? null;
    const daftar = petaAnak.get(kunci) ?? [];
    daftar.push(c);
    petaAnak.set(kunci, daftar);
  }

  // urutkan: Kanwil dulu, lalu KC, lalu KCP; dalam level sama urut kode
  const bobot: Record<string, number> = { KANWIL: 0, KC: 1, KCP: 2 };
  const urut = (a: CabangRingkas, b: CabangRingkas) =>
    (bobot[a.jenis] ?? 9) - (bobot[b.jenis] ?? 9) || a.kode.localeCompare(b.kode);

  const hasil: CabangPohon[] = [];
  const dikunjungi = new Set<string>();

  const telusuri = (indukId: string | null, kedalaman: number) => {
    const anak = (petaAnak.get(indukId) ?? []).sort(urut);
    for (const c of anak) {
      if (dikunjungi.has(c.id)) continue; // hindari loop kalau data bermasalah
      dikunjungi.add(c.id);
      const turunan = kumpulkanTurunan(c.id, semua).length - 1;
      hasil.push({ ...c, kedalaman, jumlahTurunan: turunan });
      telusuri(c.id, kedalaman + 1);
    }
  };

  telusuri(null, 0);

  // kalau ada cabang yatim (induknya tidak ada di daftar), tetap tampilkan
  for (const c of semua.sort(urut)) {
    if (dikunjungi.has(c.id)) continue;
    hasil.push({ ...c, kedalaman: 0, jumlahTurunan: 0 });
  }

  return hasil;
}
