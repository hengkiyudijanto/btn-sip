/**
 * Modul audit log: label aksi, warna badge, dan penyusun kalimat ringkas.
 *
 * Satu-satunya tempat daftar aksi audit boleh hidup. Kalau ada aksi baru
 * ditambahkan di server action, tambahkan labelnya di sini — jangan menulis
 * label di komponen halaman, karena halaman audit perlu menampilkan aksi
 * lama (yang mungkin sudah tidak dipakai lagi) tanpa berubah jadi
 * "Tidak dikenal" hanya karena labelnya ditulis di tempat lain.
 */

export type KelompokAudit =
  | 'masuk'
  | 'penilaian'
  | 'persetujuan'
  | 'periode'
  | 'pegawai'
  | 'cabang'
  | 'jabatan'
  | 'pengajuan'
  | 'foto'
  | 'berkas'
  | 'lain';

export type InfoAksi = {
  label: string;
  kelompok: KelompokAudit;
  /** true = aksi gagal/ditolak, ditampilkan dengan penanda merah */
  gagal?: boolean;
};

export const KELOMPOK_AUDIT: Record<KelompokAudit, { label: string; kelas: string }> = {
  masuk: { label: 'Masuk/Keluar', kelas: 'bg-abu-100 text-abu-700' },
  penilaian: { label: 'Penilaian', kelas: 'bg-btn-biru-100 text-btn-biru-700' },
  persetujuan: { label: 'Persetujuan', kelas: 'bg-sukses-bg text-sukses' },
  periode: { label: 'Periode', kelas: 'bg-peringatan-bg text-peringatan' },
  pegawai: { label: 'Pegawai', kelas: 'bg-btn-biru-100 text-btn-biru-700' },
  cabang: { label: 'Cabang', kelas: 'bg-abu-100 text-abu-700' },
  jabatan: { label: 'Jabatan', kelas: 'bg-abu-100 text-abu-700' },
  pengajuan: { label: 'Usul Pegawai', kelas: 'bg-peringatan-bg text-peringatan' },
  foto: { label: 'Foto', kelas: 'bg-abu-100 text-abu-700' },
  berkas: { label: 'Unduhan', kelas: 'bg-abu-100 text-abu-700' },
  lain: { label: 'Lain-lain', kelas: 'bg-abu-100 text-abu-600' },
};

/**
 * Daftar aksi yang dikenal. Kuncinya PERSIS sama dengan string `aksi` yang
 * ditulis server action — jangan mengubah string di action; ubah labelnya di
 * sini supaya riwayat lama tetap terbaca.
 */
