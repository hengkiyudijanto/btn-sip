import { readFileSync, writeFileSync } from 'node:fs';

const skema = 'prisma/schema.prisma';
let s = readFileSync(skema, 'utf8');

// Jabatan perlu relasi balik
if (!s.includes('pengajuan    PengajuanPegawai[]')) {
  const m = s.match(/model Jabatan \{[\s\S]*?\n\}/);
  if (!m) throw new Error('model Jabatan tidak ditemukan');
  const ganti = m[0].replace(/\n\}/, '\n  pengajuan     PengajuanPegawai[]\n}');
  s = s.replace(m[0], ganti);
  console.log('Jabatan: relasi balik ditambahkan');
} else {
  console.log('Jabatan: sudah ada');
}

writeFileSync(skema, s);
