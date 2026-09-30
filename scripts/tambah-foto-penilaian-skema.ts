import { readFileSync, writeFileSync } from 'node:fs';

const p = 'prisma/schema.prisma';
let s = readFileSync(p, 'utf8');

// Tambahkan kolom foto pada Penilaian — foto melekat pada penilaian
// (per periode), bukan pada pegawai, karena setiap periode penilaian
// memerlukan foto baru.
const target = `  catatanUmum String?

  detail      PenilaianDetail[]`;

const ganti = `  catatanUmum String?

  // --- foto penilaian (satu foto per periode penilaian) ---
  // Dipisah dari foto pegawai: foto penilaian membuktikan kondisi petugas
  // pada periode itu, sementara foto pegawai adalah foto identitas.
  // Foto pegawai lama tetap tersimpan sebagai riwayat.
  /// Foto tersimpan sebagai data URL (base64), 3x4, maks 80 KB.
  fotoData       String?
  fotoMime       String?
  fotoUkuran     Int?
  fotoDiperbarui DateTime?
  /// keterangan singkat foto, mis. "seragam lengkap dengan name tag"
  fotoCatatan    String?

  detail      PenilaianDetail[]`;

if (!s.includes('fotoData       String?')) {
  if (!s.includes(target)) throw new Error('pola Penilaian tidak ditemukan');
  s = s.replace(target, ganti);
  console.log('Penilaian: kolom foto ditambahkan');
} else {
  console.log('Penilaian: kolom foto sudah ada');
}

writeFileSync(p, s);