export const INFO_AKSI: Record<string, InfoAksi> = {
  // ---- masuk / keluar ----
  LOGIN: { label: 'Masuk', kelompok: 'masuk' },
  LOGOUT: { label: 'Keluar', kelompok: 'masuk' },
  LOGIN_GAGAL: { label: 'Masuk gagal', kelompok: 'masuk', gagal: true },
  GANTI_PASSWORD: { label: 'Ganti password', kelompok: 'masuk' },
  GANTI_PASSWORD_GAGAL: { label: 'Ganti password gagal', kelompok: 'masuk', gagal: true },

  // ---- penilaian ----
  SIMPAN_DRAFT_PENILAIAN: { label: 'Simpan draft penilaian', kelompok: 'penilaian' },
  UBAH_DRAFT_PENILAIAN: { label: 'Ubah draft penilaian', kelompok: 'penilaian' },
  KIRIM_PENILAIAN: { label: 'Kirim penilaian', kelompok: 'penilaian' },
  UBAH_LALU_KIRIM_PENILAIAN: { label: 'Ubah lalu kirim penilaian', kelompok: 'penilaian' },

  // ---- persetujuan ----
  MENGETAHUI_PENILAIAN: { label: 'Menyatakan mengetahui', kelompok: 'persetujuan' },
  KUNCI_PENILAIAN: { label: 'Kunci penilaian (final)', kelompok: 'persetujuan' },
  KEMBALIKAN_PENILAIAN: { label: 'Kembalikan untuk revisi', kelompok: 'persetujuan' },

  // ---- periode ----
  BUAT_PERIODE: { label: 'Buat periode', kelompok: 'periode' },
  PINDAH_PENILAIAN: { label: 'Pindah penilaian', kelompok: 'penilaian' },
  HAPUS_PENILAIAN: { label: 'Hapus penilaian', kelompok: 'penilaian' },
  BUAT_PERIODE_MASSAL: { label: 'Buat periode massal', kelompok: 'periode' },
  KUNCI_PERIODE: { label: 'Kunci periode', kelompok: 'periode' },
  BUKA_KUNCI_PERIODE: { label: 'Buka kunci periode', kelompok: 'periode' },
  AKTIFKAN_PERIODE: { label: 'Aktifkan periode', kelompok: 'periode' },
  NONAKTIFKAN_PERIODE: { label: 'Nonaktifkan periode', kelompok: 'periode' },
  UBAH_HARI_PENILAIAN: { label: 'Ubah hari penilaian', kelompok: 'periode' },

  // ---- pegawai ----
  TAMBAH_PEGAWAI: { label: 'Tambah pegawai', kelompok: 'pegawai' },
  UBAH_PEGAWAI: { label: 'Ubah data pegawai', kelompok: 'pegawai' },
  UBAH_PEGAWAI_NIP: { label: 'Ubah NIP pegawai', kelompok: 'pegawai' },
  AKTIFKAN_PEGAWAI: { label: 'Aktifkan pegawai', kelompok: 'pegawai' },
  NONAKTIFKAN_PEGAWAI: { label: 'Nonaktifkan pegawai', kelompok: 'pegawai' },
  RESET_PASSWORD_PEGAWAI: { label: 'Reset password pegawai', kelompok: 'pegawai' },
  IMPOR_PEGAWAI: { label: 'Impor pegawai (CSV)', kelompok: 'pegawai' },

  // ---- cabang ----
  TAMBAH_CABANG: { label: 'Tambah cabang', kelompok: 'cabang' },
  UBAH_CABANG: { label: 'Ubah cabang', kelompok: 'cabang' },
  HAPUS_CABANG: { label: 'Hapus cabang', kelompok: 'cabang' },
  AKTIFKAN_CABANG: { label: 'Aktifkan cabang', kelompok: 'cabang' },
  NONAKTIFKAN_CABANG: { label: 'Nonaktifkan cabang', kelompok: 'cabang' },

  // ---- jabatan ----
  TAMBAH_JABATAN: { label: 'Tambah jabatan', kelompok: 'jabatan' },
  UBAH_JABATAN: { label: 'Ubah jabatan', kelompok: 'jabatan' },
  HAPUS_JABATAN: { label: 'Hapus jabatan', kelompok: 'jabatan' },
  AKTIFKAN_JABATAN: { label: 'Aktifkan jabatan', kelompok: 'jabatan' },
  NONAKTIFKAN_JABATAN: { label: 'Nonaktifkan jabatan', kelompok: 'jabatan' },

  // ---- pengajuan pegawai ----
  AJUKAN_PEGAWAI: { label: 'Ajukan pegawai baru', kelompok: 'pengajuan' },
  SETUJUI_PENGAJUAN_PEGAWAI: { label: 'Setujui usul pegawai', kelompok: 'pengajuan' },
  TOLAK_PENGAJUAN_PEGAWAI: { label: 'Tolak usul pegawai', kelompok: 'pengajuan' },
  BATAL_PENGAJUAN_PEGAWAI: { label: 'Batalkan usul pegawai', kelompok: 'pengajuan' },

  // ---- foto ----
  UNGGAH_FOTO_PEGAWAI: { label: 'Unggah foto pegawai', kelompok: 'foto' },
  HAPUS_FOTO_PEGAWAI: { label: 'Hapus foto pegawai', kelompok: 'foto' },
  SET_FOTO_URL_PEGAWAI: { label: 'Set alamat foto pegawai', kelompok: 'foto' },
  SIMPAN_FOTO_PENILAIAN: { label: 'Simpan foto penilaian', kelompok: 'foto' },
  HAPUS_FOTO_PENILAIAN: { label: 'Hapus foto penilaian', kelompok: 'foto' },

  // ---- unduhan ----
  EKSPOR_REKAP: { label: 'Ekspor rekap (CSV)', kelompok: 'berkas' },
  UNDUH_RANKING_PPTX: { label: 'Unduh ranking (PPTX)', kelompok: 'berkas' },
};

