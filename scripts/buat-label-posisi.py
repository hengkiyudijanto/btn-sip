"""Berikan label posisi yang ditampilkan di slide ranking.

User meminta nama posisi memakai sebutan seperti di file aslinya:
  Teller   -> Teller Service
  CS       -> Customer Service
  Security -> Security
  dst.

Label ini HANYA untuk tampilan slide. Nama jabatan di database dan di
halaman lain (penilaian, pegawai) tidak diubah, supaya tidak ada yang
terpengaruh.
"""

from pathlib import Path

# ---- 1. modul label ----
modul = '''/**
 * Label posisi untuk slide ranking.
 *
 * Nama jabatan di database disimpan singkat ("Teller", "CS", "Security").
 * Di slide presentasi, user ingin sebutan lengkap seperti pada dokumen
 * resmi ("Teller Service", "Customer Service").
 *
 * PENTING: ini hanya untuk TAMPILAN slide. Nama jabatan di database dan di
 * halaman lain (penilaian, pegawai) tidak diubah supaya tidak ada yang
 * terpengaruh.
 */

const LABEL_POSISI: Record<string, string> = {
  TELLER: 'Teller Service',
  CS: 'Customer Service',
  SECURITY: 'Security',
  PB_TELLER: 'Priority Banking Teller',
  PB_CS: 'Priority Banking Customer Service',
};

/**
 * Ubah nama jabatan menjadi label slide.
 *
 * Pencocokan memakai kode jabatan dulu (paling andal), lalu nama jabatan
 * sebagai cadangan. Kalau tidak dikenali, nama aslinya dikembalikan apa
 * adanya — lebih baik tampil apa adanya daripada salah label.
 */
export function labelPosisi(kode: string | null, nama: string): string {
  if (kode && LABEL_POSISI[kode.toUpperCase()]) {
    return LABEL_POSISI[kode.toUpperCase()];
  }

  // cadangan: cocokkan dari nama (mis. "Teller", "Customer Service", "CS")
  const n = nama.trim().toLowerCase();
  if (n === 'teller') return 'Teller Service';
  if (n === 'cs' || n === 'customer service') return 'Customer Service';
  if (n === 'security') return 'Security';
  if (n.includes('priority') && n.includes('teller')) return 'Priority Banking Teller';
  if (n.includes('priority')) return 'Priority Banking Customer Service';

  return nama;
}
'''

Path('/home/ubuntu/projects/btn-sip/src/lib/sip/label-posisi.ts').write_text(
    modul, encoding='utf-8'
)
print('label-posisi.ts dibuat')
