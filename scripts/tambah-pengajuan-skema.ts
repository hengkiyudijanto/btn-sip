import { readFileSync, writeFileSync } from 'node:fs';

const skema = 'prisma/schema.prisma';
const potongan = 'prisma/potongan-pengajuan.prisma';

let s = readFileSync(skema, 'utf8');

// 1. tambahkan model pengajuan di akhir berkas
if (!s.includes('model PengajuanPegawai')) {
  s += '\n' + readFileSync(potongan, 'utf8');
  console.log('model PengajuanPegawai ditambahkan');
} else {
  console.log('model PengajuanPegawai sudah ada');
}

// 2. tambahkan relasi balik di Pegawai
if (!s.includes('pengajuanDiajukan')) {
  const target = '  auditLog      AuditLog[]\n  sesi          Sesi[]';
  const ganti = `  auditLog      AuditLog[]
  sesi          Sesi[]

  /// pengajuan pegawai yang dibuat supervisor ini
  pengajuanDiajukan       PengajuanPegawai[] @relation("PengajuanOleh")
  /// pengajuan yang diputuskan admin ini
  pengajuanDiputus        PengajuanPegawai[] @relation("PengajuanDiputuskan")
  /// pengajuan yang menunjuk pegawai ini sebagai atasan
  pengajuanSebagaiAtasan  PengajuanPegawai[] @relation("PengajuanAtasan")
  /// pengajuan yang menghasilkan pegawai ini
  pengajuanHasil          PengajuanPegawai?  @relation("PengajuanHasil")`;

  if (!s.includes(target)) throw new Error('pola relasi Pegawai tidak ditemukan');
  s = s.replace(target, ganti);
  console.log('Pegawai: relasi pengajuan ditambahkan');
} else {
  console.log('Pegawai: relasi pengajuan sudah ada');
}

// 3. tambahkan relasi balik di Cabang
if (!s.includes('pengajuan          PengajuanPegawai[]')) {
  const m = s.match(/model Cabang \{[\s\S]*?\n\}/);
  if (m) {
    const isiCabang = m[0];
    // cari baris relasi terakhir sebelum penutup
    const gantiCabang = isiCabang.replace(/\n\}/, '\n  pengajuan     PengajuanPegawai[]\n}');
    s = s.replace(isiCabang, gantiCabang);
    console.log('Cabang: relasi pengajuan ditambahkan');
  } else {
    console.log('PERINGATAN: model Cabang tidak ditemukan');
  }
} else {
  console.log('Cabang: relasi pengajuan sudah ada');
}

writeFileSync(skema, s);
console.log('\nselesai menulis', skema);