/** Info aksi; aksi tak dikenal tetap ditampilkan apa adanya, bukan disembunyikan. */
export function infoAksi(aksi: string): InfoAksi {
  return INFO_AKSI[aksi] ?? { label: aksi, kelompok: 'lain' };
}

/**
 * Kunci label supaya aksi baru yang belum didaftarkan ketahuan saat uji,
 * bukan baru terlihat user sebagai teks mentah di halaman.
 */
export function aksiBelumBerlabel(aksi: string): boolean {
  return !(aksi in INFO_AKSI);
}

/** Nilai JSON yang aman ditampilkan (bisa berupa apa saja dari kolom Json). */
type NilaiJson = unknown;

/** Ambil satu field dari objek JSON tanpa meledak kalau bentuknya bukan objek. */
function field(data: NilaiJson, nama: string): NilaiJson {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  return (data as Record<string, NilaiJson>)[nama];
}

function teks(v: NilaiJson): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return angkaID(v);
  if (typeof v === 'boolean') return v ? 'ya' : 'tidak';
  if (typeof v === 'string') return v;
  return null;
}

/**
 * Angka tanpa desimal (jumlah baris, jumlah peserta). Jangan pakai `teks()`
 * untuk ini — ia memformat dengan dua desimal dan "12 baris" jadi "12,00 baris".
 */
function angkaBulat(v: NilaiJson): string | null {
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.round(v));
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return String(Math.round(Number(v)));
  }
  return null;
}

/** Format angka gaya Indonesia (koma desimal) — dua desimal untuk nilai penilaian. */
export function angkaID(n: number, desimal = 2): string {
  return n.toFixed(desimal).replace('.', ',');
}

/**
 * Ringkasan satu baris yang bisa dibaca manusia, disusun dari `dataLama` dan
 * `dataBaru`. Sengaja HANYA memakai field yang memang dicatat action; kalau
 * bentuknya tidak dikenal, kembalikan null dan halaman menampilkan tombol
 * "Lihat data" saja.
 */
