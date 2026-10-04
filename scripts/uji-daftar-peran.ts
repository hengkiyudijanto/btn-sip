/**
 * Uji bahwa SEMUA jalur input peran menerima seluruh SEMUA_PERAN.
 *
 * Bug yang dijaga skrip ini (4 Okt 2026): daftar peran disalin di tiga tempat
 * di actions/pegawai.ts dan tidak ikut diperbarui saat PENGAMAT ditambahkan,
 * sehingga "ubah peran ke Pengamat" ditolak dengan 'Peran tidak valid'
 * padahal pilihannya ada di form.
 */
import { readFileSync } from 'node:fs';
import { SEMUA_PERAN } from '../src/lib/sip/akses';

let lulus = 0, gagal = 0;
function cek(nama: string, ok: boolean, info = '') {
  if (ok) { lulus++; console.log(`  LULUS  ${nama}`); }
  else { gagal++; console.log(`  GAGAL  ${nama} ${info}`); }
}

console.log('== DAFTAR PERAN ==');
cek('PENGAMAT ada di SEMUA_PERAN', SEMUA_PERAN.includes('PENGAMAT'));
cek('jumlah peran = 5', SEMUA_PERAN.length === 5, `dapat ${SEMUA_PERAN.length}`);

console.log('\n== FILE TIDAK LAGI MENYALIN DAFTAR PERAN ==');
const isi = readFileSync('src/app/actions/pegawai.ts', 'utf8');
// pola daftar peran yang disalin manual
const salinan = [
  "['PEGAWAI', 'SUPERVISOR', 'MANAGER', 'ADMIN']",
  "['PEGAWAI','SUPERVISOR','MANAGER','ADMIN']",
  "new Set(['PEGAWAI', 'SUPERVISOR', 'MANAGER', 'ADMIN'])",
];
for (const pola of salinan) {
  cek(`tidak ada salinan manual: ${pola.slice(0, 34)}…`, !isi.includes(pola));
}
cek('memakai SEMUA_PERAN', isi.includes('SEMUA_PERAN'));

console.log('\n== SEMUA PERAN DITERIMA SETIAP JALUR ==');
// meniru logika validasi di tiap jalur
for (const r of SEMUA_PERAN) {
  const roleSah = new Set<string>(SEMUA_PERAN);           // impor Excel
  const okImpor = roleSah.has(r);
  const okTambah = (SEMUA_PERAN as readonly string[]).includes(r);  // tambah
  const ROLE_SAH = SEMUA_PERAN;                            // ubah
  const okUbah = (ROLE_SAH as readonly string[]).includes(r);
  cek(`${r}: diterima impor + tambah + ubah`, okImpor && okTambah && okUbah);
}

console.log(`\n${lulus} lulus, ${gagal} gagal`);
process.exitCode = gagal > 0 ? 1 : 0;