export function ringkasAudit(
  aksi: string,
  dataLama: NilaiJson,
  dataBaru: NilaiJson
): string | null {
  const info = infoAksi(aksi);

  // Perubahan nilai penilaian: tampilkan "dari berapa ke berapa" — itulah
  // satu-satunya alasan audit log ini ada (lihat skill).
  if (aksi.startsWith('SIMPAN_DRAFT_PENILAIAN') ||
      aksi.startsWith('UBAH_DRAFT_PENILAIAN') ||
      aksi.startsWith('KIRIM_PENILAIAN') ||
      aksi.startsWith('UBAH_LALU_KIRIM_PENILAIAN')) {
    const baru = teks(field(dataBaru, 'nilaiAkhir'));
    const lama = teks(field(dataLama, 'nilaiAkhir'));
    const ratingBaru = teks(field(dataBaru, 'rating'));
    const dinilai = teks(field(dataBaru, 'pegawaiDinilai'));
    const bagian: string[] = [];
    if (dinilai) bagian.push(dinilai);
    if (lama && baru) bagian.push(`nilai ${lama} → ${baru}`);
    else if (baru) bagian.push(`nilai ${baru}`);
    if (ratingBaru) bagian.push(`(${ratingBaru})`);
    return bagian.length ? bagian.join(' · ') : null;
  }

  if (aksi === 'KEMBALIKAN_PENILAIAN') {
    const alasan = teks(field(dataBaru, 'alasan'));
    const statusLama = teks(field(dataLama, 'status'));
    return [statusLama ? `${statusLama} → DRAFT` : 'kembali ke DRAFT', alasan]
      .filter(Boolean)
      .join(' · ') || null;
  }

  if (aksi === 'MENGETAHUI_PENILAIAN') {
    const dinilai = teks(field(dataBaru, 'pegawaiDinilai'));
    return dinilai ? `Penilaian ${dinilai} → DIKETAHUI` : null;
  }

  if (aksi === 'KUNCI_PENILAIAN') return 'Penilaian ditetapkan FINAL';

  // Pindah penilaian: tampilkan dari periode mana ke periode mana — inilah
  // informasi yang dicari saat menelusuri "kenapa penilaian ini pindah bulan".
  if (aksi === 'PINDAH_PENILAIAN') {
    const dari = teks(field(dataLama, 'namaPeriode'));
    const ke = teks(field(dataBaru, 'namaPeriode'));
    const siapa = teks(field(dataBaru, 'pegawai'));
    const bagian: string[] = [];
    if (siapa) bagian.push(siapa);
    if (dari && ke) bagian.push(`${dari} → ${ke}`);
    else if (ke) bagian.push(`→ ${ke}`);
    return bagian.length ? bagian.join(' · ') : null;
  }

  if (aksi === 'HAPUS_PENILAIAN') {
    const siapa = teks(field(dataLama, 'pegawai'));
    const periode = teks(field(dataLama, 'namaPeriode'));
    const status = teks(field(dataLama, 'status'));
    const nilai = teks(field(dataLama, 'nilaiAkhir'));
    const bagian: string[] = [];
    if (siapa) bagian.push(siapa);
    if (periode) bagian.push(periode);
    if (status) bagian.push(status);
    if (nilai) bagian.push(`nilai ${nilai}`);
    return bagian.length ? `${bagian.join(' · ')} (dihapus)` : null;
  }

  if (aksi === 'UBAH_HARI_PENILAIAN') {
    // field hariPenilaian adalah angka 0-6: diterjemahkan jadi nama hari,
    // bukan diformat sebagai nilai penilaian (jangan pakai angkaID di sini).
    const lama = field(dataLama, 'hariPenilaian');
    const baru = field(dataBaru, 'hariPenilaian');
    if (lama === undefined || lama === null || baru === undefined || baru === null) {
      return null;
    }
    return `${NamaHari(String(lama))} → ${NamaHari(String(baru))}`;
  }

  if (aksi === 'KUNCI_PERIODE' || aksi === 'BUKA_KUNCI_PERIODE' ||
      aksi === 'AKTIFKAN_PERIODE' || aksi === 'NONAKTIFKAN_PERIODE') {
    return teks(field(dataBaru, 'nama')) ?? teks(field(dataLama, 'nama'));
  }

  if (aksi === 'IMPOR_PEGAWAI') {
    const ditambah = teks(field(dataBaru, 'ditambah'));
    const diperbarui = teks(field(dataBaru, 'diperbarui'));
    if (!ditambah && !diperbarui) return null;
    return [`+${ditambah ?? 0} baru`, `${diperbarui ?? 0} diperbarui`].join(' · ');
  }

  if (aksi === 'EKSPOR_REKAP' || aksi === 'UNDUH_RANKING_PPTX') {
    // dua route ini menaruh datanya di sisi yang berbeda: ekspor di dataBaru,
    // ranking di dataLama. Baca keduanya supaya ringkasannya tetap muncul.
    const sumber = (yang: 'baru' | 'lama') =>
      (yang === 'baru' ? dataBaru : dataLama) ?? undefined;
    const ambil = (nama: string) =>
      teks(field(sumber('baru'), nama)) ?? teks(field(sumber('lama'), nama));
    const periode = ambil('periode');
    const unit = ambil('unit');
    const posisi = ambil('posisi');
    const jumlah =
      angkaBulat(field(sumber('baru'), 'jumlahBaris')) ??
      angkaBulat(field(sumber('baru'), 'peserta')) ??
      angkaBulat(field(sumber('baru'), 'jumlah'));
    const bagian = [
      periode,
      unit && unit !== 'Semua unit' ? unit : null,
      posisi && posisi !== 'Semua posisi' ? posisi : null,
      jumlah ? `${jumlah} baris` : null,
    ].filter(Boolean) as string[];
    return bagian.length ? bagian.join(' · ') : null;
  }

  if (info.gagal) {
    const nip = teks(field(dataBaru, 'nip'));
    return nip ? `NIP ${nip}` : null;
  }

  // sisanya: pakai nama data baru yang paling menggambarkan
  const nama = teks(field(dataBaru, 'nama')) ?? teks(field(dataLama, 'nama'));
  const kode = teks(field(dataBaru, 'kode')) ?? teks(field(dataLama, 'kode'));
  const bagian = [kode, nama].filter(Boolean);
  return bagian.length ? bagian.join(' — ') : null;
}

/** Nama hari dari angka 0-6, untuk menampilkan perubahan hari penilaian. */
export function NamaHari(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][n] ?? v;
}
